import { NestFactory } from '@nestjs/core';
import { getModelToken } from '@nestjs/mongoose';
import { Model } from 'mongoose';

import { AppModule } from '../app.module';
import { User, UserDocument } from '../users/user.schema';
import {
  createDefaultInvoiceActions,
  createDefaultInvoiceFields,
} from '../auth/invoice-permission-keys';

// One-time migration for the Invoices-page permission structure. Safe to
// run more than once.
//
// Before this phase, Invoices had page access only — no action-level
// gating existed at all, so any user with pagePermissions.invoices === true
// could already do everything on the page (search, filter, view, download,
// print, clear). Actions are now deny-by-default like every other granular
// action set in this app, which — left unmigrated — would silently strip
// existing trainers of everything except viewing the page. This backfill
// grants those existing users full Invoices access in the new shape so
// today's behavior is preserved; only users edited after this migration (or
// newly created ones) start from the deny-by-default actions and need an
// Admin to explicitly grant them.
const FULL_INVOICE_ACCESS = {
  actions: {
    ...createDefaultInvoiceActions(),
    search: true,
    filter: true,
    viewInvoice: true,
    downloadInvoice: true,
    printInvoice: true,
    clearInvoices: true,
  },
  fields: createDefaultInvoiceFields(),
};

async function run() {
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: false,
  });

  const userModel = app.get<Model<UserDocument>>(getModelToken(User.name));
  const collection = userModel.collection;

  const backfillResult = await collection.updateMany(
    {
      'pagePermissions.invoices': true,
      'granularPermissions.invoices': { $exists: false },
    },
    {
      $set: { 'granularPermissions.invoices': FULL_INVOICE_ACCESS },
    },
  );

  console.log(
    `Backfill (never had granular Invoices permissions): matched ${backfillResult.matchedCount}, updated ${backfillResult.modifiedCount}.`,
  );

  await app.close();
}

run()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Migration failed:', error);
    process.exit(1);
  });
