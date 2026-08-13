import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';

import { Payment, PaymentDocument } from './payments.schema';

import {
  PaymentSetting,
  PaymentSettingDocument,
} from './payments-settings.schema';

import { Student, StudentDocument } from '../student/students.schema';

@Injectable()
export class PaymentsService {
  constructor(
    @InjectModel(Payment.name)
    private readonly paymentModel: Model<PaymentDocument>,

    @InjectModel(PaymentSetting.name)
    private readonly paymentSettingModel: Model<PaymentSettingDocument>,

    @InjectModel(Student.name)
    private readonly studentModel: Model<StudentDocument>,
  ) {}

  private getBillingMonth(date: Date) {
    const year = date.getFullYear();

    const month = String(date.getMonth() + 1).padStart(2, '0');

    return `${year}-${month}`;
  }
  async setFeeDueDate(feeDueDate: string) {
    const parsedDate = new Date(`${feeDueDate}T00:00:00`);

    if (Number.isNaN(parsedDate.getTime())) {
      throw new BadRequestException('Invalid fee due date');
    }

    let setting = await this.paymentSettingModel.findOne({
      isActive: true,
    });

    console.log('OLD DUE DATE:', setting?.feeDueDate);

    console.log('NEW DUE DATE:', parsedDate);

    let shouldResetStudents = false;

    if (setting?.feeDueDate) {
      const previousDate = new Date(setting.feeDueDate);

      const previousBillingMonth = this.getBillingMonth(previousDate);

      const newBillingMonth = this.getBillingMonth(parsedDate);

      console.log('OLD MONTH:', previousBillingMonth);

      console.log('NEW MONTH:', newBillingMonth);

      shouldResetStudents = previousBillingMonth !== newBillingMonth;
    }

    console.log('SHOULD RESET:', shouldResetStudents);

    if (!setting) {
      setting = new this.paymentSettingModel({
        feeDueDate: parsedDate,
        isActive: true,
      });
    } else {
      setting.feeDueDate = parsedDate;
    }

    await setting.save();

    let resetStudentCount = 0;

    if (shouldResetStudents) {
      const students = await this.studentModel.find();

      console.log('STUDENTS FOUND:', students.length);

      for (const student of students) {
        console.log('RESETTING:', student.studentName, student.paymentStatus);

        student.paymentStatus = 'unpaid';

        student.paidAmount = 0;

        student.pendingAmount = student.totalFee;

        await student.save();
      }

      resetStudentCount = students.length;
    }

    console.log('RESET COUNT:', resetStudentCount);

    return {
      message: shouldResetStudents
        ? 'New month fee date updated and all students reset to unpaid'
        : 'Fee due date updated successfully',

      feeDueDate: setting.feeDueDate,

      studentsReset: shouldResetStudents,

      resetStudentCount,
    };
  }

  async getFeeDueDate() {
    const setting = await this.paymentSettingModel
      .findOne({
        isActive: true,
      })
      .sort({
        updatedAt: -1,
      });

    if (!setting) {
      return {
        feeDueDate: null,
      };
    }

    return {
      feeDueDate: setting.feeDueDate,
    };
  }

  async getPayments() {
    return this.paymentModel.find().sort({
      paymentDate: -1,
    });
  }

  async getPaymentById(id: string) {
    const payment = await this.paymentModel.findById(id);

    if (!payment) {
      throw new NotFoundException('Payment record not found');
    }

    return payment;
  }

  async createPayment(data: {
    studentId: string;
    studentName: string;
    phone: string;
    course: string;
    amount: number;
    paymentMethod: 'cash' | 'bank' | 'upi' | 'qr';
  }) {
    const setting = await this.paymentSettingModel
      .findOne({
        isActive: true,
      })
      .sort({
        updatedAt: -1,
      });

    const billingDate = setting?.feeDueDate
      ? new Date(setting.feeDueDate)
      : new Date();

    const billingMonth = this.getBillingMonth(billingDate);

    const existingPayment = await this.paymentModel.findOne({
      studentId: data.studentId,

      billingMonth,

      paymentStatus: 'paid',
    });

    if (existingPayment) {
      return existingPayment;
    }

    const payment = new this.paymentModel({
      studentId: data.studentId,

      studentName: data.studentName,

      phone: data.phone,

      course: data.course,

      amount: data.amount,

      billingMonth,

      paymentMethod: data.paymentMethod,

      paymentStatus: 'paid',

      paymentDate: new Date(),
    });

    return payment.save();
  }
}
