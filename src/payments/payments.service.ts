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

  async setupStudentFee(
    studentId: string,
    data: {
      totalFee: number;

      feeType:
        | 'monthly'
        | 'partial'
        | 'yearly';

      feeEndingDate: string;

      selectedMonths?: number;
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

    student.paidAmount = 0;

    student.pendingAmount =
      this.roundMoney(
        totalFee,
      );

    student.paymentStatus =
      'unpaid';

    student.paymentMethod =
      undefined;

    student.paidMonths = 0;

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

      student.monthlyAmount = 0;
    }

    await student.save();

    const invoice =
      await this.invoiceService.createFeeSetupInvoice(
        student._id.toString(),
      );

    try {
      const notificationSettings =
        await this.settingsService.getNotificationSettings();

      if (
        notificationSettings.whatsappEnabled &&
        invoice
      ) {
        const pdfBuffer =
          await this.invoiceService.generateInvoicePdfByDocument(
            invoice,
          );

        await this.whatsappService.sendFeePaymentInvoice(
          {
            phone:
              student.phone,

            parentName:
              student.parentName,

            studentName:
              student.studentName,

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
          },
        );
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
      await this.settingsService.getFeeSettings();

    let paymentAmount = 0;

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
      await this.invoiceService.createPaymentReceiptInvoice(
        student._id.toString(),
        payment._id.toString(),
      );

    try {
      const notificationSettings =
        await this.settingsService.getNotificationSettings();

      if (
        notificationSettings.whatsappEnabled &&
        invoice
      ) {
        const pdfBuffer =
          await this.invoiceService.generateInvoicePdfByDocument(
            invoice,
          );

        await this.whatsappService.sendFeePaymentReceipt(
          {
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
          },
        );
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

    await this.invoiceService.deactivateStudentInvoices(
      student._id.toString(),
    );

    student.totalFee = 0;

    student.feeType =
      undefined;

    student.feeEndingDate =
      undefined;

    student.feeSetupCompleted =
      false;

    student.selectedMonths =
      undefined;

    student.monthlyAmount = 0;

    student.paidMonths = 0;

    student.paidAmount = 0;

    student.pendingAmount = 0;

    student.paymentStatus =
      'unpaid';

    student.paymentMethod =
      undefined;

    student.lastFeeReminderSentAt =
      undefined;

    student.feeReminderCount = 0;

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