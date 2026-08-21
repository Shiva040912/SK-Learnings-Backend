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

import { DashboardController } from './dashboard.controller';
import { DashboardService } from './dashboard.service';

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
  ],

  controllers: [DashboardController],

  providers: [DashboardService],

  exports: [DashboardService],
})
export class DashboardModule {}