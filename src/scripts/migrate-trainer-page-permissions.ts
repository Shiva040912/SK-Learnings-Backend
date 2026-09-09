import { NestFactory } from '@nestjs/core';
import { getModelToken } from '@nestjs/mongoose';
import { Model } from 'mongoose';

import { AppModule } from '../app.module';
import { User, UserDocument } from '../users/user.schema';

// One-time migration for Phase 1 of the page-permission system.
//
// Existing Trainer accounts predate pagePermissions entirely. Per the
// decision for this rollout, they must NOT lose the access they already
// had — this backfills their pagePermissions to mirror what every Trainer
// could already do before this feature existed (everything except the
// admin-only Users page). It is safe to run more than once: any user who
// already has a pagePermissions document is left untouched, so an Admin's
// manual edits made after this script's first run are never overwritten.
const PRESERVED_TRAINER_ACCESS = {
  dashboard: true,
  students: true,
  payments: true,
  invoices: true,
  notifications: true,
  users: false,
  settings: true,
};

async function run() {
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: false,
  });

  const userModel = app.get<Model<UserDocument>>(getModelToken(User.name));

  const result = await userModel.updateMany(
    {
      role: 'trainer',
      pagePermissions: { $exists: false },
    },
    {
      $set: { pagePermissions: PRESERVED_TRAINER_ACCESS },
    },
  );

  console.log(
    `Migration complete. Matched ${result.matchedCount} trainer document(s), updated ${result.modifiedCount}.`,
  );

  await app.close();
}

run()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Migration failed:', error);
    process.exit(1);
  });
