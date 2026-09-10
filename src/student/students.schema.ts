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
  SchemaFactory.createForClass(MonthlyInstallment);

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

  /*
   * Internal anchor date for the current fee cycle (auto-set to the date
   * the cycle began — not an admin-facing input). Deprecated for display:
   * kept only so historical records already showing this stay intact.
   */
  @Prop({
    type: Date,
    default: null,
  })
  feeStartingDate?: Date;

  /*
   * Marks which fee cycle is currently active — set only when a genuinely
   * NEW cycle begins (setupStudentFee: first-ever setup or "Assign Next
   * Fee"), unlike feeStartingDate above which editStudentFee also touches
   * just to recompute the due date for the SAME cycle. Every Payment
   * collected while this cycle is active is stamped with this same value
   * (Payment.feeCycleStartedAt), which is how the History UI restarts "Nth
   * Due" numbering at 1st Due for each new cycle instead of continuing
   * across cycles.
   */
  @Prop({
    type: Date,
    default: null,
  })
  feeCycleStartedAt?: Date | null;

  /*
   * Deprecated — replaced by feeDueDay/feeDueDate. Kept read-only for
   * historical records created before the recurring Due Date model.
   */
  @Prop({
    type: Date,
    default: null,
  })
  feeEndingDate?: Date;

  /*
   * The recurring monthly Due Day (1-31) an admin configures at fee setup —
   * the actual rule, not a one-time date. Months without this day use
   * their own last valid day (Due Day 31 -> Feb 28/29).
   */
  @Prop({
    default: null,
    min: 1,
    max: 31,
  })
  feeDueDay?: number;

  /*
   * The computed due date for the CURRENT unpaid cycle, derived from
   * feeDueDay + feeStartingDate. Recomputed only when a cycle begins
   * (fee setup / edit / next cycle) — never advanced by a background job —
   * so once it's in the past it stays in the past for as long as the
   * balance remains pending, which is what keeps a missed payment flagged
   * overdue continuously instead of resetting every month.
   */
  @Prop({
    type: Date,
    default: null,
  })
  feeDueDate?: Date;

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

  @Prop({
    default: 0,
    min: 0,
  })
  paymentPageVisitedCount!: number;

  @Prop({
    type: Date,
    default: null,
  })
  lastPaymentPageVisitedAt?: Date;
}

export const StudentSchema = SchemaFactory.createForClass(Student);
StudentSchema.index({
  feeSetupCompleted: 1,
  paymentStatus: 1,
  pendingAmount: 1,
});

StudentSchema.index({
  feeDueDate: 1,
});
