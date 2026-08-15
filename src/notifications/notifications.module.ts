import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

import {
  Student,
  StudentSchema,
} from '../student/students.schema';

import {
  Payment,
  PaymentSchema,
} from '../payments/payments.schema';

import { NotificationsController } from './notification.controller';
import { NotificationsService } from './notification.service';

import { WhatsappModule } from '../whatsapp/whatsapp.module';
import { SettingsModule } from '../settings/settings.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      {
        name: Student.name,
        schema: StudentSchema,
      },
      {
        name: Payment.name,
        schema: PaymentSchema,
      },
    ]),
    WhatsappModule,
    SettingsModule,
  ],
  controllers: [NotificationsController],
  providers: [NotificationsService],
  exports: [NotificationsService],
})
export class NotificationsModule {}