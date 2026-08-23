import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { InjectModel } from '@nestjs/mongoose';

import { Model } from 'mongoose';

import {
  Payment,
  PaymentDocument,
} from './payments.schema';

import {
  PaymentSetting,
  PaymentSettingDocument,
} from './payments-settings.schema';

import {
  Student,
  StudentDocument,
} from '../student/students.schema';

import { SettingsService } from '../settings/settings.service';

import { InvoiceService } from '../invoice/invoice.service';

import { WhatsappService } from '../whatsapp/whatsapp.service';

type FeeSetupData = {
  totalFee: number;

  feeType:
    | 'monthly'
    | 'partial'
    | 'yearly';

  feeStartingDate?: string;

  feeEndingDate?: string;

  selectedMonths?: number;
};

@Injectable()
export class PaymentsService {
  constructor(
    @InjectModel(Payment.name)
    private readonly paymentModel:
      Model<PaymentDocument>,

    @InjectModel(PaymentSetting.name)
    private readonly paymentSettingModel:
      Model<PaymentSettingDocument>,

    @InjectModel(Student.name)
    private readonly studentModel:
      Model<StudentDocument>,

    private readonly settingsService:
      SettingsService,

    private readonly invoiceService:
      InvoiceService,

    private readonly whatsappService:
      WhatsappService,
  ) {}

  private getBillingMonth(
    date: Date,
  ) {
    const year =
      date.getFullYear();

    const month =
      String(
        date.getMonth() + 1,
      ).padStart(
        2,
        '0',
      );

    return `${year}-${month}`;
  }

  private roundMoney(
    value: number,
  ) {
    return Number(
      Number(
        value || 0,
      ).toFixed(2),
    );
  }

  private getTodayStart() {
    const today =
      new Date();

    today.setHours(
      0,
      0,
      0,
      0,
    );

    return today;
  }

  private parseFeeDate(
    value: string,
    label: string,
  ) {
    const parsed =
      new Date(
        `${value}T00:00:00`,
      );

    if (
      Number.isNaN(
        parsed.getTime(),
      )
    ) {
      throw new BadRequestException(
        `Invalid ${label}`,
      );
    }

    return parsed;
  }


  private getMonthDayDate(
    year: number,
    monthIndex: number,
    day: number,
  ) {
    const lastDay =
      new Date(
        year,
        monthIndex + 1,
        0,
      ).getDate();

    return new Date(
      year,
      monthIndex,
      Math.min(
        Math.max(
          Number(day) || 1,
          1,
        ),
        lastDay,
      ),
      0,
      0,
      0,
      0,
    );
  }

  private getRecurringFeeCycleDates(
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

    const currentStart =
      this.getMonthDayDate(
        year,
        month,
        startDay,
      );

    let currentDue:
      Date;

    if (
      Number(dueDay) >=
      Number(startDay)
    ) {
      currentDue =
        this.getMonthDayDate(
          year,
          month,
          dueDay,
        );
    } else {
      currentDue =
        this.getMonthDayDate(
          year,
          month + 1,
          dueDay,
        );
    }

    /*
     * If today's date is already after this cycle's due date,
     * move to the next recurring cycle.
     */
    if (
      reference >
      currentDue
    ) {
      const nextStart =
        this.getMonthDayDate(
          year,
          month + 1,
          startDay,
        );

      const nextDue =
        Number(dueDay) >=
        Number(startDay)
          ? this.getMonthDayDate(
              year,
              month + 1,
              dueDay,
            )
          : this.getMonthDayDate(
              year,
              month + 2,
              dueDay,
            );

      return {
        feeStartingDate:
          nextStart,

        feeEndingDate:
          nextDue,
      };
    }

    /*
     * If we are before this month's configured start day,
     * the upcoming current-month cycle is used.
     * If we are inside the cycle, the same cycle is used.
     */
    return {
      feeStartingDate:
        currentStart,

      feeEndingDate:
        currentDue,
    };
  }

  private buildMonthlyInstallments(
    totalFee: number,
    selectedMonths: number,
  ) {
    if (
      !Number.isInteger(
        selectedMonths,
      ) ||
      selectedMonths < 1
    ) {
      throw new BadRequestException(
        'Selected months must be a positive whole number',
      );
    }

    /*
     * Monthly installments must be whole rupee values.
     * Any division remainder is added to the FINAL installment.
     *
     * Example:
     * ₹40,000 / 14
     * Month 1-13 = ₹2,857
     * Month 14   = ₹2,859
     * Total      = ₹40,000 exactly.
     */
    const normalizedTotalFee =
      Number(totalFee);

    if (
      !Number.isFinite(
        normalizedTotalFee,
      ) ||
      normalizedTotalFee <= 0
    ) {
      throw new BadRequestException(
        'Total fee must be greater than 0',
      );
    }

    if (
      !Number.isInteger(
        normalizedTotalFee,
      )
    ) {
      throw new BadRequestException(
        'Monthly total fee must be a whole rupee amount without decimals',
      );
    }

    if (
      normalizedTotalFee <
      selectedMonths
    ) {
      throw new BadRequestException(
        'Monthly duration is too high for the configured total fee',
      );
    }

    const baseAmount =
      Math.floor(
        normalizedTotalFee /
          selectedMonths,
      );

    const finalAmount =
      normalizedTotalFee -
      baseAmount *
        (selectedMonths - 1);

    return Array.from(
      {
        length:
          selectedMonths,
      },
      (_, index) => ({
        installmentNumber:
          index + 1,

        amount:
          index ===
          selectedMonths - 1
            ? finalAmount
            : baseAmount,

        status:
          'unpaid' as
            | 'unpaid'
            | 'paid',

        paidAt:
          undefined,

        paymentId:
          undefined,
      }),
    );
  }

