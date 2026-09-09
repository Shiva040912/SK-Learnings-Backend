import { NestFactory } from '@nestjs/core';
import { getModelToken } from '@nestjs/mongoose';
import { Model } from 'mongoose';

import { AppModule } from '../app.module';
import { User, UserDocument } from '../users/user.schema';
import { createDefaultSettingsActions } from '../auth/settings-permission-keys';

// One-time migration for the Settings-page permission structure. Safe to
// run more than once.
//
// Before this phase, Settings had page access only — no section-level
// gating existed at all, so any user with pagePermissions.settings === true
// could already use every tab (Profile, Fee Settings, Notification
// Settings, Invoice Settings — Course & Batch and Mobile Layout are
// deliberately not part of this permission set at all, see
// settings-permission-keys.ts). Actions are now deny-by-default like every
// other granular action set in this app, which — left unmigrated — would
// silently strip existing trainers of every Settings tab. This backfill
// grants those existing users full Settings access in the new shape so
// today's behavior is preserved; only users edited after this migration (or
// newly created ones) start from the deny-by-default actions and need an
// Admin to explicitly grant them.
const FULL_SETTINGS_ACCESS = {
  actions: {
    ...createDefaultSettingsActions(),
    profileSettings: true,
    feeSettings: true,
    notificationSettings: true,
    invoiceSettings: true,
  },
};

async function run() {
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: false,
  });

  const userModel = app.get<Model<UserDocument>>(getModelToken(User.name));
  const collection = userModel.collection;

  const backfillResult = await collection.updateMany(
    {
      'pagePermissions.settings': true,
      'granularPermissions.settings': { $exists: false },
    },
    {
      $set: { 'granularPermissions.settings': FULL_SETTINGS_ACCESS },
    },
  );

  console.log(
    `Backfill (never had granular Settings permissions): matched ${backfillResult.matchedCount}, updated ${backfillResult.modifiedCount}.`,
  );

  await app.close();
}

run()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Migration failed:', error);
    process.exit(1);
  });
