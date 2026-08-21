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

  feeEndingDate: string;

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

  private validateBulkStudent(
    student: StudentDocument,
  ) {
    const paidAmount =
      Number(
        student.paidAmount || 0,
      );

    /*
     * Bulk setup must not reset an
     * already started payment.
     */
    if (paidAmount > 0) {
      return {
        allowed: false,

        reason:
          'Payment already started for this student',
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
      Number(
        data.totalFee,
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

    const feeEndingDate =
      new Date(
        `${data.feeEndingDate}T00:00:00`,
      );

    if (
      Number.isNaN(
        feeEndingDate.getTime(),
      )
    ) {
      throw new BadRequestException(
        'Invalid fee ending date',
      );
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

    let monthlyAmount = 0;

    if (
      data.feeType ===
      'monthly'
    ) {
      selectedMonths =
        Number(
          data.selectedMonths ??
            feeSettings.defaultMonths,
        );

      const minimumMonths =
        Number(
          feeSettings.minimumMonths,
        );

      const maximumMonths =
        Number(
          feeSettings.maximumMonths,
        );

      if (
        !Number.isInteger(
          selectedMonths,
        )
      ) {
        throw new BadRequestException(
          'Selected months must be a whole number',
        );
      }

      if (
        selectedMonths <
          minimumMonths ||
        selectedMonths >
          maximumMonths
      ) {
        throw new BadRequestException(
          `Monthly duration must be between ${minimumMonths} and ${maximumMonths} months`,
        );
      }

      monthlyAmount =
        this.roundMoney(
          totalFee /
            selectedMonths,
        );
    }

    student.totalFee =
      this.roundMoney(
        totalFee,
      );

    student.feeType =
      data.feeType;

    student.feeEndingDate =
      feeEndingDate;

    student.feeSetupCompleted =
      true;

    student.paidAmount =
      0;

    student.pendingAmount =
      this.roundMoney(
        totalFee,
      );

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
              student.feeType,

            pendingAmount:
              Number(
                student.pendingAmount ||
                  0,
              ),

            feeEndingDate:
              student.feeEndingDate,

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

        selectedMonths:
          student.selectedMonths ||
          null,

        monthlyAmount:
          student.monthlyAmount,

        minimumPartialAmount:
          data.feeType ===
          'partial'
            ? feeSettings.minimumPartialAmount
            : null,
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
            data,
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
            data.totalFee,
          ),

        feeType:
          data.feeType,

        feeEndingDate:
          data.feeEndingDate,

        selectedMonths:
          data.selectedMonths ||
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
            data,
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
            data.totalFee,
          ),

        feeType:
          data.feeType,

        feeEndingDate:
          data.feeEndingDate,

        selectedMonths:
          data.selectedMonths ||
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

    const pendingAmount =
      this.roundMoney(
        student.pendingAmount,
      );

    if (
      pendingAmount <= 0 ||
      student.paymentStatus ===
        'paid'
    ) {
      throw new BadRequestException(
        'Student fee is already fully paid',
      );
    }

    const feeSettings =
      await this.settingsService
        .getFeeSettings();

    let paymentAmount =
      0;

    if (
      student.feeType ===
      'monthly'
    ) {
      const selectedMonths =
        Number(
          student.selectedMonths ||
            0,
        );

      const paidMonths =
        Number(
          student.paidMonths ||
            0,
        );

      if (
        selectedMonths <= 0
      ) {
        throw new BadRequestException(
          'Monthly duration is not configured',
        );
      }

      if (
        paidMonths >=
        selectedMonths
      ) {
        throw new BadRequestException(
          'All monthly payments are already completed',
        );
      }

      const nextPaidMonth =
        paidMonths + 1;

      const isLastMonth =
        nextPaidMonth ===
        selectedMonths;

      if (isLastMonth) {
        paymentAmount =
          pendingAmount;
      } else {
        paymentAmount =
          Math.min(
            this.roundMoney(
              student.monthlyAmount,
            ),
            pendingAmount,
          );
      }

      student.paidMonths =
        nextPaidMonth;
    } else if (
      student.feeType ===
      'partial'
    ) {
      const enteredAmount =
        Number(
          data.amount,
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
        pendingAmount
      ) {
        throw new BadRequestException(
          `Payment cannot be greater than pending amount ₹${pendingAmount}`,
        );
      }

      const minimumPartialAmount =
        Number(
          feeSettings.minimumPartialAmount,
        );

      const isFinalPayment =
        this.roundMoney(
          enteredAmount,
        ) ===
        pendingAmount;

      if (
        !isFinalPayment &&
        enteredAmount <
          minimumPartialAmount
      ) {
        throw new BadRequestException(
          `Minimum partial payment is ₹${minimumPartialAmount}`,
        );
      }

      paymentAmount =
        this.roundMoney(
          enteredAmount,
        );
    } else if (
      student.feeType ===
      'yearly'
    ) {
      paymentAmount =
        pendingAmount;
    } else {
      throw new BadRequestException(
        'Student fee type is not configured',
      );
    }

    const newPaidAmount =
      this.roundMoney(
        Number(
          student.paidAmount ||
            0,
        ) +
          paymentAmount,
      );

    const newPendingAmount =
      this.roundMoney(
        Math.max(
          0,
          Number(
            student.totalFee,
          ) -
            newPaidAmount,
        ),
      );

    student.paidAmount =
      newPaidAmount;

    student.pendingAmount =
      newPendingAmount;

    student.paymentMethod =
      data.paymentMethod;

    student.paymentStatus =
      newPendingAmount <= 0
        ? 'paid'
        : 'partial';

    if (
      student.paymentStatus ===
      'paid'
    ) {
      student.lastFeeReminderSentAt =
        undefined;
    }

    await student.save();

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
      });

    const invoice =
      await this.invoiceService
        .createPaymentReceiptInvoice(
          student._id.toString(),
          payment._id.toString(),
        );

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

        paymentStatus:
          'paid',

        paymentDate:
          new Date(),
      });

    return payment.save();
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

    student.feeEndingDate =
      undefined;

    student.feeSetupCompleted =
      false;

    student.selectedMonths =
      undefined;

    student.monthlyAmount =
      0;

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