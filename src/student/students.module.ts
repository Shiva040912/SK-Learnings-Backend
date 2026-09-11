import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

import { Student, StudentSchema } from './students.schema';

import { Course, CourseSchema } from '../academic/course.schema';
import { Batch, BatchSchema } from '../academic/batch.schema';
import { Payment, PaymentSchema } from '../payments/payments.schema';
import {
  PaymentProof,
  PaymentProofSchema,
} from '../payments/payment-proof.schema';
import { Invoice, InvoiceSchema } from '../invoice/invoice.schema';

import { StudentsService } from './students.service';
import { StudentsBulkUploadService } from './bulk-upload.service';
import { StudentsController } from './students.controller';

@Module({
  imports: [
    MongooseModule.forFeature([
      {
        name: Student.name,
        schema: StudentSchema,
      },
      {
        name: Course.name,
        schema: CourseSchema,
      },
      {
        name: Batch.name,
        schema: BatchSchema,
      },
      // Registered here (not via importing PaymentsModule/InvoiceModule) so
      // the delete-guard below can check for linked financial records —
      // same cross-module schema-registration pattern PaymentsModule and
      // InvoiceModule already use for Student itself.
      {
        name: Payment.name,
        schema: PaymentSchema,
      },
      {
        name: PaymentProof.name,
        schema: PaymentProofSchema,
      },
      {
        name: Invoice.name,
        schema: InvoiceSchema,
      },
    ]),
  ],

  controllers: [StudentsController],

  providers: [StudentsService, StudentsBulkUploadService],

  exports: [StudentsService],
})
export class StudentsModule {}
