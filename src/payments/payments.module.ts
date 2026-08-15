import { Module } from '@nestjs/common';

import { MongooseModule } from '@nestjs/mongoose';

import {
  Payment,
  PaymentSchema,
} from './payments.schema';

import {
  PaymentSetting,
  PaymentSettingSchema,
} from './payments-settings.schema';

import {
  Student,
  StudentSchema,
} from '../student/students.schema';

import { PaymentsController } from './payments.controller';

import { PaymentsService } from './payments.service';

import { FeeReminderScheduler } from './fee-reminder.shedule';

import { SettingsModule } from '../settings/settings.module';

import { InvoiceModule } from '../invoice/invoice.module';

import { WhatsappModule } from '../whatsapp/whatsapp.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      {
        name: Payment.name,
        schema: PaymentSchema,
      },

      {
        name: PaymentSetting.name,
        schema: PaymentSettingSchema,
      },

      {
        name: Student.name,
        schema: StudentSchema,
      },
    ]),

    SettingsModule,

    InvoiceModule,

    WhatsappModule,
  ],

  controllers: [
    PaymentsController,
  ],

  providers: [
    PaymentsService,
    FeeReminderScheduler,
  ],

  exports: [
    PaymentsService,
  ],
})
export class PaymentsModule {}