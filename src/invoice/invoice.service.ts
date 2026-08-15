import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { InvoicePdfService } from './invoice-pdf.service';

import {
  Invoice,
  InvoiceCounter,
  InvoiceCounterDocument,
  InvoiceDocument,
} from './invoice.schema';

import { Student, StudentDocument } from '../student/students.schema';

import { Payment, PaymentDocument } from '../payments/payments.schema';

import { SettingsService } from '../settings/settings.service';

@Injectable()
export class InvoiceService {
  constructor(
    @InjectModel(Invoice.name)
    private readonly invoiceModel: Model<InvoiceDocument>,

    @InjectModel(InvoiceCounter.name)
    private readonly invoiceCounterModel: Model<InvoiceCounterDocument>,

    @InjectModel(Student.name)
    private readonly studentModel: Model<StudentDocument>,

    @InjectModel(Payment.name)
    private readonly paymentModel: Model<PaymentDocument>,

    private readonly settingsService: SettingsService,

    private readonly invoicePdfService:InvoicePdfService,
  ) {}

  private roundMoney(value: number) {
    return Number(Number(value || 0).toFixed(2));
  }

  private async getNextInvoiceNumber(prefix: string, suffix: string) {
    const counter = await this.invoiceCounterModel.findOneAndUpdate(
      {
        name: 'invoice',
      },
      {
        $inc: {
          sequence: 1,
        },
      },
      {
        new: true,
        upsert: true,
        setDefaultsOnInsert: true,
      },
    );

    const sequence = String(counter.sequence).padStart(4, '0');

    const cleanPrefix = String(prefix || 'SK-INV').trim();

    const cleanSuffix = String(suffix || '').trim();

    return cleanSuffix
      ? `${cleanPrefix}-${sequence}-${cleanSuffix}`
      : `${cleanPrefix}-${sequence}`;
  }

  private buildStudentSnapshot(student: StudentDocument) {
    return {
      studentName: student.studentName,

      rollNo: student.rollNo,

      course: student.course,

      batch: student.batch || '',

      parentName: student.parentName,

      phone: student.phone,

      alternatePhone: student.alternatePhone || '',

      email: student.email || '',

      idproof: student.idproof || '',

      schoolName: student.schoolName || '',

      address: student.address || '',
    };
  }

  private buildBusinessSnapshot(settings: any) {
    return {
      businessName: 'THE SK LEARNINGS',

      tagline: 'Private Educational Services',

      motto: 'MEDICAL / ENGINEERING / FOUNDATIONS / JUNIOR IAS',

      ownerName: settings.ownerName || '',

      gstNumber: settings.gstNumber || '',

      address: settings.invoiceAddress || '',

      invoicePrefix: settings.invoicePrefix || 'SK-INV',

      invoiceSuffix: settings.invoiceSuffix || '',

      qrCode: settings.invoiceQrCode || '',

      invoiceFooter: settings.invoiceFooter || '',

      invoiceTerms: settings.invoiceTerms || '',
    };
  }

  async createFeeSetupInvoice(studentId: string) {
    const settings = await this.settingsService.getInvoiceSettings();

    if (!settings.invoiceEnabled) {
      return null;
    }

    if (!settings.invoiceQrCode) {
      throw new BadRequestException(
        'Upload payment QR in Invoice Settings before generating fee invoice',
      );
    }

    const student = await this.studentModel.findById(studentId);

    if (!student) {
      throw new NotFoundException('Student not found');
    }

    if (
      !student.feeSetupCompleted ||
      !student.feeType ||
      !student.feeEndingDate
    ) {
      throw new BadRequestException('Student fee setup is not completed');
    }

    const existingInvoice = await this.invoiceModel.findOne({
      studentId: student._id,

      invoiceType: 'fee_setup',

      isActive: true,
    });

    if (existingInvoice) {
      existingInvoice.isActive = false;

      await existingInvoice.save();
    }

    const feeSettings = await this.settingsService.getFeeSettings();

    const invoiceNumber = await this.getNextInvoiceNumber(
      settings.invoicePrefix,
      settings.invoiceSuffix,
    );

    const invoice = new this.invoiceModel({
      invoiceNumber,

      invoiceType: 'fee_setup',

      studentId: student._id,

      student: this.buildStudentSnapshot(student),

      business: this.buildBusinessSnapshot(settings),

      fee: {
        totalFee: this.roundMoney(student.totalFee),

        feeType: student.feeType,

        selectedMonths: student.selectedMonths || null,

        monthlyAmount: this.roundMoney(student.monthlyAmount),

        minimumPartialAmount:
          student.feeType === 'partial'
            ? this.roundMoney(feeSettings.minimumPartialAmount)
            : 0,

        feeEndingDate: student.feeEndingDate,
      },

      invoiceAmount: this.roundMoney(student.totalFee),

      paidAmount: this.roundMoney(student.paidAmount),

      pendingAmount: this.roundMoney(student.pendingAmount),

      paymentStatus: student.paymentStatus,

      paymentMethod: student.paymentMethod,

      invoiceDate: new Date(),

      dueDate: student.feeEndingDate,

      isActive: true,
    });

    return invoice.save();
  }

