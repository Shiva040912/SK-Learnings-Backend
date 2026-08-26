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
  Payment,
  PaymentDocument,
} from './payments.schema';

import {
  SettingsService,
} from '../settings/settings.service';

import {
  WhatsappService,
} from '../whatsapp/whatsapp.service';

import {
  InvoiceService,
} from '../invoice/invoice.service';

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

    @InjectModel(Payment.name)
    private readonly paymentModel:
      Model<PaymentDocument>,

    private readonly settingsService:
      SettingsService,

    private readonly whatsappService:
      WhatsappService,

    private readonly invoiceService:
      InvoiceService,
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

  private getMonthDayDate(
    year: number,
    month: number,
    requestedDay: number,
  ) {
    
    const lastDay =
      new Date(
        year,
        month + 1,
        0,
      ).getDate();

    const safeDay =
      Math.min(
        Math.max(
          Number(
            requestedDay ||
              1,
          ),
          1,
        ),
        lastDay,
      );

    const date =
      new Date(
        year,
        month,
        safeDay,
      );

    date.setHours(
      0,
      0,
      0,
      0,
    );

    return date;
  }

  private isSameDate(
    first:
      Date | string,
    second:
      Date | string,
  ) {
    const firstDate =
      new Date(
        first,
      );

    const secondDate =
      new Date(
        second,
      );

    return (
      firstDate.getFullYear() ===
        secondDate.getFullYear() &&
      firstDate.getMonth() ===
        secondDate.getMonth() &&
      firstDate.getDate() ===
        secondDate.getDate()
    );
  }

  
  private getCurrentRecurringCycle(
    startDay: number,
    dueDay: number,
    referenceDate =
      new Date(),
  ) {
    const reference =
      new Date(
        referenceDate,
      );

    reference.setHours(
      0,
      0,
      0,
      0,
    );

    const year =
      reference.getFullYear();

    const month =
      reference.getMonth();

    const thisMonthStart =
      this.getMonthDayDate(
        year,
        month,
        startDay,
      );

    let cycleStart:
      Date;

    if (
      reference >=
      thisMonthStart
    ) {
      cycleStart =
        thisMonthStart;
    } else {
      cycleStart =
        this.getMonthDayDate(
          year,
          month - 1,
          startDay,
        );
    }

    const startYear =
      cycleStart.getFullYear();

    const startMonth =
      cycleStart.getMonth();

    const cycleDue =
      Number(
        dueDay,
      ) >=
      Number(
        startDay,
      )
        ? this.getMonthDayDate(
            startYear,
            startMonth,
            dueDay,
          )
        : this.getMonthDayDate(
            startYear,
            startMonth + 1,
            dueDay,
          );

    return {
      cycleStart,
      cycleDue,
    };
  }

  private async hasPaymentInCycle(
    student:
      StudentDocument,
    cycleStart:
      Date,
  ) {
    const payment =
      await this.paymentModel
        .findOne({
          studentId:
            student._id,

          paymentDate: {
            $gte:
              cycleStart,
          },
        })
        .sort({
          paymentDate:
            -1,
        })
        .lean();

    return Boolean(
      payment,
    );
  }

  private async wasFeeInvoiceSentToday(
    studentId:
      string,
    today:
      Date,
  ) {
    const invoices =
      await this.invoiceService
        .getStudentInvoices(
          studentId,
        );

    const latestFeeInvoice =
      invoices.find(
        (
          invoice,
        ) =>
          invoice.invoiceType ===
          'fee_setup',
      );

    if (
      !latestFeeInvoice
    ) {
      return false;
    }

    return this.isSameDate(
      latestFeeInvoice.invoiceDate,
      today,
    );
  }

 

  private async sendRecurringInvoiceIfRequired(
    student:
      StudentDocument,
    recurringStartDay:
      number,
    recurringDueDay:
      number,
    today:
      Date,
  ) {
    if (student.muteAllFeeNotifications) {
      return;
    }

    if (
      student.feeType !==
        'partial'
    ) {
      return;
    }

    if (
      student.paymentStatus ===
        'paid' ||
      Number(
        student.pendingAmount ||
          0,
      ) <= 0
    ) {
      return;
    }

    const currentMonthStart =
      this.getMonthDayDate(
        today.getFullYear(),
        today.getMonth(),
        recurringStartDay,
      );

    
    if (
      !this.isSameDate(
        today,
        currentMonthStart,
      )
    ) {
      return;
    }

    
    const alreadySentToday =
      await this.wasFeeInvoiceSentToday(
        student._id.toString(),
        today,
      );

    if (
      alreadySentToday
    ) {
      return;
    }

   
    const paidInCurrentCycle =
      await this.hasPaymentInCycle(
        student,
        currentMonthStart,
      );

    if (
      paidInCurrentCycle
    ) {
      return;
    }

    const cycle =
      this.getCurrentRecurringCycle(
        recurringStartDay,
        recurringDueDay,
        today,
      );

    
    student.feeStartingDate =
      cycle.cycleStart;

    student.feeEndingDate =
      cycle.cycleDue;

    
    student.lastFeeReminderSentAt =
      undefined;

    await student.save();

    const invoice =
      await this.invoiceService
        .createFeeSetupInvoice(
          student._id.toString(),
        );

    if (
      !invoice
    ) {
      this.logger.warn(
        `Recurring invoice not generated for ${student.studentName}. Invoice generation may be disabled.`,
      );

      return;
    }

    const pdfBuffer =
      await this.invoiceService
        .generateInvoicePdfByDocument(
          invoice,
        );

    
    const messagePendingAmount =
      Number(student.pendingAmount || 0);

    await this.whatsappService
      .sendFeePaymentInvoice(
        {
          phone:
            student.phone,

          parentName:
            student.parentName,

          studentName:
            student.studentName,

          studentId:
            student._id.toString(),

          totalFee:
            Number(
              student.totalFee ||
                0,
            ),

          feeType:
            student.feeType,

          pendingAmount:
            messagePendingAmount,

          feeEndingDate:
            cycle.cycleDue,

          pdfBuffer,

          invoiceNumber:
            invoice.invoiceNumber,
        },
      );

    this.logger.log(
      `Recurring ${student.feeType} invoice sent to ${student.studentName}`,
    );
  }

  

  private async shouldSendRecurringReminder(
    student:
      StudentDocument,
    recurringStartDay:
      number,
    recurringDueDay:
      number,
    today:
      Date,
  ) {
    const cycle =
      this.getCurrentRecurringCycle(
        recurringStartDay,
        recurringDueDay,
        today,
      );

   
    if (
      today <
      cycle.cycleDue
    ) {
      return {
        shouldSend:
          false,

        cycle,
      };
    }

   
    const paymentReceived =
      await this.hasPaymentInCycle(
        student,
        cycle.cycleStart,
      );

    if (
      paymentReceived
    ) {
      return {
        shouldSend:
          false,

        cycle,
      };
    }

    return {
      shouldSend:
        true,

      cycle,
    };
  }

  private async acquireReminderLock(
    student: StudentDocument,
    intervalDays: number,
    cycleStart?: Date,
  ) {
    const now = new Date();

    const intervalThreshold = new Date(now);
    intervalThreshold.setDate(
      intervalThreshold.getDate() - intervalDays,
    );

    let allowedBefore = intervalThreshold;

    if (cycleStart && cycleStart > allowedBefore) {
      allowedBefore = cycleStart;
    }

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
                $lte: allowedBefore,
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

  private getReminderAmount(
    student:
      StudentDocument,
  ) {
    if (
      student.feeType ===
      'monthly'
    ) {
      const currentInstallment =
        (
          student.monthlyInstallments ||
          []
        ).find(
          (
            installment,
          ) =>
            installment.status !==
            'paid',
        );

      return Number(
        currentInstallment
          ?.amount ||
          student.monthlyAmount ||
          student.pendingAmount ||
          0,
      );
    }

    
    return Number(
      student.pendingAmount ||
        0,
    );
  }

  

  @Cron(
    '0 0 * * * *',
    {
      timeZone:
        'Asia/Kolkata',
    },
  )
  async checkFeeNotifications() {
    try {
      const [
        notificationSettings,
        feeSettings,
      ] =
        await Promise.all([
          this.settingsService
            .getNotificationSettings(),

          this.settingsService
            .getFeeSettings(),
        ]);

      
      if (
        !notificationSettings
          .whatsappEnabled
      ) {
        return;
      }

      const recurringStartDay =
        Number(
          feeSettings
            .recurringFeeStartDay ||
            1,
        );

      const recurringDueDay =
        Number(
          feeSettings
            .recurringFeeDueDay ||
            10,
        );

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

          feeType: {
            $in: [
              'partial',
              'yearly',
            ],
          },
        });

      for (
        const student of
          students
      ) {
        try {
          
          if (
            student.feeType ===
              'partial'
          ) {
            await this.sendRecurringInvoiceIfRequired(
              student,
              recurringStartDay,
              recurringDueDay,
              today,
            );
          }

          
          if (
            !notificationSettings
              .overdueReminderEnabled
          ) {
            continue;
          }

          if (student.muteAllFeeNotifications || student.muteFeeReminderNotification) {
            continue;
          }

          let reminderDue =
            false;

          let reminderCycleStart:
            Date | undefined;

          
          if (
            student.feeType ===
            'yearly'
          ) {
            if (
              !student.feeEndingDate
            ) {
              this.logger.warn(
                `Fee ending date missing for yearly student ${student.studentName}`,
              );

              continue;
            }

            const yearlyDueDate =
              new Date(
                student.feeEndingDate,
              );

            yearlyDueDate.setHours(
              0,
              0,
              0,
              0,
            );

           
            reminderDue =
              today >=
              yearlyDueDate;
          } else {
            
            const recurringReminder =
              await this.shouldSendRecurringReminder(
                student,
                recurringStartDay,
                recurringDueDay,
                today,
              );

            reminderDue =
              recurringReminder
                .shouldSend;

            reminderCycleStart =
              recurringReminder
                .cycle
                .cycleStart;

            
            if (
              !this.isSameDate(
                student.feeStartingDate ||
                  recurringReminder
                    .cycle
                    .cycleStart,
                recurringReminder
                  .cycle
                  .cycleStart,
              ) ||
              !this.isSameDate(
                student.feeEndingDate ||
                  recurringReminder
                    .cycle
                    .cycleDue,
                recurringReminder
                  .cycle
                  .cycleDue,
              )
            ) {
              student.feeStartingDate =
                recurringReminder
                  .cycle
                  .cycleStart;

              student.feeEndingDate =
                recurringReminder
                  .cycle
                  .cycleDue;

              await student.save();
            }
          }

          if (
            !reminderDue
          ) {
            continue;
          }

          const reminderAmount =
            this.getReminderAmount(
              student,
            );

          if (
            !Number.isFinite(
              reminderAmount,
            ) ||
            reminderAmount <= 0
          ) {
            continue;
          }

          
          const reminderDueDate =
            student.feeType ===
            'yearly'
              ? student.feeEndingDate
              : this.getCurrentRecurringCycle(
                  recurringStartDay,
                  recurringDueDay,
                  today,
                ).cycleDue;

          if (!reminderDueDate) {
            this.logger.warn(
              `Reminder due date missing for ${student.studentName}`,
            );

            continue;
          }

          const reminderLock =
            await this.acquireReminderLock(
              student,
              intervalDays,
              reminderCycleStart,
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
                    reminderDueDate,
                },
              );

            this.logger.log(
              `${student.feeType} fee reminder sent to ${student.studentName}. Amount: ${reminderAmount}`,
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