import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';

import {
  Student,
  StudentDocument,
} from '../student/students.schema';

import {
  Payment,
  PaymentDocument,
} from '../payments/payments.schema';

import { WhatsappService } from '../whatsapp/whatsapp.service';

import { SettingsService } from '../settings/settings.service';

type AlertType =
  | 'due_soon'
  | 'due_today'
  | 'overdue'
  | 'paid'
  | 'active';

type NotificationItem = {
  studentId: string;

  studentName: string;

  rollNo: string;

  course: string;

  batch:
    | string
    | null;

  phone: string;

  feeType:
    | 'monthly'
    | 'partial'
    | 'yearly'
    | null;

  totalFee: number;

  paidAmount: number;

  pendingAmount: number;

  paymentStatus:
    | 'unpaid'
    | 'partial'
    | 'paid';

  feeEndingDate:
    | Date
    | null;

  alertType:
    AlertType;

  daysValue:
    number;

  reminderCount:
    number;

  lastReminderSentAt:
    | Date
    | null;

  nextReminderDate:
    | Date
    | null;

  paidAfterReminder:
    boolean;

  latestPayment:
    | {
        amount:
          number;

        paymentMethod:
          | string
          | null;

        paymentDate:
          | Date
          | null;
      }
    | null;
};

@Injectable()
export class NotificationsService {
  constructor(
    @InjectModel(Student.name)
    private readonly studentModel:
      Model<StudentDocument>,

    @InjectModel(Payment.name)
    private readonly paymentModel:
      Model<PaymentDocument>,

    private readonly whatsappService:
      WhatsappService,

    private readonly settingsService:
      SettingsService,
  ) {}

  private startOfDay(
    value: Date,
  ) {
    const date =
      new Date(
        value,
      );

    date.setHours(
      0,
      0,
      0,
      0,
    );

    return date;
  }

  private getDaysDifference(
    first: Date,
    second: Date,
  ) {
    const firstDate =
      this.startOfDay(
        first,
      );

    const secondDate =
      this.startOfDay(
        second,
      );

    return Math.round(
      (
        secondDate.getTime() -
        firstDate.getTime()
      ) /
        (
          1000 *
          60 *
          60 *
          24
        ),
    );
  }

  private getNextReminderDate(
    lastSentAt:
      | Date
      | null
      | undefined,

    intervalDays:
      number,
  ) {
    if (
      !lastSentAt
    ) {
      return null;
    }

    const nextDate =
      new Date(
        lastSentAt,
      );

    nextDate.setDate(
      nextDate.getDate() +
        intervalDays,
    );

    return nextDate;
  }

  private async sendReminderToStudent(
    student:
      StudentDocument,
  ) {
    if (
      !student.feeEndingDate
    ) {
      throw new BadRequestException(
        'Student fee ending date is not configured',
      );
    }

    const whatsappResult =
      await this.whatsappService.sendFeeDueReminder(
        {
          phone:
            student.phone,

          studentName:
            student.studentName,

          studentId:
            student._id.toString(),

          courseName:
            student.course,

          pendingAmount:
            Number(
              student.pendingAmount ||
                0,
            ),
        },
      );

    student.lastFeeReminderSentAt =
      new Date();

    student.feeReminderCount =
      Number(
        student.feeReminderCount ||
          0,
      ) + 1;

    await student.save();

    return whatsappResult;
  }