  private ensureMonthlyInstallments(
    student: StudentDocument,
  ) {
    if (
      student.feeType !==
      'monthly'
    ) {
      return;
    }

    const selectedMonths =
      Number(
        student.selectedMonths ||
          0,
      );

    if (
      !Number.isInteger(
        selectedMonths,
      ) ||
      selectedMonths < 1
    ) {
      throw new BadRequestException(
        'Monthly duration is not configured',
      );
    }

    if (
      Array.isArray(
        student.monthlyInstallments,
      ) &&
      student.monthlyInstallments.length ===
        selectedMonths
    ) {
      return;
    }

    const installments =
      this.buildMonthlyInstallments(
        Number(
          student.totalFee ||
            0,
        ),
        selectedMonths,
      );

    /*
     * Backward compatibility for students created
     * before installment schedules existed.
     */
    const oldPaidMonths =
      Math.min(
        Number(
          student.paidMonths ||
            0,
        ),
        selectedMonths,
      );

    for (
      let index = 0;
      index < oldPaidMonths;
      index += 1
    ) {
      installments[index].status =
        'paid';
    }

    student.monthlyInstallments =
      installments;
  }

  private recalculateMonthlyStudent(
    student: StudentDocument,
  ) {
    const installments =
      Array.isArray(
        student.monthlyInstallments,
      )
        ? student.monthlyInstallments
        : [];

    const paidInstallments =
      installments.filter(
        (installment) =>
          installment.status ===
          'paid',
      );

    const paidAmount =
      this.roundMoney(
        paidInstallments.reduce(
          (
            total,
            installment,
          ) =>
            total +
            Number(
              installment.amount ||
                0,
            ),
          0,
        ),
      );

    const totalFee =
      this.roundMoney(
        Number(
          student.totalFee ||
            0,
        ),
      );

    const pendingAmount =
      this.roundMoney(
        Math.max(
          0,
          totalFee -
            paidAmount,
        ),
      );

    student.paidMonths =
      paidInstallments.length;

    student.paidAmount =
      Math.min(
        paidAmount,
        totalFee,
      );

    student.pendingAmount =
      pendingAmount;

    if (
      paidInstallments.length ===
      0
    ) {
      student.paymentStatus =
        'unpaid';
    } else if (
      paidInstallments.length ===
        installments.length &&
      pendingAmount <= 0
    ) {
      student.paymentStatus =
        'paid';
    } else {
      student.paymentStatus =
        'partial';
    }
  }

  private validateBulkStudent(
    student: StudentDocument,
    mode: 'common' | 'course',
  ) {
    const paidAmount =
      Number(
        student.paidAmount || 0,
      );

    /*
     * Monthly / Partial plans must NEVER be overwritten by
     * Common or Course Wise fee setup.
     */
    if (
      student.feeSetupCompleted &&
      (
        student.feeType ===
          'monthly' ||
        student.feeType ===
          'partial'
      )
    ) {
      return {
        allowed: false,

        reason:
          `${student.feeType === 'monthly' ? 'Monthly' : 'Partial'} fee plan is already active`,
      };
    }

    if (paidAmount > 0) {
      return {
        allowed: false,

        reason:
          'Payment already started for this student',
      };
    }

    /*
     * Common fee must not overwrite a student whose fee was
     * already generated through Course Wise setup.
     *
     * Course Wise setup IS allowed to replace an earlier
     * Common yearly setup for students of that selected course,
     * provided payment has not started.
     */
    if (
      mode === 'common' &&
      student.feeSetupCompleted &&
      student.feeSetupSource ===
        'course'
    ) {
      return {
        allowed: false,

        reason:
          'Course wise fee is already configured for this student',
      };
    }

    return {
      allowed: true,

      reason: null,
    };
  }

