import { Module } from '@nestjs/common';
import {
  ConfigModule,
  ConfigService,
} from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { ScheduleModule } from '@nestjs/schedule';

import { UsersModule } from './users/users.module';
import { AuthModule } from './auth/auth.module';
import { StudentsModule } from './student/students.module';
import { AcademicModule } from './academic/academic.module';
import { SettingsModule } from './settings/settings.module';
import { PaymentsModule } from './payments/payments.module';
import { InvoiceModule } from './invoice/invoice.module';
import { WhatsappModule } from './whatsapp/whatsapp.module';
import { NotificationsModule } from './notifications/notifications.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),

    ScheduleModule.forRoot(),

    MongooseModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (
        configService: ConfigService,
      ) => ({
        uri: configService.get<string>(
          'MONGODB_URI',
        ),
      }),
    }),

    UsersModule,
    AuthModule,
    StudentsModule,
    AcademicModule,
    SettingsModule,
    InvoiceModule,
    PaymentsModule,
    WhatsappModule,
    NotificationsModule,
  ],
})
export class AppModule {}