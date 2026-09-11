import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';

import { AuditLogService } from './audit-log.service';
import { AuditLog } from './audit-log.schema';

// H4 (money-affecting audit trail) regression coverage for the shared
// AuditLogService.record() that every money-affecting PaymentsService
// method calls into.
describe('AuditLogService.record (H4)', () => {
  let service: AuditLogService;
  let auditLogModel: { create: jest.Mock };

  beforeEach(async () => {
    auditLogModel = { create: jest.fn().mockResolvedValue({}) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuditLogService,
        { provide: getModelToken(AuditLog.name), useValue: auditLogModel },
      ],
    }).compile();

    service = module.get<AuditLogService>(AuditLogService);
  });

  it('creates a record with the correct actor, action, and target', async () => {
    await service.record({
      action: 'payment.collect',
      targetId: 'student-1',
      performedBy: { userId: 'user-1', role: 'trainer' },
      amount: 500,
      before: { paidAmount: 0 },
      after: { paidAmount: 500 },
    });

    expect(auditLogModel.create).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'payment.collect',
        targetType: 'Student',
        targetId: 'student-1',
        performedBy: 'user-1',
        performedByRole: 'trainer',
        amount: 500,
        before: { paidAmount: 0 },
        after: { paidAmount: 500 },
      }),
    );
  });

  it('defaults amount/before/after to null when omitted, without adding extra fields', async () => {
    await service.record({
      action: 'fee.reset',
      targetId: 'student-2',
      performedBy: { userId: 'user-2', role: 'admin' },
    });

    const written = auditLogModel.create.mock.calls[0][0];
    expect(written.amount).toBeNull();
    expect(written.before).toBeNull();
    expect(written.after).toBeNull();
    expect(JSON.stringify(written)).not.toMatch(/password|token|jwt|secret/i);
  });

  it('swallows a write failure rather than throwing (the financial action already succeeded)', async () => {
    auditLogModel.create.mockRejectedValue(new Error('DB unavailable'));

    await expect(
      service.record({
        action: 'payment.collect',
        targetId: 'student-3',
        performedBy: { userId: 'user-3', role: 'admin' },
      }),
    ).resolves.toBeUndefined();
  });
});