  async setFeeDueDate(
    feeDueDate: string,
  ) {
    const parsedDate =
      new Date(
        `${feeDueDate}T00:00:00`,
      );

    if (
      Number.isNaN(
        parsedDate.getTime(),
      )
    ) {
      throw new BadRequestException(
        'Invalid fee due date',
      );
    }

    let setting =
      await this.paymentSettingModel.findOne({
        isActive: true,
      });

    if (!setting) {
      setting =
        new this.paymentSettingModel({
          feeDueDate:
            parsedDate,

          isActive:
            true,
        });
    } else {
      setting.feeDueDate =
        parsedDate;
    }

    await setting.save();

    return {
      message:
        'Fee due date updated successfully',

      feeDueDate:
        setting.feeDueDate,
    };
  }

  async getFeeDueDate() {
    const setting =
      await this.paymentSettingModel
        .findOne({
          isActive: true,
        })
        .sort({
          updatedAt: -1,
        });

    return {
      feeDueDate:
        setting?.feeDueDate ||
        null,
    };
  }

  async getPublicPaymentSettings() {
    const setting =
      await this.paymentSettingModel
        .findOne({
          isActive: true,
        })
        .sort({
          updatedAt: -1,
        });

    return {
      upiId:
        setting?.upiId ||
        '',

      receiverName:
        setting?.receiverName ||
        '',

      paymentPhone:
        setting?.paymentPhone ||
        '',

      upiQrImage:
        setting?.upiQrImage ||
        '',

      feeDueDate:
        setting?.feeDueDate ||
        null,
    };
  }

  async updatePublicPaymentSettings(
    data: {
      upiId?: string;
      receiverName?: string;
      paymentPhone?: string;
      upiQrImage?: string;
    },
  ) {
    const upiId =
      String(
        data.upiId ||
          '',
      ).trim();

    const receiverName =
      String(
        data.receiverName ||
          '',
      ).trim();

    const paymentPhone =
      String(
        data.paymentPhone ||
          '',
      )
        .replace(
          /\D/g,
          '',
        )
        .trim();

    const upiQrImage =
      String(
        data.upiQrImage ||
          '',
      ).trim();

    if (
      !upiId ||
      !upiId.includes('@')
    ) {
      throw new BadRequestException(
        'Enter a valid UPI ID',
      );
    }

    if (!receiverName) {
      throw new BadRequestException(
        'Receiver name is required',
      );
    }

    if (
      !/^[6-9]\d{9}$/.test(
        paymentPhone,
      )
    ) {
      throw new BadRequestException(
        'Enter a valid 10 digit payment phone number',
      );
    }

    if (!upiQrImage) {
      throw new BadRequestException(
        'Payment QR image is required',
      );
    }

    let setting =
      await this.paymentSettingModel
        .findOne({
          isActive: true,
        })
        .sort({
          updatedAt: -1,
        });

    if (!setting) {
      setting =
        new this.paymentSettingModel({
          feeDueDate:
            new Date(),

          isActive:
            true,
        });
    }

    setting.upiId =
      upiId;

    setting.receiverName =
      receiverName;

    setting.paymentPhone =
      paymentPhone;

    setting.upiQrImage =
      upiQrImage;

    setting.isActive =
      true;

    await setting.save();

    return {
      message:
        'UPI payment settings updated successfully',

      upiId:
        setting.upiId,

      receiverName:
        setting.receiverName,

      paymentPhone:
        setting.paymentPhone,

      upiQrImage:
        setting.upiQrImage,

      feeDueDate:
        setting.feeDueDate,
    };
  }

  async getPublicStudentPayment(
    studentId: string,
  ) {
    const cleanStudentId =
      String(
        studentId ||
          '',
      )
        .replace(
          /\{\{1\}\}/g,
          '',
        )
        .split('?')[0]
        .trim();

    if (
      !/^[a-fA-F0-9]{24}$/.test(
        cleanStudentId,
      )
    ) {
      throw new BadRequestException(
        'Invalid student payment link',
      );
    }

    const student =
      await this.studentModel.findById(
        cleanStudentId,
      );

    if (!student) {
      throw new NotFoundException(
        'Student not found',
      );
    }

    if (
      !student.feeSetupCompleted
    ) {
      throw new BadRequestException(
        'Fee has not been setup for this student',
      );
    }

    const setting =
      await this.paymentSettingModel
        .findOne({
          isActive: true,
        })
        .sort({
          updatedAt: -1,
        });

    return {
      student: {
        id:
          student._id,

        studentName:
          student.studentName,

        rollNo:
          student.rollNo,

        course:
          student.course,

        batch:
          student.batch,

        paymentStatus:
          student.paymentStatus,

        paymentAmount:
          Number(
            student.pendingAmount ||
              0,
          ),
      },

      payment: {
        feeDueDate:
          student.feeEndingDate ||
          setting?.feeDueDate ||
          null,

        upiId:
          setting?.upiId ||
          '',

        receiverName:
          setting?.receiverName ||
          '',

        paymentPhone:
          setting?.paymentPhone ||
          '',

        upiQrImage:
          setting?.upiQrImage ||
          '',
      },
    };
  }

  async getPayments() {
    return this.paymentModel
      .find()
      .sort({
        paymentDate: -1,
      });
  }

