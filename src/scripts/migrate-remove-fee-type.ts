import { NestFactory } from '@nestjs/core';
import { getModelToken } from '@nestjs/mongoose';
import { Model } from 'mongoose';

import { AppModule } from '../app.module';
import { Student, StudentDocument } from '../student/students.schema';

// One-time migration for the removal of the "Fee Type" (Part Payment /
// One-Time Payment) selection from Fee Setup and Payment Collection.
//
// Every student now behaves the same way: a single Total Fee, a fixed
// Fee Starting/Ending Date pair, and any amount can be paid (in any
// number of installments) until the total fee is reached. There is no
// longer a "Part Payment" fee TYPE — Part Payment only exists as a
// computed payment STATUS.
//
// Students that were previously set up with feeType 'partial' already
// have a real feeStartingDate/feeEndingDate populated (the recurring
// reminder job kept these rolled forward to the current monthly cycle),
// so converting them to 'yearly' is a safe, data-preserving relabel: no
// totals, payment history, or amounts are touched. Safe to run more than
// once.
async function run() {
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: false,
  });

  const studentModel = app.get<Model<StudentDocument>>(
    getModelToken(Student.name),
  );
  const collection = studentModel.collection;

  const result = await collection.updateMany(
    { feeType: 'partial' },
    { $set: { feeType: 'yearly' } },
  );

  console.log(
    `Fee Type migration (partial -> yearly): matched ${result.matchedCount}, updated ${result.modifiedCount}.`,
  );

  await app.close();
}

run()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Migration failed:', error);
    process.exit(1);
  });