  async getNotifications() {
    const settings =
      await this.settingsService.getNotificationSettings();

    const reminderDaysBeforeDue =
      Number(
        settings.reminderDaysBeforeDue ||
          0,
      );

    const reminderIntervalDays =
      Number(
        settings.overdueReminderIntervalDays ||
          3,
      );

    const now =
      new Date();

    const students =
      await this.studentModel
        .find({
          feeSetupCompleted:
            true,
        })
        .sort({
          feeEndingDate:
            1,
        });

    const result:
      NotificationItem[] = [];

    for (
      const student of students
    ) {
      const dueDate =
        student.feeEndingDate
          ? new Date(
              student.feeEndingDate,
            )
          : null;

      const reminderCount =
        Number(
          student.feeReminderCount ||
            0,
        );

      const lastReminderSentAt =
        student.lastFeeReminderSentAt
          ? new Date(
              student.lastFeeReminderSentAt,
            )
          : null;

      const nextReminderDate =
        this.getNextReminderDate(
          student.lastFeeReminderSentAt,
          reminderIntervalDays,
        );

      let alertType:
        AlertType =
        'active';

      let daysValue =
        0;

      if (
        student.paymentStatus ===
        'paid'
      ) {
        alertType =
          'paid';
      } else if (
        dueDate
      ) {
        const daysDifference =
          this.getDaysDifference(
            now,
            dueDate,
          );

        daysValue =
          daysDifference;

        if (
          daysDifference <
          0
        ) {
          alertType =
            'overdue';
        } else if (
          daysDifference ===
          0
        ) {
          alertType =
            'due_today';
        } else if (
          daysDifference <=
          reminderDaysBeforeDue
        ) {
          alertType =
            'due_soon';
        }
      }

      const latestPayment =
        await this.paymentModel
          .findOne({
            studentId:
              student._id.toString(),
          })
          .sort({
            paymentDate:
              -1,
          });

      const paidAfterReminder =
        Boolean(
          student.paymentStatus ===
            'paid' &&
            lastReminderSentAt &&
            latestPayment?.paymentDate &&
            new Date(
              latestPayment.paymentDate,
            ).getTime() >
              lastReminderSentAt.getTime(),
        );

      result.push({
        studentId:
          student._id.toString(),

        studentName:
          student.studentName,

        rollNo:
          student.rollNo,

        course:
          student.course,

        batch:
          student.batch ||
          null,

        phone:
          student.phone,

        feeType:
          student.feeType ||
          null,

        totalFee:
          Number(
            student.totalFee ||
              0,
          ),

        paidAmount:
          Number(
            student.paidAmount ||
              0,
          ),

        pendingAmount:
          Number(
            student.pendingAmount ||
              0,
          ),

        paymentStatus:
          student.paymentStatus,

        feeEndingDate:
          dueDate,

        alertType,

        daysValue,

        reminderCount,

        lastReminderSentAt,

        nextReminderDate,

        paidAfterReminder,

        latestPayment:
          latestPayment
            ? {
                amount:
                  Number(
                    latestPayment.amount ||
                      0,
                  ),

                paymentMethod:
                  latestPayment.paymentMethod ||
                  null,

                paymentDate:
                  latestPayment.paymentDate
                    ? new Date(
                        latestPayment.paymentDate,
                      )
                    : null,
              }
            : null,
      });
    }

    return {
      summary: {
        total:
          result.length,

        dueSoon:
          result.filter(
            (item) =>
              item.alertType ===
              'due_soon',
          ).length,

        dueToday:
          result.filter(
            (item) =>
              item.alertType ===
              'due_today',
          ).length,

        overdue:
          result.filter(
            (item) =>
              item.alertType ===
              'overdue',
          ).length,

        reminderSent:
          result.filter(
            (item) =>
              item.reminderCount >
              0,
          ).length,

        paidAfterReminder:
          result.filter(
            (item) =>
              item.paidAfterReminder,
          ).length,

        unpaid:
          result.filter(
            (item) =>
              item.paymentStatus !==
                'paid' &&
              item.pendingAmount >
                0,
          ).length,
      },

      reminderIntervalDays,

      notifications:
        result,
    };
  }

  async sendManualReminder(
    studentId:
      string,
  ) {
    const student =
      await this.studentModel.findById(
        studentId,
      );

    if (
      !student
    ) {
      throw new NotFoundException(
        'Student not found',
      );
    }

    if (
      !student.feeSetupCompleted
    ) {
      throw new BadRequestException(
        'Student fee setup is not completed',
      );
    }

    if (
      student.paymentStatus ===
        'paid' ||
      Number(
        student.pendingAmount ||
          0,
      ) <=
        0
    ) {
      throw new BadRequestException(
        'Student fee is already fully paid',
      );
    }

    const settings =
      await this.settingsService.getNotificationSettings();

    if (
      !settings.whatsappEnabled
    ) {
      throw new BadRequestException(
        'WhatsApp reminders are disabled in settings',
      );
    }

    const whatsappResult =
      await this.sendReminderToStudent(
        student,
      );

    return {
      message:
        'Fee reminder sent successfully',

      reminderCount:
        student.feeReminderCount,

      lastReminderSentAt:
        student.lastFeeReminderSentAt,

      whatsapp:
        whatsappResult,
    };
  }

  async sendAllUnpaidReminders() {
    const settings =
      await this.settingsService.getNotificationSettings();

    if (
      !settings.whatsappEnabled
    ) {
      throw new BadRequestException(
        'WhatsApp reminders are disabled in settings',
      );
    }

    const students =
      await this.studentModel.find({
        feeSetupCompleted:
          true,

        paymentStatus: {
          $in: [
            'unpaid',
            'partial',
          ],
        },

        pendingAmount: {
          $gt:
            0,
        },

        isActive:
          true,
      });

    if (
      students.length ===
      0
    ) {
      return {
        message:
          'No unpaid students found',

        total:
          0,

        sent:
          0,

        failed:
          0,

        failedStudents:
          [],
      };
    }

    let sent =
      0;

    let failed =
      0;

    const failedStudents: {
      studentId:
        string;

      studentName:
        string;

      reason:
        string;
    }[] = [];

    for (
      const student of students
    ) {
      try {
        await this.sendReminderToStudent(
          student,
        );

        sent +=
          1;
      } catch (error) {
        failed +=
          1;

        failedStudents.push({
          studentId:
            student._id.toString(),

          studentName:
            student.studentName,

          reason:
            error instanceof Error
              ? error.message
              : 'WhatsApp reminder failed',
        });
      }
    }

    return {
      message:
        failed ===
        0
          ? `Reminder sent successfully to ${sent} unpaid student${
              sent ===
              1
                ? ''
                : 's'
            }`
          : `Reminder process completed. ${sent} sent, ${failed} failed.`,

      total:
        students.length,

      sent,

      failed,

      failedStudents,
    };
  }
}