import { NestFactory } from '@nestjs/core';
import { getModelToken } from '@nestjs/mongoose';
import { Model } from 'mongoose';

import { AppModule } from '../app.module';
import { User, UserDocument } from '../users/user.schema';
import {
  createDefaultNotificationActions,
  createDefaultNotificationFields,
} from '../auth/notification-permission-keys';

// One-time migration for the Notifications-page permission structure. Safe
// to run more than once.
//
// Before this phase, Notifications had page access only — no action-level
// gating existed at all, so any user with pagePermissions.notifications ===
// true could already do everything on the page (search, filter, send
// reminders, edit preferences, etc). Actions are now deny-by-default like
// every other granular action set in this app, which — left unmigrated —
// would silently strip existing trainers of everything except viewing the
// page. This backfill grants those existing users full Notifications
// access in the new shape so today's behavior is preserved; only users
// edited after this migration (or newly created ones) start from the
// deny-by-default actions and need an Admin to explicitly grant them.
const FULL_NOTIFICATION_ACCESS = {
  actions: {
    ...createDefaultNotificationActions(),
    search: true,
    filter: true,
    refresh: true,
    sendNotification: true,
    sendToAll: true,
    sendIndividualSelected: true,
    sendReminder: true,
    notificationPreferences: true,
  },
  fields: createDefaultNotificationFields(),
};

async function run() {
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: false,
  });

  const userModel = app.get<Model<UserDocument>>(getModelToken(User.name));
  const collection = userModel.collection;

  const backfillResult = await collection.updateMany(
    {
      'pagePermissions.notifications': true,
      'granularPermissions.notifications': { $exists: false },
    },
    {
      $set: { 'granularPermissions.notifications': FULL_NOTIFICATION_ACCESS },
    },
  );

  console.log(
    `Backfill (never had granular Notifications permissions): matched ${backfillResult.matchedCount}, updated ${backfillResult.modifiedCount}.`,
  );

  await app.close();
}

run()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Migration failed:', error);
    process.exit(1);
  });