  async getPaymentById(
    id: string,
  ) {
    const payment =
      await this.paymentModel.findById(
        id,
      );

    if (!payment) {
      throw new NotFoundException(
        'Payment record not found',
      );
    }

    return payment;
  }

  /*
   * ==================================================
   * 1. INDIVIDUAL STUDENT FEE SETUP
   * ==================================================
   */

  async setupStudentFee(
    studentId: string,
    data: FeeSetupData,
    setupSource:
      | 'individual'
      | 'common'
      | 'course' =
      'individual',
  ) {
    const student =
      await this.studentModel.findById(
        studentId,
      );

    if (!student) {
      throw new NotFoundException(
        'Student not found',
      );
    }

    const feeSettings =
      await this.settingsService.getFeeSettings();

    const totalFee =
      this.roundMoney(
        Number(
          data.totalFee,
        ),
      );

    if (
      !Number.isFinite(
        totalFee,
      ) ||
      totalFee <= 0
    ) {
      throw new BadRequestException(
        'Total fee must be greater than 0',
      );
    }

    const today =
      this.getTodayStart();

    let feeStartingDate:
      Date;

    let feeEndingDate:
      Date;

    if (
      data.feeType ===
        'monthly' ||
      data.feeType ===
        'partial'
    ) {
      const recurringCycle =
        this.getRecurringFeeCycleDates(
          Number(
            feeSettings.recurringFeeStartDay ||
              1,
          ),
          Number(
            feeSettings.recurringFeeDueDay ||
              10,
          ),
          today,
        );

      feeStartingDate =
        recurringCycle.feeStartingDate;

      feeEndingDate =
        recurringCycle.feeEndingDate;
    } else {
      if (
        !data.feeStartingDate
      ) {
        throw new BadRequestException(
          'Fee starting date is required for yearly fee setup',
        );
      }

      if (
        !data.feeEndingDate
      ) {
        throw new BadRequestException(
          'Fee ending date is required for yearly fee setup',
        );
      }

      feeStartingDate =
        this.parseFeeDate(
          data.feeStartingDate,
          'fee starting date',
        );

      feeEndingDate =
        this.parseFeeDate(
          data.feeEndingDate,
          'fee ending date',
        );

      if (
        feeStartingDate <
        today
      ) {
        throw new BadRequestException(
          'Fee starting date cannot be in the past',
        );
      }

      if (
        feeEndingDate <
        today
      ) {
        throw new BadRequestException(
          'Fee ending date cannot be in the past',
        );
      }

      if (
        feeEndingDate <
        feeStartingDate
      ) {
        throw new BadRequestException(
          'Fee ending date cannot be before fee starting date',
        );
      }
    }

    if (
      data.feeType ===
        'monthly' &&
      !feeSettings.monthlyFeeEnabled
    ) {
      throw new BadRequestException(
        'Monthly fee payment is disabled in settings',
      );
    }

    if (
      data.feeType ===
        'partial' &&
      !feeSettings.partialFeeEnabled
    ) {
      throw new BadRequestException(
        'Partial fee payment is disabled in settings',
      );
    }

    if (
      data.feeType ===
        'yearly' &&
      !feeSettings.yearlyFeeEnabled
    ) {
      throw new BadRequestException(
        'Yearly fee payment is disabled in settings',
      );
    }

    let selectedMonths:
      | number
      | undefined;

    let monthlyAmount =
      0;

    if (
      data.feeType ===
      'monthly'
    ) {
      selectedMonths =
        Number(
          data.selectedMonths ??
            feeSettings.defaultMonths,
        );

      if (
        !Number.isInteger(
          selectedMonths,
        ) ||
        selectedMonths <
          1
      ) {
        throw new BadRequestException(
          'Selected months must be a positive whole number',
        );
      }

      const installments =
        this.buildMonthlyInstallments(
          totalFee,
          selectedMonths,
        );

      monthlyAmount =
        Number(
          installments[0]
            ?.amount ||
            0,
        );

      student.monthlyInstallments =
        installments;
    } else {
      student.monthlyInstallments =
        [];
    }

    student.totalFee =
      totalFee;

    student.feeType =
      data.feeType;

    student.feeSetupSource =
      setupSource;

    student.feeStartingDate =
      feeStartingDate;

    student.feeEndingDate =
      feeEndingDate;

    student.feeSetupCompleted =
      true;

    student.paidAmount =
      0;

    student.pendingAmount =
      totalFee;

    student.paymentStatus =
      'unpaid';

    student.paymentMethod =
      undefined;

    student.paidMonths =
      0;

    student.lastFeeReminderSentAt =
      undefined;

    student.feeReminderCount =
      0;

    if (
      data.feeType ===
      'monthly'
    ) {
      student.selectedMonths =
        selectedMonths;

      student.monthlyAmount =
        monthlyAmount;
    } else {
      student.selectedMonths =
        undefined;

      student.monthlyAmount =
        0;
    }

    await student.save();

    const invoice =
      await this.invoiceService
        .createFeeSetupInvoice(
          student._id.toString(),
        );

    /*
     * Invoice / WhatsApp behaviour is intentionally left
     * unchanged in this fees-side implementation.
     * We will update those flows separately after fees logic
     * is fully tested.
     */
    // Preserve fee -> invoice -> WhatsApp order without blocking the API response.
    void (async () => {
      try {
      const notificationSettings =
        await this.settingsService
          .getNotificationSettings();

      if (
        notificationSettings.whatsappEnabled &&
        invoice
      ) {
        const pdfBuffer =
          await this.invoiceService
            .generateInvoicePdfByDocument(
              invoice,
            );

        await this.whatsappService
          .sendFeePaymentInvoice({
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
              student.feeType!,

            /*
             * Fee creation WhatsApp message amount rule:
             *
             * Monthly:
             *   Send ONLY the current unpaid installment amount.
             *
             * Partial:
             *   Send the student's current remaining balance.
             *
             * Yearly:
             *   Send the student's current remaining balance.
             *
             * The invoice snapshot already contains the exact
             * current payable amount used by the invoice.
             */
            pendingAmount:
              student.feeType ===
              'monthly'
                ? Number(
                    invoice.fee
                      ?.currentPayableAmount ||
                      student.monthlyInstallments
                        ?.find(
                          (
                            installment,
                          ) =>
                            installment.status !==
                            'paid',
                        )
                        ?.amount ||
                      student.monthlyAmount ||
                      0,
                  )
                : Number(
                    student.pendingAmount ||
                      0,
                  ),

            feeEndingDate:
              student.feeEndingDate!,

            pdfBuffer,

            invoiceNumber:
              invoice.invoiceNumber,
          });
      }
      } catch (error) {
      console.error(
        'Fee invoice WhatsApp message failed:',
        error,
      );
      }
    })();

    return {
      message:
        invoice
          ? 'Student fee setup completed and invoice generated successfully'
          : 'Student fee setup completed successfully',

      setupMode:
        'individual',

      student,

      invoice,

      calculation: {
        totalFee:
          student.totalFee,

        feeType:
          student.feeType,

        feeStartingDate:
          student.feeStartingDate,

        feeEndingDate:
          student.feeEndingDate,

        recurringFeeStartDay:
          data.feeType === 'monthly' ||
          data.feeType === 'partial'
            ? feeSettings.recurringFeeStartDay
            : null,

        recurringFeeDueDay:
          data.feeType === 'monthly' ||
          data.feeType === 'partial'
            ? feeSettings.recurringFeeDueDay
            : null,

        selectedMonths:
          student.selectedMonths ||
          null,

        monthlyAmount:
          student.monthlyAmount,

        monthlyInstallments:
          student.feeType ===
          'monthly'
            ? student.monthlyInstallments
            : [],

        minimumPartialAmount:
          null,
      },
    };
  }

