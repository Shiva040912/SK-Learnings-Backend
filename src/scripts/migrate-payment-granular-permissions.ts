import { NestFactory } from '@nestjs/core';
import { getModelToken } from '@nestjs/mongoose';
import { Model } from 'mongoose';

import { AppModule } from '../app.module';
import { User, UserDocument } from '../users/user.schema';
import {
  createDefaultPaymentActions,
  createDefaultPaymentFields,
  createDefaultPaymentUpiFields,
} from '../auth/payment-permission-keys';

// One-time migration for the Payments-page permission structure. Safe to
// run more than once.
//
// Before this phase, Payments had page access only — no action-level
// gating existed at all, so any user with pagePermissions.payments === true
// could already do everything on the page (search, filter, fee setup,
// collect payment, UPI settings, etc). Actions are now deny-by-default like
// every other granular action set in this app, which — left unmigrated —
// would silently strip existing trainers of everything except viewing the
// page. This backfill grants those existing users full Payments access in
// the new shape so today's behavior is preserved; only USERS EDITED AFTER
// this migration (or newly created ones) start from the deny-by-default
// actions and need an Admin to explicitly grant them.
//
// Fields/UPI Settings are already visible-by-default (createDefault*
// returns all-true), so no backfill is needed for those — a user who never
// had granularPermissions.payments gets the fully-visible defaults the
// first time it's read (login, getAllUsers, etc.) via normalizeGranularPermissions.
// This script exists only to persist the actions grant for pre-existing
// Payments users, matching the Students-page migration's same policy.
const FULL_PAYMENT_ACCESS = {
  actions: {
    ...createDefaultPaymentActions(),
    search: true,
    filter: true,
    upiSettings: true,
    feeSetupIndividual: true,
    feeSetupCommon: true,
    feeSetupCourseWise: true,
    collectPayment: true,
    reverseResetFeeSetup: true,
    viewStudentPaymentDetails: true,
    editFee: true,
    addPartPayment: true,
    viewPaymentHistory: true,
    clearPaymentHistory: true,
    assignNextFee: true,
  },
  fields: createDefaultPaymentFields(),
  upiSettings: createDefaultPaymentUpiFields(),
};

async function run() {
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: false,
  });

  const userModel = app.get<Model<UserDocument>>(getModelToken(User.name));
  const collection = userModel.collection;

  const backfillResult = await collection.updateMany(
    {
      'pagePermissions.payments': true,
      'granularPermissions.payments': { $exists: false },
    },
    {
      $set: { 'granularPermissions.payments': FULL_PAYMENT_ACCESS },
    },
  );

  console.log(
    `Backfill (never had granular Payments permissions): matched ${backfillResult.matchedCount}, updated ${backfillResult.modifiedCount}.`,
  );

  await app.close();
}

run()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Migration failed:', error);
    process.exit(1);
  });
