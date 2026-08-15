import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type StudentDocument = HydratedDocument<Student>;

@Schema({ timestamps: true })
export class Student {
  @Prop({
    required: true,
    trim: true,
  })
  studentName!: string;

  @Prop({
    required: true,
    trim: true,
    unique: true,
  })
  rollNo!: string;

  @Prop({
    required: true,
    trim: true,
  })
  parentName!: string;

  @Prop({
    type: Date,
    required: true,
  })
  dateOfBirth!: Date;

  @Prop({
    required: true,
    trim: true,
  })
  phone!: string;

  @Prop({
    trim: true,
  })
  alternatePhone?: string;

  @Prop({
    trim: true,
    lowercase: true,
    unique: true,
    sparse: true,
  })
  email?: string;

  @Prop({
    required: true,
    trim: true,
  })
  course!: string;

  @Prop({
    required: true,
    trim: true,
    unique: true,
  })
  idproof!: string;

  @Prop({
    trim: true,
  })
  batch?: string;

  @Prop({
    trim: true,
  })
  schoolName?: string;

  @Prop({
    trim: true,
  })
  address?: string;

  @Prop({
    default: 0,
    min: 0,
  })
  totalFee!: number;

  @Prop({
    enum: ['monthly', 'partial', 'yearly'],
    default: null,
  })
  feeType?: 'monthly' | 'partial' | 'yearly';

  @Prop({
    type: Date,
    default: null,
  })
  feeEndingDate?: Date;

  @Prop({
    default: false,
  })
  feeSetupCompleted!: boolean;

  @Prop({
    default: null,
    min: 3,
    max: 12,
  })
  selectedMonths?: number;

  @Prop({
    default: 0,
    min: 0,
  })
  monthlyAmount!: number;

  @Prop({
    default: 0,
    min: 0,
  })
  paidMonths!: number;

  @Prop({
    default: 0,
    min: 0,
  })
  paidAmount!: number;

  @Prop({
    default: 0,
    min: 0,
  })
  pendingAmount!: number;

  @Prop({
    enum: ['unpaid', 'partial', 'paid'],
    default: 'unpaid',
  })
  paymentStatus!: 'unpaid' | 'partial' | 'paid';

  @Prop({
    enum: ['cash', 'bank', 'upi', 'qr'],
    default: null,
  })
  paymentMethod?: 'cash' | 'bank' | 'upi' | 'qr';

  @Prop({
    type: Date,
    default: null,
  })
  lastFeeReminderSentAt?: Date;

  @Prop({
    default: 0,
    min: 0,
  })
  feeReminderCount!: number;

  @Prop({
    default: true,
  })
  isActive!: boolean;
}

export const StudentSchema = SchemaFactory.createForClass(Student);