  /*
   * ==================================================
   * 2. COMMON FEE + COMMON END DATE
   * ==================================================
   */

  async setupCommonFee(
    data: FeeSetupData,
  ) {
    const feeSettings =
      await this.settingsService.getFeeSettings();

    if (
      !feeSettings.commonFeeSetupEnabled
    ) {
      throw new BadRequestException(
        'Common fee setup is disabled in settings',
      );
    }

    if (
      !feeSettings.yearlyFeeEnabled
    ) {
      throw new BadRequestException(
        'Yearly fee payment is disabled in settings',
      );
    }

    const bulkData: FeeSetupData = {
      ...data,
      feeType: 'yearly',
      selectedMonths: undefined,
    };

    const students =
      await this.studentModel.find({});

    if (
      students.length === 0
    ) {
      throw new NotFoundException(
        'No students found',
      );
    }

    const successStudents:
      any[] = [];

    const skippedStudents:
      any[] = [];

    const failedStudents:
      any[] = [];

    for (
      const student of students
    ) {
      const validation =
        this.validateBulkStudent(
          student,
          'common',
        );

      if (
        !validation.allowed
      ) {
        skippedStudents.push({
          studentId:
            student._id,

          studentName:
            student.studentName,

          rollNo:
            student.rollNo,

          course:
            student.course,

          reason:
            validation.reason,
        });

        continue;
      }

      try {
        const result =
          await this.setupStudentFee(
            student._id.toString(),
            bulkData,
            'common',
          );

        successStudents.push({
          studentId:
            student._id,

          studentName:
            student.studentName,

          rollNo:
            student.rollNo,

          course:
            student.course,

          invoiceNumber:
            result.invoice
              ?.invoiceNumber ||
            null,
        });
      } catch (error) {
        failedStudents.push({
          studentId:
            student._id,

          studentName:
            student.studentName,

          rollNo:
            student.rollNo,

          course:
            student.course,

          reason:
            error instanceof Error
              ? error.message
              : String(error),
        });
      }
    }

    return {
      message:
        'Common fee setup completed',

      setupMode:
        'common',

      totalStudents:
        students.length,

      successCount:
        successStudents.length,

      skippedCount:
        skippedStudents.length,

      failedCount:
        failedStudents.length,

      commonFee: {
        totalFee:
          Number(
            bulkData.totalFee,
          ),

        feeType:
          'yearly',

        feeEndingDate:
          bulkData.feeEndingDate,

        selectedMonths:
          null,
      },

      successStudents,

      skippedStudents,

      failedStudents,
    };
  }

