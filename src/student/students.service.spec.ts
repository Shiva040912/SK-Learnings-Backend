import { ConflictException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { Types } from 'mongoose';

import { StudentsService } from './students.service';
import { Student } from './students.schema';
import { Payment } from '../payments/payments.schema';
import { PaymentProof } from '../payments/payment-proof.schema';
import { Invoice } from '../invoice/invoice.schema';

interface StudentModelMock {
  findById: jest.Mock;
  findOneAndDelete: jest.Mock;
}

interface ExistsModelMock {
  exists: jest.Mock;
}

const STUDENT_1 = '507f1f77bcf86cd799439011';
const STUDENT_2 = '507f1f77bcf86cd799439012';
const STUDENT_3 = '507f1f77bcf86cd799439013';
const STUDENT_4 = '507f1f77bcf86cd799439014';
const STUDENT_5 = '507f1f77bcf86cd799439015';
const MISSING_ID = '507f1f77bcf86cd799439099';

// C2 (student deletion orphans financial records) regression coverage: a
// student with any linked Payment, PaymentProof, or Invoice must not be
// deletable, and the block must happen before any delete is attempted.
describe('StudentsService.remove — financial-record delete guard (C2)', () => {
  let service: StudentsService;
  let studentModel: StudentModelMock;
  let paymentModel: ExistsModelMock;
  let paymentProofModel: ExistsModelMock;
  let invoiceModel: ExistsModelMock;

  beforeEach(async () => {
    studentModel = {
      findById: jest.fn(),
      findOneAndDelete: jest.fn(),
    };
    paymentModel = { exists: jest.fn().mockResolvedValue(null) };
    paymentProofModel = { exists: jest.fn().mockResolvedValue(null) };
    invoiceModel = { exists: jest.fn().mockResolvedValue(null) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StudentsService,
        { provide: getModelToken(Student.name), useValue: studentModel },
        { provide: getModelToken(Payment.name), useValue: paymentModel },
        {
          provide: getModelToken(PaymentProof.name),
          useValue: paymentProofModel,
        },
        { provide: getModelToken(Invoice.name), useValue: invoiceModel },
      ],
    }).compile();

    service = module.get<StudentsService>(StudentsService);
  });

  it('A. deletes a student with no linked financial records', async () => {
    studentModel.findById.mockResolvedValue({ _id: STUDENT_1 });
    studentModel.findOneAndDelete.mockResolvedValue({ _id: STUDENT_1 });

    await expect(service.remove(STUDENT_1)).resolves.toMatchObject({
      message: 'Student deleted successfully',
    });

    expect(studentModel.findOneAndDelete).toHaveBeenCalledWith({
      _id: STUDENT_1,
    });
  });

  it('B. blocks deletion when a Payment record is linked, without deleting', async () => {
    studentModel.findById.mockResolvedValue({ _id: STUDENT_2 });
    paymentModel.exists.mockResolvedValue({ _id: 'payment-1' });

    await expect(service.remove(STUDENT_2)).rejects.toBeInstanceOf(
      ConflictException,
    );

    expect(studentModel.findOneAndDelete).not.toHaveBeenCalled();
  });

  it('C. blocks deletion when an Invoice record is linked, without deleting', async () => {
    studentModel.findById.mockResolvedValue({ _id: STUDENT_3 });
    invoiceModel.exists.mockResolvedValue({ _id: 'invoice-1' });

    await expect(service.remove(STUDENT_3)).rejects.toBeInstanceOf(
      ConflictException,
    );

    expect(studentModel.findOneAndDelete).not.toHaveBeenCalled();
  });

  it('D. blocks deletion when a PaymentProof record is linked, without deleting', async () => {
    studentModel.findById.mockResolvedValue({ _id: STUDENT_4 });
    paymentProofModel.exists.mockResolvedValue({ _id: 'proof-1' });

    await expect(service.remove(STUDENT_4)).rejects.toBeInstanceOf(
      ConflictException,
    );

    expect(studentModel.findOneAndDelete).not.toHaveBeenCalled();
  });

  it('E. checks are evaluated before any delete is attempted (no partial deletion), using a properly-cast ObjectId filter', async () => {
    studentModel.findById.mockResolvedValue({ _id: STUDENT_5 });
    paymentModel.exists.mockResolvedValue({ _id: 'payment-1' });

    await expect(service.remove(STUDENT_5)).rejects.toBeInstanceOf(
      ConflictException,
    );

    const expectedFilter = { studentId: new Types.ObjectId(STUDENT_5) };
    expect(paymentModel.exists).toHaveBeenCalledWith(expectedFilter);
    expect(paymentProofModel.exists).toHaveBeenCalledWith(expectedFilter);
    expect(invoiceModel.exists).toHaveBeenCalledWith(expectedFilter);
    expect(studentModel.findOneAndDelete).not.toHaveBeenCalled();
  });

  it('throws NotFoundException for a non-existent student', async () => {
    studentModel.findById.mockResolvedValue(null);

    await expect(service.remove(MISSING_ID)).rejects.toBeInstanceOf(
      NotFoundException,
    );

    expect(paymentModel.exists).not.toHaveBeenCalled();
  });
});
