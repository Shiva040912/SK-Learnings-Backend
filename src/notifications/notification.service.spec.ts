import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';

import { NotificationsService } from './notification.service';
import { Student } from '../student/students.schema';
import { Payment } from '../payments/payments.schema';
import { WhatsappService } from '../whatsapp/whatsapp.service';
import { SettingsService } from '../settings/settings.service';

// H2 (notification list phone-number leak) regression coverage:
// getNotifications() must never include a phone field on any item, since
// it is not a recognized Notifications-page field and the frontend never
// reads it — while every field the UI actually needs stays present.
describe('NotificationsService.getNotifications (H2)', () => {
  let service: NotificationsService;

  const fakeStudent = {
    _id: { toString: () => 'student-1' },
    studentName: 'Asha Kumar',
    rollNo: 'R-1',
    course: 'Science',
    batch: 'Morning',
    phone: '98765 43210',
    feeType: 'yearly',
    totalFee: 5000,
    paidAmount: 2000,
    pendingAmount: 3000,
    paymentStatus: 'partial',
    feeDueDate: new Date('2026-02-01'),
    feeReminderCount: 1,
    lastFeeReminderSentAt: new Date('2026-01-01'),
    muteAllFeeNotifications: false,
    muteFeeReminderNotification: false,
  };

  beforeEach(async () => {
    const studentModel = {
      find: jest.fn().mockReturnValue({
        sort: jest.fn().mockResolvedValue([fakeStudent]),
      }),
    };

    const paymentModel = {
      aggregate: jest.fn().mockResolvedValue([]),
    };

    const whatsappService = {};

    const settingsService = {
      getNotificationSettings: jest.fn().mockResolvedValue({
        reminderDaysBeforeDue: 3,
        overdueReminderIntervalDays: 3,
        whatsappEnabled: true,
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NotificationsService,
        { provide: getModelToken(Student.name), useValue: studentModel },
        { provide: getModelToken(Payment.name), useValue: paymentModel },
        { provide: WhatsappService, useValue: whatsappService },
        { provide: SettingsService, useValue: settingsService },
      ],
    }).compile();

    service = module.get<NotificationsService>(NotificationsService);
  });

  it('does not include a phone field on any notification item', async () => {
    const result = await service.getNotifications();

    expect(result.notifications).toHaveLength(1);
    expect(result.notifications[0]).not.toHaveProperty('phone');
    expect(JSON.stringify(result.notifications[0])).not.toContain(
      fakeStudent.phone,
    );
  });

  it('still returns every field the frontend notification UI actually needs', async () => {
    const result = await service.getNotifications();
    const item = result.notifications[0];

    expect(item).toMatchObject({
      studentId: 'student-1',
      studentName: 'Asha Kumar',
      rollNo: 'R-1',
      course: 'Science',
      batch: 'Morning',
      totalFee: 5000,
      paidAmount: 2000,
      pendingAmount: 3000,
      paymentStatus: 'partial',
    });
    expect(item.notificationPreferences).toEqual({
      muteAll: false,
      muteReminder: false,
    });
  });
});