  /*
   * ==================================================
   * 3. COURSE-WISE FEE + COURSE END DATE
   * ==================================================
   */

  async setupCourseWiseFee(
    course: string,
    data: FeeSetupData,
  ) {
    const feeSettings =
      await this.settingsService.getFeeSettings();

    if (
      !feeSettings.courseWiseFeeSetupEnabled
    ) {
      throw new BadRequestException(
        'Course wise fee setup is disabled in settings',
      );
    }

    if (
      !feeSettings.yearlyFeeEnabled
    ) {
      throw new BadRequestException(
        'Yearly fee payment is disabled in settings',
      );
    }

    const bulkData: FeeSetupData = {
      ...data,
      feeType: 'yearly',
      selectedMonths: undefined,
    };

    const courseName =
      decodeURIComponent(
        String(
          course || '',
        ),
      ).trim();

    if (!courseName) {
      throw new BadRequestException(
        'Course is required',
      );
    }

    /*
     * Case insensitive exact match.
     */
    const escapedCourse =
      courseName.replace(
        /[.*+?^${}()|[\]\\]/g,
        '\\$&',
      );

    const students =
      await this.studentModel.find({
        course: {
          $regex:
            `^${escapedCourse}$`,

          $options:
            'i',
        },
      });

    if (
      students.length === 0
    ) {
      throw new NotFoundException(
        `No students found for ${courseName}`,
      );
    }

    const successStudents:
      any[] = [];

    const skippedStudents:
      any[] = [];

    const failedStudents:
      any[] = [];

    for (
      const student of students
    ) {
      const validation =
        this.validateBulkStudent(
          student,
          'course',
        );

      if (
        !validation.allowed
      ) {
        skippedStudents.push({
          studentId:
            student._id,

          studentName:
            student.studentName,

          rollNo:
            student.rollNo,

          course:
            student.course,

          reason:
            validation.reason,
        });

        continue;
      }

      try {
        const result =
          await this.setupStudentFee(
            student._id.toString(),
            bulkData,
            'course',
          );

        successStudents.push({
          studentId:
            student._id,

          studentName:
            student.studentName,

          rollNo:
            student.rollNo,

          course:
            student.course,

          invoiceNumber:
            result.invoice
              ?.invoiceNumber ||
            null,
        });
      } catch (error) {
        failedStudents.push({
          studentId:
            student._id,

          studentName:
            student.studentName,

          rollNo:
            student.rollNo,

          course:
            student.course,

          reason:
            error instanceof Error
              ? error.message
              : String(error),
        });
      }
    }

    return {
      message:
        `${courseName} course fee setup completed`,

      setupMode:
        'course',

      course:
        courseName,

      totalStudents:
        students.length,

      successCount:
        successStudents.length,

      skippedCount:
        skippedStudents.length,

      failedCount:
        failedStudents.length,

      courseFee: {
        totalFee:
          Number(
            bulkData.totalFee,
          ),

        feeType:
          'yearly',

        feeEndingDate:
          bulkData.feeEndingDate,

        selectedMonths:
          null,
      },

      successStudents,

      skippedStudents,

      failedStudents,
    };
  }

  /*
   * ==================================================
   * COLLECT PAYMENT
   * ==================================================
   */

