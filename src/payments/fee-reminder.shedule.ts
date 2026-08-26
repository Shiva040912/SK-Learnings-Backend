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

  /*
   * ==================================================
   * DATE HELPERS
   * ==================================================
   */

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
    /*
     * If user configured 31 but month has only 30 / 28 days,
     * automatically use the last available day of that month.
     */
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

  /*
   * Gets the recurring Monthly / Partial cycle which
   * contains the current date.
   *
   * Example:
   * Start Day = 1
   * Due Day   = 10
   *
   * 01 Sep -> 10 Sep
   * 01 Oct -> 10 Oct
   *
   * If Due Day is before Start Day:
   * Start Day = 25
   * Due Day   = 5
   *
   * 25 Sep -> 05 Oct
   */
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

  /*
   * ==================================================
   * MONTHLY / PARTIAL
   * MONTH START INVOICE MESSAGE
   * ==================================================
   */

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

    /*
     * Invoice is sent only on configured Start Day.
     */
    if (
      !this.isSameDate(
        today,
        currentMonthStart,
      )
    ) {
      return;
    }

    /*
     * Cron runs every hour.
     * Never send the same month's invoice multiple times
     * on the same Start Day.
     */
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

    /*
     * If a payment was already received on this cycle's
     * Start Day before the cron executes, do not immediately
     * ask for another payment.
     */
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

    /*
     * Update student's visible recurring dates so that
     * newly generated invoice always shows the CURRENT
     * month's Start / Due date.
     */
    student.feeStartingDate =
      cycle.cycleStart;

    student.feeEndingDate =
      cycle.cycleDue;

    /*
     * A new monthly cycle starts here.
     * Old cycle reminder timestamp must not block the
     * new cycle's reminder.
     */
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

    /*
     * Monthly:
     * invoiceAmount/currentPayable = current month's installment.
     *
     * Partial:
     * current payable = current remaining balance.
     */
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

  /*
   * ==================================================
   * REMINDER RULE
   * ==================================================
   *
   * YEARLY:
   * Due date reached -> repeat reminder until full fee paid.
   *
   * MONTHLY:
   * Current cycle due date reached -> repeat reminder until
   * one payment for the current monthly cycle is completed.
   *
   * PARTIAL:
   * Current cycle due date reached -> repeat reminder until
   * at least one partial payment is received in that cycle.
   *
   * Next month creates a fresh cycle.
   * ==================================================
   */

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

    /*
     * Reminder starts on the Due Day itself.
     */
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

    /*
     * Monthly / Partial:
     * One payment in this month's cycle means that
     * cycle's reminder is complete.
     */
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

  private canSendByInterval(
    student:
      StudentDocument,
    intervalDays:
      number,
    cycleStart?:
      Date,
  ) {
    if (
      !student.lastFeeReminderSentAt
    ) {
      return true;
    }

    const lastSentDate =
      new Date(
        student.lastFeeReminderSentAt,
      );

    /*
     * Monthly / Partial new cycle:
     * Previous month's reminder must not block this cycle.
     */
    if (
      cycleStart &&
      lastSentDate <
        cycleStart
    ) {
      return true;
    }

    const nextReminderDate =
      new Date(
        lastSentDate,
      );

    nextReminderDate.setDate(
      nextReminderDate.getDate() +
        intervalDays,
    );

    return (
      new Date() >=
      nextReminderDate
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

    /*
     * Partial + Yearly reminder:
     * send remaining balance.
     */
    return Number(
      student.pendingAmount ||
        0,
    );
  }

  /*
   * ==================================================
   * MAIN CRON
   * ==================================================
   *
   * Runs every hour.
   *
   * 1. On Monthly / Partial Start Day:
   *    Generates fresh invoice + sends invoice message.
   *
   * 2. On / after Due Day:
   *    Sends reminders using configured repeat interval.
   *
   * 3. Paid students are ignored.
   * ==================================================
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

      /*
       * No WhatsApp notification should be sent
       * when WhatsApp is disabled.
       */
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
          /*
           * ==========================================
           * STEP 1
           * MONTHLY / PARTIAL START-DAY INVOICE
           * ==========================================
           */
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

          /*
           * Reminder functionality can independently
           * be disabled while recurring invoice message
           * still continues.
           */
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

          /*
           * ==========================================
           * YEARLY REMINDER
           * ==========================================
           */
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

            /*
             * Reminder begins ON the ending date.
             */
            reminderDue =
              today >=
              yearlyDueDate;
          } else {
            /*
             * ==========================================
             * MONTHLY / PARTIAL REMINDER
             * ==========================================
             */
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

            /*
             * Keep current recurring dates synchronized
             * even if the invoice message could not be
             * generated because invoice feature is off.
             */
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

          /*
           * Repeat only according to configured
           * overdue reminder interval.
           */
          const canSendReminder =
            this.canSendByInterval(
              student,
              intervalDays,
              reminderCycleStart,
            );

          if (
            !canSendReminder
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

          await this.whatsappService
            .sendFeeDueReminder(
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
                  reminderAmount,
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
            `${student.feeType} fee reminder sent to ${student.studentName}. Amount: ${reminderAmount}`,
          );
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