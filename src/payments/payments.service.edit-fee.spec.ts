// payments.service.ts transitively imports invoice-pdf.service.ts, which
// statically imports the ESM-only `puppeteer` package Jest's default CJS
// transform can't parse — stub it out (this spec never touches PDF/
// puppeteer code paths at all).
jest.mock('puppeteer', () => ({}));

import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';

import { PaymentsService } from './payments.service';
import { Payment } from './payments.schema';
import { PaymentSetting } from './payments-settings.schema';
import { PaymentProof } from './payment-proof.schema';
import { Student } from '../student/students.schema';
import { SettingsService } from '../settings/settings.service';
import { InvoiceService } from '../invoice/invoice.service';
import { WhatsappService } from '../whatsapp/whatsapp.service';
import { AuditLogService } from '../audit/audit-log.service';

// H3 (fee-editing race condition) regression coverage for editStudentFee:
// the write must be one atomic findOneAndUpdate whose pendingAmount/
// paymentStatus are computed from paidAmount AS STORED (via the pipeline),
// never from the earlier in-memory snapshot — and the "cannot reduce
// below what's already paid" rule must be enforced against that same live
// value via the query filter, not just the earlier snapshot check.
describe('PaymentsService.editStudentFee (H3)', () => {
  let service: PaymentsService;
  let studentModel: {
    findById: jest.Mock;
    findOneAndUpdate: jest.Mock;
  };
  let settingsService: { getFeeSettings: jest.Mock; getNotificationSettings: jest.Mock };
  let invoiceService: { createFeeSetupInvoice: jest.Mock };
  let auditLogService: { record: jest.Mock };

  const baseStudent = {
    _id: { toString: () => 'student-1' },
    feeSetupCompleted: true,
    paidAmount: 2000,
    totalFee: 5000,
    phone: '98765 43210',
    parentName: 'Parent',
    studentName: 'Student',
    feeType: 'yearly',
    pendingAmount: 3000,
    feeDueDate: new Date('2026-02-01'),
    muteAllFeeNotifications: false,
  };

  const findByIdResult = (doc: typeof baseStudent | null) => ({
    then: (resolve: (value: typeof baseStudent | null) => void) => resolve(doc),
    select: () => ({
      lean: () =>
        Promise.resolve(doc ? { paidAmount: doc.paidAmount } : null),
    }),
  });

  beforeEach(async () => {
    studentModel = {
      findById: jest.fn().mockImplementation(() => findByIdResult(baseStudent)),
      findOneAndUpdate: jest.fn(),
    };

    settingsService = {
      getFeeSettings: jest.fn().mockResolvedValue({ yearlyFeeEnabled: true }),
      getNotificationSettings: jest
        .fn()
        .mockResolvedValue({ whatsappEnabled: false }),
    };

    invoiceService = {
      createFeeSetupInvoice: jest.fn().mockResolvedValue(null),
    };

    auditLogService = { record: jest.fn().mockResolvedValue(undefined) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PaymentsService,
        { provide: getModelToken(Payment.name), useValue: {} },
        { provide: getModelToken(PaymentSetting.name), useValue: {} },
        { provide: getModelToken(PaymentProof.name), useValue: {} },
        { provide: getModelToken(Student.name), useValue: studentModel },
        { provide: SettingsService, useValue: settingsService },
        { provide: InvoiceService, useValue: invoiceService },
        { provide: WhatsappService, useValue: { sendFeePaymentInvoice: jest.fn() } },
        { provide: AuditLogService, useValue: auditLogService },
      ],
    }).compile();

    service = module.get<PaymentsService>(PaymentsService);
  });

  it('performs the update as one atomic findOneAndUpdate with a live-data filter', async () => {
    const updatedDoc = { ...baseStudent, totalFee: 6000, pendingAmount: 4000 };
    studentModel.findOneAndUpdate.mockResolvedValue(updatedDoc);

    await service.editStudentFee('student-1', { totalFee: 6000, feeDueDay: 10 });

    expect(studentModel.findOneAndUpdate).toHaveBeenCalledTimes(1);
    const [filter, pipeline, options] = studentModel.findOneAndUpdate.mock.calls[0];

    // The "can't reduce below what's already paid" rule is enforced by the
    // query filter itself, against whatever paidAmount is stored at write
    // time — not by a plain JS comparison against the earlier snapshot.
    expect(filter).toMatchObject({
      _id: baseStudent._id,
      paidAmount: { $lte: 6000 },
    });

    expect(Array.isArray(pipeline)).toBe(true);
    // pendingAmount must be an expression referencing the live $paidAmount
    // field, not a pre-computed plain number.
    const setStage = (pipeline as Array<{ $set?: Record<string, unknown> }>).find(
      (stage) => stage.$set && 'pendingAmount' in stage.$set,
    );
    expect(JSON.stringify(setStage?.$set?.pendingAmount)).toContain('$paidAmount');

    expect(options).toMatchObject({ updatePipeline: true });
  });

  it('returns the atomically-updated document, not the pre-write snapshot', async () => {
    const updatedDoc = { ...baseStudent, totalFee: 6000, pendingAmount: 4000 };
    studentModel.findOneAndUpdate.mockResolvedValue(updatedDoc);

    const result = await service.editStudentFee('student-1', {
      totalFee: 6000,
      feeDueDay: 10,
    });

    expect(result.student).toBe(updatedDoc);
  });

  it('rejects when the live paidAmount (at write time) exceeds the new totalFee', async () => {
    // Simulates a concurrent payment having pushed paidAmount above the
    // new totalFee between the initial read and this atomic write — the
    // filter's paidAmount <= totalFee condition matches nothing, so
    // findOneAndUpdate resolves null.
    studentModel.findOneAndUpdate.mockResolvedValue(null);

    await expect(
      service.editStudentFee('student-1', { totalFee: 1000, feeDueDay: 10 }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects a fee edit for a student whose fee setup is not completed', async () => {
    studentModel.findById.mockImplementation(() =>
      findByIdResult({ ...baseStudent, feeSetupCompleted: false }),
    );

    await expect(
      service.editStudentFee('student-1', { totalFee: 6000, feeDueDay: 10 }),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(studentModel.findOneAndUpdate).not.toHaveBeenCalled();
  });

  it('throws NotFoundException for a non-existent student', async () => {
    studentModel.findById.mockImplementation(() => findByIdResult(null));

    await expect(
      service.editStudentFee('missing-id', { totalFee: 6000, feeDueDay: 10 }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('rejects a non-positive totalFee before ever attempting the write', async () => {
    await expect(
      service.editStudentFee('student-1', { totalFee: 0, feeDueDay: 10 }),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(studentModel.findOneAndUpdate).not.toHaveBeenCalled();
  });

  // H4 (money-affecting audit trail) regression coverage for editStudentFee.
  describe('audit trail (H4)', () => {
    const actingUser = { userId: 'user-99', role: 'admin' };

    it('records an audit entry only after the fee edit succeeds, with the correct actor/action/target', async () => {
      const updatedDoc = {
        ...baseStudent,
        totalFee: 6000,
        pendingAmount: 4000,
      };
      studentModel.findOneAndUpdate.mockResolvedValue(updatedDoc);

      await service.editStudentFee(
        'student-1',
        { totalFee: 6000, feeDueDay: 10 },
        actingUser,
      );

      expect(auditLogService.record).toHaveBeenCalledTimes(1);
      expect(auditLogService.record).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'fee.edit',
          targetId: 'student-1',
          performedBy: actingUser,
          amount: 6000,
        }),
      );
    });

    it('does not create a false-success audit record when the fee edit is rejected', async () => {
      studentModel.findOneAndUpdate.mockResolvedValue(null);

      await expect(
        service.editStudentFee(
          'student-1',
          { totalFee: 1000, feeDueDay: 10 },
          actingUser,
        ),
      ).rejects.toBeInstanceOf(BadRequestException);

      expect(auditLogService.record).not.toHaveBeenCalled();
    });

    it('does not create an audit record when a business-rule check fails before any write', async () => {
      await expect(
        service.editStudentFee(
          'student-1',
          { totalFee: 0, feeDueDay: 10 },
          actingUser,
        ),
      ).rejects.toBeInstanceOf(BadRequestException);

      expect(auditLogService.record).not.toHaveBeenCalled();
    });

    it('does not record when no acting user is supplied (nothing to attribute the change to)', async () => {
      const updatedDoc = {
        ...baseStudent,
        totalFee: 6000,
        pendingAmount: 4000,
      };
      studentModel.findOneAndUpdate.mockResolvedValue(updatedDoc);

      await service.editStudentFee('student-1', { totalFee: 6000, feeDueDay: 10 });

      expect(auditLogService.record).not.toHaveBeenCalled();
    });

    it('captures before/after financial state without any sensitive fields', async () => {
      const updatedDoc = {
        ...baseStudent,
        totalFee: 6000,
        pendingAmount: 4000,
      };
      studentModel.findOneAndUpdate.mockResolvedValue(updatedDoc);

      await service.editStudentFee(
        'student-1',
        { totalFee: 6000, feeDueDay: 10 },
        actingUser,
      );

      const call = auditLogService.record.mock.calls[0][0];
      const serialized = JSON.stringify(call);

      expect(call.before).toMatchObject({ totalFee: 5000, paidAmount: 2000 });
      expect(call.after).toMatchObject({ totalFee: 6000 });
      expect(serialized).not.toMatch(/password|token|jwt|secret/i);
      expect(call.before).not.toHaveProperty('phone');
      expect(call.after).not.toHaveProperty('phone');
    });
  });
});
