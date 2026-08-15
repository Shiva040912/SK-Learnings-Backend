import {
  Injectable,
  Logger,
} from '@nestjs/common';

import { Cron } from '@nestjs/schedule';

import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';

import {
  Student,
  StudentDocument,
} from '../student/students.schema';

import { SettingsService } from '../settings/settings.service';

import { WhatsappService } from '../whatsapp/whatsapp.service';

@Injectable()
export class FeeReminderScheduler {
  private readonly logger =
    new Logger(
      FeeReminderScheduler.name,
    );

  constructor(
    @InjectModel(Student.name)
    private readonly studentModel:
      Model<StudentDocument>,

    private readonly settingsService:
      SettingsService,

    private readonly whatsappService:
      WhatsappService,
  ) {}

  @Cron('0 0 * * * *')
  async checkOverdueFees() {
    try {
      const settings =
        await this.settingsService.getNotificationSettings();

      if (
        !settings.whatsappEnabled ||
        !settings.overdueReminderEnabled
      ) {
        return;
      }

      const intervalDays =
        Number(
          settings.overdueReminderIntervalDays ||
            3,
        );

      const now =
        new Date();

      const students =
        await this.studentModel.find({
          feeSetupCompleted:
            true,

          paymentStatus: {
            $ne:
              'paid',
          },

          pendingAmount: {
            $gt:
              0,
          },

          feeEndingDate: {
            $lt:
              now,
          },
        });

      for (
        const student of students
      ) {
        try {
          let canSendReminder =
            true;

          if (
            student.lastFeeReminderSentAt
          ) {
            const lastSentDate =
              new Date(
                student.lastFeeReminderSentAt,
              );

            const nextReminderDate =
              new Date(
                lastSentDate,
              );

            nextReminderDate.setDate(
              nextReminderDate.getDate() +
                intervalDays,
            );

            if (
              now <
              nextReminderDate
            ) {
              canSendReminder =
                false;
            }
          }

          if (
            !canSendReminder
          ) {
            continue;
          }

          if (
            !student.feeEndingDate
          ) {
            this.logger.warn(
              `Fee ending date missing for ${student.studentName}`,
            );

            continue;
          }

          await this.whatsappService.sendFeePaymentReminder(
            {
              phone:
                student.phone,

              parentName:
                student.parentName,

              studentName:
                student.studentName,

              pendingAmount:
                Number(
                  student.pendingAmount ||
                    0,
                ),

              dueDate:
                student.feeEndingDate,
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

          this.logger.log(
            `Fee payment reminder sent to ${student.studentName}`,
          );
        } catch (error) {
          this.logger.error(
            `Reminder failed for ${student.studentName}: ${
              error instanceof Error
                ? error.message
                : String(
                    error,
                  )
            }`,
          );
        }
      }
    } catch (error) {
      this.logger.error(
        `Automatic fee reminder check failed: ${
          error instanceof Error
            ? error.message
            : String(
                error,
              )
        }`,
      );
    }
  }
}