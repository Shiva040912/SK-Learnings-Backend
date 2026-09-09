import {
  Injectable,
  Logger,
} from '@nestjs/common';

import {
  Cron,
} from '@nestjs/schedule';

import {
  InjectModel,
} from '@nestjs/mongoose';

import {
  Model,
} from 'mongoose';

import {
  Student,
  StudentDocument,
} from '../student/students.schema';

import {
  SettingsService,
} from '../settings/settings.service';

import {
  WhatsappService,
} from '../whatsapp/whatsapp.service';

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

  private getTodayStart() {
    const date =
      new Date();

    date.setHours(
      0,
      0,
      0,
      0,
    );

    return date;
  }

  private async acquireReminderLock(
    student: StudentDocument,
    intervalDays: number,
  ) {
    const now = new Date();

    const intervalThreshold = new Date(now);
    intervalThreshold.setDate(
      intervalThreshold.getDate() - intervalDays,
    );

    const claimedStudent =
      await this.studentModel.findOneAndUpdate(
        {
          _id: student._id,

          feeSetupCompleted: true,

          paymentStatus: {
            $ne: 'paid',
          },

          pendingAmount: {
            $gt: 0,
          },

          $or: [
            {
              lastFeeReminderSentAt: {
                $exists: false,
              },
            },
            {
              lastFeeReminderSentAt: null,
            },
            {
              lastFeeReminderSentAt: {
                $lte: intervalThreshold,
              },
            },
          ],
        },
        {
          $set: {
            lastFeeReminderSentAt: now,
          },

          $inc: {
            feeReminderCount: 1,
          },
        },
        {
          new: true,
        },
      );

    if (!claimedStudent) {
      return null;
    }

    return {
      claimedAt: now,
    };
  }

  private async releaseReminderLock(
    studentId: string,
    claimedAt: Date,
  ) {
    await this.studentModel.updateOne(
      {
        _id: studentId,
        lastFeeReminderSentAt: claimedAt,
      },
      {
        $unset: {
          lastFeeReminderSentAt: 1,
        },
        $inc: {
          feeReminderCount: -1,
        },
      },
    );
  }

  /*
   * Every fee-setup-complete student has a single fixed
   * Fee Ending Date, regardless of how many payments they make
   * before then. A reminder goes out once that date is reached
   * and the fee is still not fully paid.
   */
  @Cron(
    '0 0 * * * *',
    {
      timeZone:
        'Asia/Kolkata',
    },
  )
  async checkFeeNotifications() {
    try {
      const notificationSettings =
        await this.settingsService
          .getNotificationSettings();

      if (
        !notificationSettings
          .whatsappEnabled ||
        !notificationSettings
          .overdueReminderEnabled
      ) {
        return;
      }

      const intervalDays =
        Math.max(
          1,
          Number(
            notificationSettings
              .overdueReminderIntervalDays ||
              3,
          ),
        );

      const today =
        this.getTodayStart();

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

          feeDueDate: {
            $lte:
              today,
          },
        });

      for (
        const student of
          students
      ) {
        try {
          if (student.muteAllFeeNotifications || student.muteFeeReminderNotification) {
            continue;
          }

          if (
            !student.feeDueDate
          ) {
            this.logger.warn(
              `Fee due date missing for student ${student.studentName}`,
            );

            continue;
          }

          const reminderAmount =
            Number(
              student.pendingAmount ||
                0,
            );

          if (
            !Number.isFinite(
              reminderAmount,
            ) ||
            reminderAmount <= 0
          ) {
            continue;
          }

          const reminderLock =
            await this.acquireReminderLock(
              student,
              intervalDays,
            );

          if (!reminderLock) {
            this.logger.debug(
              `Duplicate reminder skipped for ${student.studentName}`,
            );

            continue;
          }

          try {
            await this.whatsappService
              .sendFeePaymentReminder(
                {
                  phone:
                    student.phone,

                  parentName:
                    student.parentName,

                  studentName:
                    student.studentName,

                  studentId:
                    student._id.toString(),

                  pendingAmount:
                    reminderAmount,

                  dueDate:
                    student.feeDueDate,
                },
              );

            this.logger.log(
              `Fee reminder sent to ${student.studentName}. Amount: ${reminderAmount}`,
            );
          } catch (sendError) {
            await this.releaseReminderLock(
              student._id.toString(),
              reminderLock.claimedAt,
            );

            throw sendError;
          }
        } catch (
          error
        ) {
          this.logger.error(
            `Fee notification failed for ${student.studentName}: ${
              error instanceof
              Error
                ? error.message
                : String(
                    error,
                  )
            }`,
          );
        }
      }
    } catch (
      error
    ) {
      this.logger.error(
        `Automatic fee notification check failed: ${
          error instanceof
          Error
            ? error.message
            : String(
                error,
              )
        }`,
      );
    }
  }
}
