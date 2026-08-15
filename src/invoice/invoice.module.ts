import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

import {
  Invoice,
  InvoiceSchema,
  InvoiceCounter,
  InvoiceCounterSchema,
} from './invoice.schema';

import {
  Student,
  StudentSchema,
} from '../student/students.schema';

import {
  Payment,
  PaymentSchema,
} from '../payments/payments.schema';

import { InvoiceController } from './invoice.controller';
import { InvoiceService } from './invoice.service';
import { InvoicePdfService } from './invoice-pdf.service';

import { SettingsModule } from '../settings/settings.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      {
        name:
          Invoice.name,
        schema:
          InvoiceSchema,
      },

      {
        name:
          InvoiceCounter.name,
        schema:
          InvoiceCounterSchema,
      },

      {
        name:
          Student.name,
        schema:
          StudentSchema,
      },

      {
        name:
          Payment.name,
        schema:
          PaymentSchema,
      },
    ]),

    SettingsModule,
  ],

  controllers: [
    InvoiceController,
  ],

  providers: [
    InvoiceService,
    InvoicePdfService,
  ],

  exports: [
    InvoiceService,
    InvoicePdfService,
  ],
})
export class InvoiceModule {}