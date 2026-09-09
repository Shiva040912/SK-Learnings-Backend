import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { InjectModel } from '@nestjs/mongoose';

import { Model, Types } from 'mongoose';

import {
  Payment,
  PaymentDocument,
} from './payments.schema';

import {
  PaymentSetting,
  PaymentSettingDocument,
} from './payments-settings.schema';

import {
  PaymentProof,
  PaymentProofDocument,
} from './payment-proof.schema';

import {
  Student,
  StudentDocument,
} from '../student/students.schema';

import { SettingsService } from '../settings/settings.service';

import { InvoiceService } from '../invoice/invoice.service';

import { WhatsappService } from '../whatsapp/whatsapp.service';

import {
  computeFeeDueDate,
  isValidFeeDueDay,
} from './fee-due-date.util';

type FeeSetupData = {
  totalFee: number;

  feeDueDay: number;
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

    @InjectModel(PaymentProof.name)
    private readonly paymentProofModel:
      Model<PaymentProofDocument>,

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
     * A legacy Monthly plan must never be overwritten by
     * Common or Course Wise fee setup.
     */
    if (
      student.feeSetupCompleted &&
      student.feeType ===
        'monthly'
    ) {
      return {
        allowed: false,

        reason:
          'Monthly fee plan is already active',
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

  private getYearlyBulkFeeValues(data: FeeSetupData) {
    const totalFee = this.roundMoney(Number(data.totalFee));
    if (!Number.isFinite(totalFee) || totalFee <= 0) {
      throw new BadRequestException('Total fee must be greater than 0');
    }
    if (!isValidFeeDueDay(data.feeDueDay)) {
      throw new BadRequestException('Due Day must be a whole number between 1 and 31');
    }
    const feeStartingDate = this.getTodayStart();
    const feeDueDate = computeFeeDueDate(data.feeDueDay, feeStartingDate);
    return { totalFee, feeDueDay: data.feeDueDay, feeStartingDate, feeDueDate };
  }

  private async applyBulkYearlyFee(
    students: StudentDocument[],
    setupSource: 'common' | 'course',
    data: FeeSetupData,
  ) {
    const { totalFee, feeDueDay, feeStartingDate, feeDueDate } =
      this.getYearlyBulkFeeValues(data);
    if (students.length === 0) return;

    await this.studentModel.updateMany(
      { _id: { $in: students.map((student) => student._id) } },
      {
        $set: {
          totalFee,
          feeType: 'yearly',
          feeSetupSource: setupSource,
          feeStartingDate,
          feeDueDay,
          feeDueDate,
          feeSetupCompleted: true,
          paidAmount: 0,
          pendingAmount: totalFee,
          paymentStatus: 'unpaid',
          paidMonths: 0,
          monthlyAmount: 0,
          monthlyInstallments: [],
          feeReminderCount: 0,
        },
        $unset: {
          paymentMethod: 1,
          selectedMonths: 1,
          lastFeeReminderSentAt: 1,
          feeEndingDate: 1,
        },
      },
    );

    void this.processBulkFeeInvoices(
      students.map((student) => student._id.toString()),
    );
  }

  private async processBulkFeeInvoices(studentIds: string[]) {
    const concurrency = Math.min(4, studentIds.length);
    let nextIndex = 0;
    const worker = async () => {
      while (nextIndex < studentIds.length) {
        const studentId = studentIds[nextIndex++];
        try {
          const invoice =
            await this.invoiceService.createFeeSetupInvoice(studentId);
          if (!invoice) continue;
          const [student, notificationSettings] = await Promise.all([
            this.studentModel.findById(studentId),
            this.settingsService.getNotificationSettings(),
          ]);
          if (
            !student ||
            !notificationSettings.whatsappEnabled ||
            student.muteAllFeeNotifications
          ) continue;
          const pdfBuffer =
            await this.invoiceService.generateInvoicePdfByDocument(invoice);
          await this.whatsappService.sendFeePaymentInvoice({
            phone: student.phone,
            parentName: student.parentName,
            studentName: student.studentName,
            studentId,
            totalFee: Number(student.totalFee || 0),
            feeType: student.feeType!,
            pendingAmount: Number(student.pendingAmount || 0),
            feeEndingDate: student.feeDueDate!,
            pdfBuffer,
            invoiceNumber: invoice.invoiceNumber,
          });
        } catch (error) {
          console.error(
            `Background bulk fee invoice processing failed for ${studentId}:`,
            error,
          );
        }
      }
    };
    await Promise.all(
      Array.from({ length: concurrency }, () => worker()),
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

  private sanitizePublicStudentId(
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

    return cleanStudentId;
  }

  async getPublicStudentPayment(
    studentId: string,
  ) {
    const cleanStudentId =
      this.sanitizePublicStudentId(
        studentId,
      );

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

    const hasPendingProof =
      Boolean(
        await this.paymentProofModel.exists({
          studentId: student._id,
          status: 'pending',
        }),
      );

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

        hasPendingProof,
      },

      payment: {
        feeDueDate:
          student.feeDueDate ||
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

  /*
   * ==================================================
   * PAYMENT PROOF (student-uploaded screenshot)
   * ==================================================
   * Lifecycle: pending (uploaded, unverified) -> processed (Admin recorded
   * the payment, or dismissed a stale proof). Uploading a proof never
   * changes paidAmount/pendingAmount/paymentStatus by itself — only the
   * Admin recording the payment (collectStudentPayment, below) does that.
   */

  private static readonly MAX_PROOF_IMAGE_DATA_LENGTH = 6_000_000;

  async submitPaymentProof(
    studentId: string,
    data: {
      imageData: string;
      amountClaimed?: number;
    },
  ) {
    const cleanStudentId =
      this.sanitizePublicStudentId(
        studentId,
      );

    const student =
      await this.studentModel.findById(
        cleanStudentId,
      );

    if (!student) {
      throw new NotFoundException(
        'Student not found',
      );
    }

    if (!student.feeSetupCompleted) {
      throw new BadRequestException(
        'Fee has not been setup for this student',
      );
    }

    if (student.paymentStatus === 'paid') {
      throw new BadRequestException(
        'Fee is already fully paid',
      );
    }

    if (
      typeof data.imageData !== 'string' ||
      !/^data:image\/(png|jpe?g|webp);base64,/i.test(data.imageData)
    ) {
      throw new BadRequestException(
        'Upload a valid image (PNG, JPG or WEBP)',
      );
    }

    if (
      data.imageData.length >
      PaymentsService.MAX_PROOF_IMAGE_DATA_LENGTH
    ) {
      throw new BadRequestException(
        'Image is too large. Please upload a smaller screenshot',
      );
    }

    const existingPendingProof =
      await this.paymentProofModel.findOne({
        studentId: student._id,
        status: 'pending',
      });

    if (existingPendingProof) {
      throw new BadRequestException(
        'A payment proof is already pending verification. Please wait for admin to process it before submitting another.',
      );
    }

    const proof = await this.paymentProofModel.create({
      studentId: student._id,
      imageData: data.imageData,
      amountClaimed:
        typeof data.amountClaimed === 'number'
          ? this.roundMoney(data.amountClaimed)
          : null,
      status: 'pending',
    });

    return {
      message:
        'Payment proof submitted successfully. Please wait for admin verification.',
      proofId: proof._id,
      status: proof.status,
    };
  }

  // Admin Payments page: lightweight list to merge onto the table rows so
  // the red "unverified proof" indicator is backend-driven, not local state.
  async getPendingPaymentProofs() {
    const proofs = await this.paymentProofModel
      .find({ status: 'pending' })
      .select('studentId amountClaimed createdAt')
      .lean();

    return proofs.map((proof) => ({
      studentId: String(proof.studentId),
      proofId: String(proof._id),
      amountClaimed: proof.amountClaimed ?? null,
      uploadedAt: (proof as unknown as { createdAt: Date }).createdAt,
    }));
  }

  // Non-`_id` ObjectId fields (studentId here) are not auto-cast from a
  // plain string by this Mongoose version the way `_id` is — cast
  // explicitly so a string param actually matches stored ObjectId values.
  private toStudentObjectId(studentId: string) {
    if (!/^[a-fA-F0-9]{24}$/.test(String(studentId || ''))) {
      throw new BadRequestException('Invalid student id');
    }

    return new Types.ObjectId(studentId);
  }

  // Admin verification popup: the screenshot itself plus what the student
  // claimed, so the Admin can cross-check before entering the real amount.
  async getStudentPaymentProof(studentId: string) {
    const proof = await this.paymentProofModel
      .findOne({
        studentId: this.toStudentObjectId(studentId),
        status: 'pending',
      })
      .sort({ createdAt: -1 });

    if (!proof) {
      throw new NotFoundException(
        'No pending payment proof found for this student',
      );
    }

    return {
      proofId: proof._id,
      imageData: proof.imageData,
      amountClaimed: proof.amountClaimed ?? null,
      uploadedAt: (proof as unknown as { createdAt: Date }).createdAt,
    };
  }

  // Lets the Admin clear a stale proof (e.g. the balance was already
  // settled through another channel) without recording a payment for it.
  async dismissPaymentProof(studentId: string, proofId: string) {
    const result = await this.paymentProofModel.updateOne(
      {
        _id: proofId,
        studentId: this.toStudentObjectId(studentId),
        status: 'pending',
      },
      { $set: { status: 'processed', processedAt: new Date() } },
    );

    if (result.modifiedCount !== 1) {
      throw new BadRequestException(
        'Payment proof not found or already processed',
      );
    }

    return { message: 'Payment proof dismissed' };
  }

  async getPayments() {
    return this.paymentModel
      .find({
        deleted: { $ne: true },
      })
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

    if (
      student.feeSetupCompleted &&
      student.paymentStatus !== 'paid'
    ) {
      throw new BadRequestException(
        'Complete the current fee before assigning the next fee',
      );
    }

    const feeSettings =
      await this.settingsService.getFeeSettings();

    if (
      !feeSettings.yearlyFeeEnabled
    ) {
      throw new BadRequestException(
        'Fee setup is disabled in settings',
      );
    }

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

    if (
      !isValidFeeDueDay(
        data.feeDueDay,
      )
    ) {
      throw new BadRequestException(
        'Due Day must be a whole number between 1 and 31',
      );
    }

    const feeStartingDate =
      this.getTodayStart();

    const feeDueDate =
      computeFeeDueDate(
        data.feeDueDay,
        feeStartingDate,
      );

    student.totalFee =
      totalFee;

    student.feeType =
      'yearly';

    student.feeSetupSource =
      setupSource;

    student.feeStartingDate =
      feeStartingDate;

    student.feeDueDay =
      data.feeDueDay;

    student.feeDueDate =
      feeDueDate;

    student.feeEndingDate =
      undefined;

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

    student.selectedMonths =
      undefined;

    student.monthlyAmount =
      0;

    student.monthlyInstallments =
      [];

    await student.save();

    // Persisting the student fee is the only work that must finish before the
    // admin gets a response. Invoice/PDF/WhatsApp processing continues safely
    // in the background, keeping individual setup close to database latency.
    void this.processBulkFeeInvoices([
      student._id.toString(),
    ]);

    return {
      message: 'Student fee setup completed successfully',

      setupMode:
        'individual',

      student,

      invoice: null,

      calculation: {
        totalFee:
          student.totalFee,

        feeDueDay:
          student.feeDueDay,

        feeDueDate:
          student.feeDueDate,
      },
    };
  }

  /*
   * ==================================================
   * 2. COMMON FEE + COMMON END DATE
   * ==================================================
   */

  async editStudentFee(
    studentId: string,
    data: FeeSetupData,
  ) {
    const student = await this.studentModel.findById(studentId);

    if (!student) {
      throw new NotFoundException('Student not found');
    }

    if (!student.feeSetupCompleted) {
      throw new BadRequestException('Student fee setup is not completed');
    }

    const totalFee = this.roundMoney(Number(data.totalFee));
    const paidAmount = this.roundMoney(Number(student.paidAmount || 0));

    if (!Number.isFinite(totalFee) || totalFee <= 0) {
      throw new BadRequestException('Total fee must be greater than 0');
    }

    if (totalFee < paidAmount) {
      throw new BadRequestException(
        `Total fee cannot be less than the already paid amount ${paidAmount}`,
      );
    }

    const feeSettings = await this.settingsService.getFeeSettings();

    if (!feeSettings.yearlyFeeEnabled) {
      throw new BadRequestException('Fee setup is disabled in settings');
    }

    if (!isValidFeeDueDay(data.feeDueDay)) {
      throw new BadRequestException('Due Day must be a whole number between 1 and 31');
    }

    const feeStartingDate = this.getTodayStart();
    const feeDueDate = computeFeeDueDate(data.feeDueDay, feeStartingDate);

    const pendingAmount = this.roundMoney(totalFee - paidAmount);
    student.totalFee = totalFee;
    student.feeType = 'yearly';
    student.feeSetupSource = 'individual';
    student.feeStartingDate = feeStartingDate;
    student.feeDueDay = data.feeDueDay;
    student.feeDueDate = feeDueDate;
    student.feeEndingDate = undefined;
    student.pendingAmount = pendingAmount;
    student.paymentStatus = pendingAmount <= 0 ? 'paid' : paidAmount > 0 ? 'partial' : 'unpaid';
    student.selectedMonths = undefined;
    student.monthlyAmount = 0;
    student.monthlyInstallments = [];
    student.paidMonths = 0;
    student.lastFeeReminderSentAt = undefined;
    student.feeReminderCount = 0;
    await student.save();

    void (async () => {
      try {
        const invoice = await this.invoiceService.createFeeSetupInvoice(
          student._id.toString(),
        );
        if (!invoice) return;

        const notificationSettings =
          await this.settingsService.getNotificationSettings();
        if (
          !notificationSettings.whatsappEnabled ||
          student.muteAllFeeNotifications
        ) return;

        const pdfBuffer =
          await this.invoiceService.generateInvoicePdfByDocument(invoice);
        await this.whatsappService.sendFeePaymentInvoice({
          phone: student.phone,
          parentName: student.parentName,
          studentName: student.studentName,
          studentId: student._id.toString(),
          totalFee: Number(student.totalFee || 0),
          feeType: student.feeType!,
          pendingAmount: Number(student.pendingAmount || 0),
          feeEndingDate: student.feeDueDate!,
          pdfBuffer,
          invoiceNumber: invoice.invoiceNumber,
        });
      } catch (error) {
        console.error('Background edited fee invoice processing failed:', error);
      }
    })();

    return {
      message: 'Fee details updated successfully',
      student,
    };
  }
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
        'Fee setup is disabled in settings',
      );
    }

    const bulkData: FeeSetupData = {
      ...data,
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

    const eligibleStudents: StudentDocument[] = [];

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
        eligibleStudents.push(student);
        successStudents.push({
          studentId:
            student._id,

          studentName:
            student.studentName,

          rollNo:
            student.rollNo,

          course:
            student.course,

          invoiceNumber: null,
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

    await this.applyBulkYearlyFee(
      eligibleStudents,
      'common',
      bulkData,
    );

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

        feeDueDay:
          bulkData.feeDueDay,

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
        'Fee setup is disabled in settings',
      );
    }

    const bulkData: FeeSetupData = {
      ...data,
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

    const eligibleStudents: StudentDocument[] = [];

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
        eligibleStudents.push(student);
        successStudents.push({
          studentId:
            student._id,

          studentName:
            student.studentName,

          rollNo:
            student.rollNo,

          course:
            student.course,

          invoiceNumber: null,
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

    await this.applyBulkYearlyFee(
      eligibleStudents,
      'course',
      bulkData,
    );

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

        feeDueDay:
          bulkData.feeDueDay,

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

      proofId?: string;
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

    // When recording a payment off a student-uploaded proof, validate it
    // up front (before creating anything) so a stale/already-processed
    // proofId is rejected with a clear error instead of silently double
    // counting or overwriting a payment already recorded for it.
    let claimedProof: PaymentProofDocument | null = null;

    if (data.proofId) {
      claimedProof = await this.paymentProofModel.findOne({
        _id: data.proofId,
        studentId: student._id,
      });

      if (!claimedProof) {
        throw new NotFoundException('Payment proof not found');
      }

      if (claimedProof.status !== 'pending') {
        throw new BadRequestException(
          'This payment proof has already been processed',
        );
      }
    }

    if (String(student.feeType) === 'monthly') {
      throw new BadRequestException('Monthly payment collection is no longer available');
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
      student.feeType === 'partial' ||
      student.feeType === 'yearly'
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
          'Enter a valid payment amount',
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

        screenshotImage:
          claimedProof?.imageData ??
          null,

        paymentProofId:
          claimedProof?._id ??
          null,
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

    if (claimedProof) {
      // Payment already succeeded above — this is best-effort bookkeeping,
      // so a rare concurrent-claim race here must not fail the request.
      await this.paymentProofModel.updateOne(
        { _id: claimedProof._id, status: 'pending' },
        {
          $set: {
            status: 'processed',
            paymentId: payment._id,
            processedAt: new Date(),
          },
        },
      );
    }

    const invoice = null;

    /*
     * Payment persistence is the user-facing critical path.
     * Receipt creation, PDF rendering and WhatsApp delivery run in the
     * background so a slow external service never delays the UI update.
     */
    void (async () => {
      try {
        const receiptInvoice =
          await this.invoiceService.createPaymentReceiptInvoice(
            student._id.toString(),
            payment._id.toString(),
          );

        if (!receiptInvoice) return;

        const notificationSettings =
          await this.settingsService.getNotificationSettings();

        if (
          !notificationSettings.whatsappEnabled ||
          student.muteAllFeeNotifications
        ) {
          return;
        }

        const pdfBuffer =
          await this.invoiceService.generateInvoicePdfByDocument(
            receiptInvoice,
          );

        await this.whatsappService.sendFeePaymentReceipt({
          phone: student.phone,
          parentName: student.parentName,
          studentName: student.studentName,
          paidAmount: Number(payment.amount || paymentAmount),
          paymentMethod: data.paymentMethod,
          paymentDate: payment.paymentDate,
          remainingBalance: Number(student.pendingAmount || 0),
          pdfBuffer,
          receiptNumber: receiptInvoice.invoiceNumber,
        });
      } catch (error) {
        console.error(
          'Background payment receipt processing failed:',
          error,
        );
      }
    })();

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

      screenshotImage?: string | null;

      paymentProofId?: Types.ObjectId | null;
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

        screenshotImage:
          data.screenshotImage ??
          null,

        paymentProofId:
          data.paymentProofId ??
          null,
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
   * DELETE ONE PAYMENT HISTORY RECORD
   * ==================================================
   * Unlike clearStudentPaymentHistory (bulk wipe, totals untouched
   * deliberately), deleting a single record is a correction to the
   * transaction log — Paid/Pending/Status must be recalculated from the
   * remaining non-deleted records afterward.
   */
  async deletePaymentHistoryRecord(paymentId: string) {
    const payment =
      await this.paymentModel.findById(paymentId);

    if (!payment) {
      throw new NotFoundException('Payment history record not found');
    }

    if (payment.deleted) {
      throw new BadRequestException(
        'This payment history record is already deleted',
      );
    }

    const student =
      await this.studentModel.findById(payment.studentId);

    if (!student) {
      throw new NotFoundException('Student not found');
    }

    if (student.feeType === 'monthly') {
      throw new BadRequestException(
        'Deleting individual history records is not supported for the monthly fee type',
      );
    }

    payment.deleted = true;
    payment.screenshotImage = null;
    await payment.save();

    // Payment.studentId has always been stored as a plain string (not an
    // ObjectId) by createPayment() — match that existing storage shape
    // rather than an ObjectId, which would never match here.
    const remaining = await this.paymentModel.find({
      studentId: student._id.toString(),
      deleted: { $ne: true },
    });

    const totalFee = this.roundMoney(Number(student.totalFee || 0));

    const newPaidAmount = this.roundMoney(
      remaining.reduce((sum, record) => sum + Number(record.amount || 0), 0),
    );

    const cappedPaidAmount = Math.min(newPaidAmount, totalFee);

    const newPendingAmount = this.roundMoney(
      Math.max(0, totalFee - cappedPaidAmount),
    );

    student.paidAmount = cappedPaidAmount;
    student.pendingAmount = newPendingAmount;
    student.paymentStatus =
      cappedPaidAmount <= 0
        ? 'unpaid'
        : newPendingAmount <= 0
          ? 'paid'
          : 'partial';

    await student.save();

    return {
      message: 'Payment history record deleted successfully',

      student: {
        id: student._id,
        totalFee: student.totalFee,
        paidAmount: student.paidAmount,
        pendingAmount: student.pendingAmount,
        paymentStatus: student.paymentStatus,
      },
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

    student.feeDueDay =
      undefined;

    student.feeDueDate =
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

        feeDueDay:
          null,

        feeDueDate:
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
