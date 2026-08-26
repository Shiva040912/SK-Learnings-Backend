import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type StudentDocument = HydratedDocument<Student>;

@Schema({
  _id: false,
})
export class MonthlyInstallment {
  @Prop({
    required: true,
    min: 1,
  })
  installmentNumber!: number;

  @Prop({
    required: true,
    min: 0,
  })
  amount!: number;

  @Prop({
    enum: ['unpaid', 'paid'],
    default: 'unpaid',
  })
  status!: 'unpaid' | 'paid';

  @Prop({
    type: Date,
    default: null,
  })
  paidAt?: Date;

  @Prop({
    type: Types.ObjectId,
    ref: 'Payment',
    default: null,
  })
  paymentId?: Types.ObjectId;
}

export const MonthlyInstallmentSchema =
  SchemaFactory.createForClass(
    MonthlyInstallment,
  );

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
    enum: ['male', 'female', 'others'],
  })
  gender!: 'male' | 'female' | 'others';

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
    enum: ['individual', 'common', 'course'],
    default: null,
  })
  feeSetupSource?: 'individual' | 'common' | 'course';

  @Prop({
    type: Date,
    default: null,
  })
  feeStartingDate?: Date;

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
    min: 1,
  })
  selectedMonths?: number;

  @Prop({
    default: 0,
    min: 0,
  })
  monthlyAmount!: number;

  @Prop({
    type: [MonthlyInstallmentSchema],
    default: [],
  })
  monthlyInstallments!: MonthlyInstallment[];

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

  @Prop({ default: false })
  muteAllFeeNotifications!: boolean;


  @Prop({ default: false })
  muteFeeReminderNotification!: boolean;


  @Prop({
    default: true,
  })
  isActive!: boolean;
}

export const StudentSchema =
  SchemaFactory.createForClass(Student);
StudentSchema.index({
  feeSetupCompleted: 1,
  paymentStatus: 1,
  pendingAmount: 1,
});

StudentSchema.index({
  feeEndingDate: 1,
});