import { NestFactory } from '@nestjs/core';
import { getModelToken } from '@nestjs/mongoose';
import { Model } from 'mongoose';

import { AppModule } from '../app.module';
import { Student, StudentDocument } from '../student/students.schema';

// One-time migration for the Fee Ending Date -> recurring Due Date change.
//
// Before this phase, a student's payment due date was a single manually
// picked calendar date (feeEndingDate). Going forward it's a recurring
// monthly Due Day (feeDueDay, 1-31) plus a computed feeDueDate for the
// student's current unpaid cycle.
//
// For every fee-setup-completed student that already has a feeEndingDate
// but no feeDueDay yet, this derives:
//   - feeDueDay  = the day-of-month of their existing feeEndingDate
//   - feeDueDate = their existing feeEndingDate, unchanged
// This preserves their current overdue/reminder state exactly as it was
// (no student flips from "not yet due" to "overdue" or vice versa purely
// because of this migration) while giving them a real recurring Due Day
// going forward. No totals, payment history, or other fields are touched.
// Safe to run more than once.
async function run() {
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: false,
  });

  const studentModel = app.get<Model<StudentDocument>>(getModelToken(Student.name));

  const candidates = await studentModel.find({
    feeSetupCompleted: true,
    feeEndingDate: { $ne: null },
    feeDueDay: null,
  });

  let updated = 0;

  for (const student of candidates) {
    const feeEndingDate = student.feeEndingDate;
    if (!feeEndingDate) continue;

    const feeDueDay = new Date(feeEndingDate).getDate();

    await studentModel.updateOne(
      { _id: student._id },
      {
        $set: {
          feeDueDay,
          feeDueDate: feeEndingDate,
        },
      },
    );

    updated += 1;
  }

  console.log(
    `Fee Due Date migration: matched ${candidates.length}, updated ${updated}.`,
  );

  await app.close();
}

run()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Migration failed:', error);
    process.exit(1);
  });
