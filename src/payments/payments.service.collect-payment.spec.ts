// payments.service.ts transitively imports invoice-pdf.service.ts, which
// statically imports the ESM-only `puppeteer` package Jest's default CJS
// transform can't parse — stub it out (this spec never touches PDF/
// puppeteer code paths at all).
jest.mock('puppeteer', () => ({}));

import { BadRequestException } from '@nestjs/common';
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

type SavedPayment = Record<string, unknown> & { save: jest.Mock };

// H4 (money-affecting audit trail) regression coverage for
// collectStudentPayment — the most critical money-affecting action.
describe('PaymentsService.collectStudentPayment — audit trail (H4)', () => {
  let service: PaymentsService;
  let studentModel: { findById: jest.Mock; findOneAndUpdate: jest.Mock };
  let paymentModel: {
    new (data: Record<string, unknown>): SavedPayment;
  };
  let auditLogService: { record: jest.Mock };

  const baseStudent = {
    _id: { toString: () => 'student-1' },
    feeSetupCompleted: true,
    feeType: 'partial',
    paidAmount: 2000,
    pendingAmount: 3000,
    paymentStatus: 'partial',
    studentName: 'Student',
    phone: '98765 43210',
    course: 'Science',
    muteAllFeeNotifications: false,
  };

  const findByIdResult = (doc: typeof baseStudent | null) => ({
    then: (resolve: (value: typeof baseStudent | null) => void) => resolve(doc),
  });

  beforeEach(async () => {
    studentModel = {
      findById: jest.fn().mockImplementation(() => findByIdResult(baseStudent)),
      findOneAndUpdate: jest.fn(),
    };

    function MockPaymentModel(this: SavedPayment, data: Record<string, unknown>) {
      Object.assign(this, data);
      this.save = jest.fn().mockResolvedValue({
        ...data,
        _id: { toString: () => 'payment-1' },
        paymentDate: new Date('2026-01-15'),
      });
    }
    paymentModel = MockPaymentModel as unknown as typeof paymentModel;

    auditLogService = { record: jest.fn().mockResolvedValue(undefined) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PaymentsService,
        { provide: getModelToken(Payment.name), useValue: paymentModel },
        {
          provide: getModelToken(PaymentSetting.name),
          useValue: {
            findOne: jest.fn().mockReturnValue({
              sort: jest.fn().mockResolvedValue(null),
            }),
          },
        },
        { provide: getModelToken(PaymentProof.name), useValue: {} },
        { provide: getModelToken(Student.name), useValue: studentModel },
        {
          provide: SettingsService,
          useValue: {
            getFeeSettings: jest.fn().mockResolvedValue({ yearlyFeeEnabled: true }),
            getNotificationSettings: jest
              .fn()
              .mockResolvedValue({ whatsappEnabled: false }),
          },
        },
        {
          provide: InvoiceService,
          useValue: { createPaymentReceiptInvoice: jest.fn().mockResolvedValue(null) },
        },
        { provide: WhatsappService, useValue: {} },
        { provide: AuditLogService, useValue: auditLogService },
      ],
    }).compile();

    service = module.get<PaymentsService>(PaymentsService);
  });

  const actingUser = { userId: 'trainer-1', role: 'trainer' };

  it('records an audit entry only after the payment is actually collected', async () => {
    studentModel.findOneAndUpdate.mockResolvedValue({
      paidAmount: 2500,
      pendingAmount: 2500,
      paymentStatus: 'partial',
      paymentMethod: 'cash',
      lastFeeReminderSentAt: null,
    });

    await service.collectStudentPayment(
      'student-1',
      { paymentMethod: 'cash', amount: 500 },
      actingUser,
    );

    expect(auditLogService.record).toHaveBeenCalledTimes(1);
    expect(auditLogService.record).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'payment.collect',
        targetId: 'student-1',
        performedBy: actingUser,
        amount: 500,
        before: expect.objectContaining({ paidAmount: 2000, pendingAmount: 3000 }),
        after: expect.objectContaining({ paidAmount: 2500, pendingAmount: 2500 }),
      }),
    );
  });

  it('does not create a false-success audit record when the payment amount exceeds pending', async () => {
    await expect(
      service.collectStudentPayment(
        'student-1',
        { paymentMethod: 'cash', amount: 999999 },
        actingUser,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(auditLogService.record).not.toHaveBeenCalled();
    expect(studentModel.findOneAndUpdate).not.toHaveBeenCalled();
  });

  it('does not create an audit record when the atomic balance update is rejected (lost race)', async () => {
    studentModel.findOneAndUpdate.mockResolvedValue(null);

    await expect(
      service.collectStudentPayment(
        'student-1',
        { paymentMethod: 'cash', amount: 500 },
        actingUser,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(auditLogService.record).not.toHaveBeenCalled();
  });

  it('records the correct performedBy identity from the acting user, not any client-supplied value', async () => {
    studentModel.findOneAndUpdate.mockResolvedValue({
      paidAmount: 2500,
      pendingAmount: 2500,
      paymentStatus: 'partial',
      paymentMethod: 'upi',
      lastFeeReminderSentAt: null,
    });

    const differentActor = { userId: 'admin-42', role: 'admin' };

    await service.collectStudentPayment(
      'student-1',
      { paymentMethod: 'upi', amount: 500 },
      differentActor,
    );

    expect(auditLogService.record).toHaveBeenCalledWith(
      expect.objectContaining({ performedBy: differentActor }),
    );
  });
});