  async createPaymentReceiptInvoice(studentId: string, paymentId: string) {
    const settings = await this.settingsService.getInvoiceSettings();

    if (!settings.invoiceEnabled) {
      return null;
    }

    const student = await this.studentModel.findById(studentId);

    if (!student) {
      throw new NotFoundException('Student not found');
    }

    const payment = await this.paymentModel.findById(paymentId);

    if (!payment) {
      throw new NotFoundException('Payment record not found');
    }

    const existingReceipt = await this.invoiceModel.findOne({
      paymentId: payment._id,

      invoiceType: 'payment_receipt',
    });

    if (existingReceipt) {
      return existingReceipt;
    }

    const feeSettings = await this.settingsService.getFeeSettings();

    const invoiceNumber = await this.getNextInvoiceNumber(
      settings.invoicePrefix,
      settings.invoiceSuffix,
    );

    const invoice = new this.invoiceModel({
      invoiceNumber,

      invoiceType: 'payment_receipt',

      studentId: student._id,

      paymentId: payment._id,

      student: this.buildStudentSnapshot(student),

      business: this.buildBusinessSnapshot(settings),

      fee: {
        totalFee: this.roundMoney(student.totalFee),

        feeType: student.feeType,

        selectedMonths: student.selectedMonths || null,

        monthlyAmount: this.roundMoney(student.monthlyAmount),

        minimumPartialAmount:
          student.feeType === 'partial'
            ? this.roundMoney(feeSettings.minimumPartialAmount)
            : 0,

        feeEndingDate: student.feeEndingDate || new Date(),
      },

      invoiceAmount: this.roundMoney(payment.amount),

      paidAmount: this.roundMoney(student.paidAmount),

      pendingAmount: this.roundMoney(student.pendingAmount),

      paymentStatus: student.paymentStatus,

      paymentMethod: payment.paymentMethod,

      paymentDate: payment.paymentDate,

      invoiceDate: new Date(),

      dueDate: student.feeEndingDate || null,

      isActive: true,
    });

    return invoice.save();
  }

  async getInvoices() {
    return this.invoiceModel
      .find({
        isActive: true,
      })
      .sort({
        invoiceDate: -1,
      });
  }

  async getInvoiceById(id: string) {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException('Invalid invoice ID');
    }

    const invoice = await this.invoiceModel.findById(id);

    if (!invoice) {
      throw new NotFoundException('Invoice not found');
    }

    return invoice;
  }

  async getStudentInvoices(studentId: string) {
    if (!Types.ObjectId.isValid(studentId)) {
      throw new BadRequestException('Invalid student ID');
    }

    return this.invoiceModel
      .find({
        studentId,
        isActive: true,
      })
      .sort({
        invoiceDate: -1,
      });
  }

  async getInvoiceByNumber(invoiceNumber: string) {
    const invoice = await this.invoiceModel.findOne({
      invoiceNumber,
    });

    if (!invoice) {
      throw new NotFoundException('Invoice not found');
    }

    return invoice;
  }

  async deactivateStudentInvoices(studentId: string) {
    if (!Types.ObjectId.isValid(studentId)) {
      throw new BadRequestException('Invalid student ID');
    }

    await this.invoiceModel.updateMany(
      {
        studentId,
        isActive: true,
      },
      {
        $set: {
          isActive: false,
        },
      },
    );

    return {
      message: 'Student invoices deactivated successfully',
    };
  }

  async clearAllInvoices() {
    const result = await this.invoiceModel.deleteMany({});

    return {
      message: 'All invoice records cleared successfully',
      deletedCount: result.deletedCount || 0,
    };
  }

  async generateInvoicePdf(
  invoiceId: string,
) {
  const invoice =
    await this.getInvoiceById(
      invoiceId,
    );

  return this.invoicePdfService.generatePdfBuffer(
    invoice,
  );
}

async generateInvoicePdfByDocument(
  invoice:
    InvoiceDocument,
) {
  return this.invoicePdfService.generatePdfBuffer(
    invoice,
  );
}
}
