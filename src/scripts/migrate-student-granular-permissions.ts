import { NestFactory } from '@nestjs/core';
import { getModelToken } from '@nestjs/mongoose';
import { Model } from 'mongoose';

import { AppModule } from '../app.module';
import { User, UserDocument } from '../users/user.schema';
import {
  createDefaultStudentActions,
  createDefaultStudentFields,
  StudentActionsMap,
  StudentFieldsMap,
} from '../auth/student-permission-keys';

// One-time migration for the Students-page permission structure. Safe to
// run more than once. Handles two cases:
//
// 1) Users who never had granularPermissions.students at all, but already
//    had pagePermissions.students === true before granular permissions
//    existed at all — they could already do everything on the Students
//    page, so (per the same no-regression policy as every prior migration
//    in this series) this grants them full access in the CURRENT
//    (fields-based) shape.
//
// 2) Users whose granularPermissions.students is still in the OLD shape —
//    separate `columns`/`details` maps, and `actions.viewList` /
//    `actions.viewDetails` instead of a single `actions.view` — from
//    before columns and details were consolidated into one `fields` map.
//    These are converted in place: a field is visible in the new model if
//    it was visible through EITHER the old column OR the old detail flag
//    (so nobody loses something they could already see), and `view` is
//    granted if the user had either viewList or viewDetails. The stale
//    columns/details keys are removed so the old and new systems never
//    coexist.
//
// Reads/writes through the raw collection (not the Mongoose model) so it
// can see and remove fields the current schema no longer declares.
const FULL_STUDENT_ACCESS = {
  actions: {
    ...createDefaultStudentActions(),
    view: true,
    add: true,
    edit: true,
    delete: true,
    bulkUpload: true,
    addCourse: true,
    deleteCourse: true,
    addBatch: true,
    deleteBatch: true,
  },
  fields: createDefaultStudentFields(),
};

interface LegacyStudentPermissions {
  actions?: Record<string, boolean> & {
    viewList?: boolean;
    viewDetails?: boolean;
  };
  columns?: Record<string, boolean>;
  details?: Record<string, boolean>;
}

// Which legacy `columns` key (if any) used to gate each new field — only
// fields that were previously table columns had one.
const FIELD_TO_LEGACY_COLUMN: Partial<Record<keyof StudentFieldsMap, string>> =
  {
    studentName: 'student',
    parentName: 'student',
    rollNo: 'rollNo',
    course: 'course',
    gender: 'gender',
    phone: 'phone',
    idproof: 'aadhaar',
  };

function convertLegacyStudentPermissions(legacy: LegacyStudentPermissions): {
  actions: StudentActionsMap;
  fields: StudentFieldsMap;
} {
  const legacyActions = legacy.actions || {};
  const legacyColumns = legacy.columns || {};
  const legacyDetails = legacy.details || {};

  const fields = createDefaultStudentFields();

  for (const field of Object.keys(fields) as (keyof StudentFieldsMap)[]) {
    const legacyColumn = FIELD_TO_LEGACY_COLUMN[field];

    const legacyColumnValue = legacyColumn
      ? legacyColumns[legacyColumn]
      : undefined;

    const legacyDetailValue = legacyDetails[field];

    // Only override the (visible-by-default) value when the legacy data
    // actually said something about this field — a field visible through
    // either surface stays visible in the unified model.
    if (legacyColumnValue !== undefined || legacyDetailValue !== undefined) {
      fields[field] = Boolean(legacyColumnValue) || Boolean(legacyDetailValue);
    }
  }

  const view = Boolean(legacyActions.viewList || legacyActions.viewDetails);

  const actions: StudentActionsMap = {
    ...createDefaultStudentActions(),
    ...legacyActions,
    view,
  };

  actions.bulkUpload = actions.add;

  return { actions, fields };
}

async function run() {
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: false,
  });

  const userModel = app.get<Model<UserDocument>>(getModelToken(User.name));
  const collection = userModel.collection;

  const backfillResult = await collection.updateMany(
    {
      'pagePermissions.students': true,
      'granularPermissions.students': { $exists: false },
    },
    {
      $set: { 'granularPermissions.students': FULL_STUDENT_ACCESS },
    },
  );

  console.log(
    `Backfill (never had granular permissions): matched ${backfillResult.matchedCount}, updated ${backfillResult.modifiedCount}.`,
  );

  const legacyUsers = await collection
    .find({
      $or: [
        { 'granularPermissions.students.columns': { $exists: true } },
        { 'granularPermissions.students.details': { $exists: true } },
        { 'granularPermissions.students.actions.viewList': { $exists: true } },
        {
          'granularPermissions.students.actions.viewDetails': {
            $exists: true,
          },
        },
      ],
    })
    .toArray();

  let convertedCount = 0;

  for (const user of legacyUsers) {
    const legacy =
      (
        (user as Record<string, unknown>).granularPermissions as
          { students?: LegacyStudentPermissions } | undefined
      )?.students || {};

    const { actions, fields } = convertLegacyStudentPermissions(legacy);

    await collection.updateOne(
      { _id: user._id },
      {
        $set: {
          'granularPermissions.students.actions': actions,
          'granularPermissions.students.fields': fields,
        },
        $unset: {
          'granularPermissions.students.columns': '',
          'granularPermissions.students.details': '',
        },
      },
    );

    convertedCount += 1;
  }

  console.log(
    `Conversion (old columns/details shape -> fields): matched ${legacyUsers.length}, converted ${convertedCount}.`,
  );

  await app.close();
}

run()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Migration failed:', error);
    process.exit(1);
  });