  async collectStudentPayment(
    studentId: string,
    data: {
      paymentMethod:
        | 'cash'
        | 'bank'
        | 'upi'
        | 'qr';

      amount?: number;

      installmentNumber?:
        number;
    },
  ) {
    const student =
      await this.studentModel.findById(
        studentId,
      );

    if (!student) {
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

    const totalFee =
      this.roundMoney(
        Number(
          student.totalFee ||
            0,
        ),
      );

    const currentPendingAmount =
      this.roundMoney(
        Number(
          student.pendingAmount ||
            0,
        ),
      );

    if (
      currentPendingAmount <= 0 ||
      student.paymentStatus ===
        'paid'
    ) {
      throw new BadRequestException(
        'Student fee is already fully paid',
      );
    }

    let paymentAmount =
      0;

    let installmentNumber:
      number | undefined;

    if (
      student.feeType ===
      'monthly'
    ) {
      this.ensureMonthlyInstallments(
        student,
      );

      const installments =
        student.monthlyInstallments ||
        [];

      const currentInstallment =
        installments.find(
          (installment) =>
            installment.status ===
            'unpaid',
        );

      if (!currentInstallment) {
        throw new BadRequestException(
          'All monthly installments are already completed',
        );
      }

      if (
        data.installmentNumber !==
          undefined &&
        Number(
          data.installmentNumber,
        ) !==
          Number(
            currentInstallment.installmentNumber,
          )
      ) {
        throw new BadRequestException(
          `Month ${currentInstallment.installmentNumber} is the current payable installment`,
        );
      }

      installmentNumber =
        Number(
          currentInstallment.installmentNumber,
        );

      paymentAmount =
        this.roundMoney(
          Number(
            currentInstallment.amount ||
              0,
          ),
        );

      if (
        paymentAmount <= 0
      ) {
        throw new BadRequestException(
          'Current monthly installment amount is invalid',
        );
      }

      /*
       * Do not mark the installment paid yet.
       * First create the Payment transaction successfully.
       */
    } else if (
      student.feeType ===
      'partial'
    ) {
      const enteredAmount =
        this.roundMoney(
          Number(
            data.amount,
          ),
        );

      if (
        !Number.isFinite(
          enteredAmount,
        ) ||
        enteredAmount <= 0
      ) {
        throw new BadRequestException(
          'Enter a valid partial payment amount',
        );
      }

      if (
        enteredAmount >
        currentPendingAmount
      ) {
        throw new BadRequestException(
          `Payment cannot be greater than pending amount ₹${currentPendingAmount}`,
        );
      }

      paymentAmount =
        enteredAmount;
    } else if (
      student.feeType ===
      'yearly'
    ) {
      paymentAmount =
        currentPendingAmount;
    } else {
      throw new BadRequestException(
        'Student fee type is not configured',
      );
    }

    const payment =
      await this.createPayment({
        studentId:
          student._id.toString(),

        studentName:
          student.studentName,

        phone:
          student.phone,

        course:
          student.course,

        amount:
          paymentAmount,

        paymentMethod:
          data.paymentMethod,

        feeType:
          student.feeType,

        installmentNumber,
      });

    if (
      student.feeType ===
      'monthly'
    ) {
      const installment =
        student.monthlyInstallments.find(
          (item) =>
            Number(
              item.installmentNumber,
            ) ===
            installmentNumber,
        );

      if (!installment) {
        /*
         * Payment record exists, so fail loudly instead of
         * silently corrupting installment state.
         */
        throw new BadRequestException(
          'Monthly installment record not found',
        );
      }

      installment.status =
        'paid';

      installment.paidAt =
        payment.paymentDate;

      installment.paymentId =
        payment._id;

      this.recalculateMonthlyStudent(
        student,
      );
    } else {
      const newPaidAmount =
        this.roundMoney(
          Math.min(
            totalFee,
            Number(
              student.paidAmount ||
                0,
            ) +
              paymentAmount,
          ),
        );

      const newPendingAmount =
        this.roundMoney(
          Math.max(
            0,
            totalFee -
              newPaidAmount,
          ),
        );

      student.paidAmount =
        newPaidAmount;

      student.pendingAmount =
        newPendingAmount;

      student.paymentStatus =
        newPendingAmount <= 0
          ? 'paid'
          : 'partial';
    }

    student.paymentMethod =
      data.paymentMethod;

    if (
      student.paymentStatus ===
      'paid'
    ) {
      student.lastFeeReminderSentAt =
        undefined;
    }

    await student.save();

    const invoice =
      await this.invoiceService
        .createPaymentReceiptInvoice(
          student._id.toString(),
          payment._id.toString(),
        );

    /*
     * Receipt / WhatsApp flow is intentionally preserved.
     * We will modify invoice/message content separately.
     */
    try {
      const notificationSettings =
        await this.settingsService
          .getNotificationSettings();

      if (
        notificationSettings.whatsappEnabled &&
        invoice
      ) {
        const pdfBuffer =
          await this.invoiceService
            .generateInvoicePdfByDocument(
              invoice,
            );

        await this.whatsappService
          .sendFeePaymentReceipt({
            phone:
              student.phone,

            parentName:
              student.parentName,

            studentName:
              student.studentName,

            paidAmount:
              Number(
                payment.amount ||
                  paymentAmount,
              ),

            paymentMethod:
              data.paymentMethod,

            paymentDate:
              payment.paymentDate,

            remainingBalance:
              Number(
                student.pendingAmount ||
                  0,
              ),

            pdfBuffer,

            receiptNumber:
              invoice.invoiceNumber,
          });
      }
    } catch (error) {
      console.error(
        'Payment receipt WhatsApp message failed:',
        error,
      );
    }

    const currentMonthlyInstallment =
      student.feeType ===
      'monthly'
        ? student.monthlyInstallments.find(
            (item) =>
              item.status ===
              'unpaid',
          ) ||
          null
        : null;

    return {
      message:
        student.paymentStatus ===
        'paid'
          ? invoice
            ? 'Fee payment completed and receipt generated successfully'
            : 'Fee payment completed successfully'
          : invoice
            ? 'Payment collected and receipt generated successfully'
            : 'Payment collected successfully',

      payment,

      invoice,

      student: {
        id:
          student._id,

        studentName:
          student.studentName,

        rollNo:
          student.rollNo,

        course:
          student.course,

        batch:
          student.batch,

        feeType:
          student.feeType,

        totalFee:
          student.totalFee,

        paidAmount:
          student.paidAmount,

        pendingAmount:
          student.pendingAmount,

        selectedMonths:
          student.selectedMonths ||
          null,

        monthlyAmount:
          student.monthlyAmount,

        monthlyInstallments:
          student.feeType ===
          'monthly'
            ? student.monthlyInstallments
            : [],

        currentInstallment:
          currentMonthlyInstallment,

        paidMonths:
          student.paidMonths,

        paymentStatus:
          student.paymentStatus,

        paymentMethod:
          student.paymentMethod,
      },
    };
  }

  /*
   * ==================================================
   * CREATE PAYMENT RECORD
   * ==================================================
   */

  async createPayment(
    data: {
      studentId: string;

      studentName: string;

      phone: string;

      course: string;

      amount: number;

      paymentMethod:
        | 'cash'
        | 'bank'
        | 'upi'
        | 'qr';

      feeType?:
        | 'monthly'
        | 'partial'
        | 'yearly';

      installmentNumber?:
        number;
    },
  ) {
    const setting =
      await this.paymentSettingModel
        .findOne({
          isActive: true,
        })
        .sort({
          updatedAt: -1,
        });

    const billingDate =
      setting?.feeDueDate
        ? new Date(
            setting.feeDueDate,
          )
        : new Date();

    const billingMonth =
      this.getBillingMonth(
        billingDate,
      );

    const payment =
      new this.paymentModel({
        studentId:
          data.studentId,

        studentName:
          data.studentName,

        phone:
          data.phone,

        course:
          data.course,

        amount:
          this.roundMoney(
            data.amount,
          ),

        billingMonth,

        paymentMethod:
          data.paymentMethod,

        feeType:
          data.feeType,

        installmentNumber:
          data.installmentNumber,

        paymentStatus:
          'paid',

        paymentDate:
          new Date(),
      });

    return payment.save();
  }

  async clearStudentPaymentHistory(
    studentId: string,
  ) {
    const student =
      await this.studentModel.findById(
        studentId,
      );

    if (!student) {
      throw new NotFoundException(
        'Student not found',
      );
    }

    const result =
      await this.paymentModel.deleteMany({
        studentId:
          student._id,
      });

    /*
     * Clearing history must not alter accounting totals
     * or monthly Paid/Unpaid state. Only transaction links
     * and payment timestamps are removed from the schedule.
     */
    if (
      student.feeType ===
        'monthly' &&
      Array.isArray(
        student.monthlyInstallments,
      )
    ) {
      for (
        const installment of
          student.monthlyInstallments
      ) {
        installment.paymentId =
          undefined;

        if (
          installment.status ===
          'paid'
        ) {
          installment.paidAt =
            undefined;
        }
      }

      await student.save();
    }

    return {
      message:
        'Payment history cleared successfully',

      deletedCount:
        Number(
          result.deletedCount ||
            0,
        ),

      studentId:
        student._id,
    };
  }

  /*
   * ==================================================
   * RESET STUDENT FEE
   * ==================================================
   */

  async resetStudentFee(
    studentId: string,
  ) {
    const student =
      await this.studentModel.findById(
        studentId,
      );

    if (!student) {
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

    await this.paymentModel.deleteMany({
      studentId:
        student._id,
    });

    await this.invoiceService
      .deactivateStudentInvoices(
        student._id.toString(),
      );

    student.totalFee =
      0;

    student.feeType =
      undefined;

    student.feeSetupSource =
      undefined;

    student.feeStartingDate =
      undefined;

    student.feeEndingDate =
      undefined;

    student.feeSetupCompleted =
      false;

    student.selectedMonths =
      undefined;

    student.monthlyAmount =
      0;

    student.monthlyInstallments =
      [];

    student.paidMonths =
      0;

    student.paidAmount =
      0;

    student.pendingAmount =
      0;

    student.paymentStatus =
      'unpaid';

    student.paymentMethod =
      undefined;

    student.lastFeeReminderSentAt =
      undefined;

    student.feeReminderCount =
      0;

    await student.save();

    return {
      message:
        'Fee setup reset successfully. You can setup the student fee again from the beginning.',

      student: {
        id:
          student._id,

        studentName:
          student.studentName,

        totalFee:
          student.totalFee,

        feeType:
          null,

        feeStartingDate:
          null,

        feeEndingDate:
          null,

        feeSetupCompleted:
          student.feeSetupCompleted,

        selectedMonths:
          null,

        monthlyAmount:
          student.monthlyAmount,

        paidMonths:
          student.paidMonths,

        paidAmount:
          student.paidAmount,

        pendingAmount:
          student.pendingAmount,

        paymentStatus:
          student.paymentStatus,

        paymentMethod:
          null,
      },
    };
  }
}
