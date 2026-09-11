import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';

import { HydratedDocument, Types } from 'mongoose';

export type PaymentDocument = HydratedDocument<Payment>;

@Schema({
  timestamps: true,
})
export class Payment {
  @Prop({
    type: Types.ObjectId,
    ref: 'Student',
    required: true,
  })
  studentId!: Types.ObjectId;

  @Prop({
    required: true,
    trim: true,
  })
  studentName!: string;

  @Prop({
    required: true,
    trim: true,
  })
  phone!: string;

  @Prop({
    required: true,
    trim: true,
  })
  course!: string;

  @Prop({
    required: true,
    min: 0,
  })
  amount!: number;

  @Prop({
    required: true,
    type: Date,
    default: Date.now,
  })
  paymentDate!: Date;

  @Prop({
    required: true,
    trim: true,
  })
  billingMonth!: string;

  @Prop({
    enum: ['cash', 'bank', 'upi', 'qr'],
    required: true,
  })
  paymentMethod!: 'cash' | 'bank' | 'upi' | 'qr';

  @Prop({
    enum: ['monthly', 'partial', 'yearly'],
    default: null,
  })
  feeType?: 'monthly' | 'partial' | 'yearly';

  @Prop({
    min: 1,
    default: null,
  })
  installmentNumber?: number;

  @Prop({
    enum: ['paid'],
    default: 'paid',
  })
  paymentStatus!: 'paid';

  /*
   * Set only when this payment was recorded off a student-uploaded
   * PaymentProof (screenshot-based collection). Null for a direct Collect
   * Payment with no proof involved.
   */
  @Prop({
    type: String,
    default: null,
  })
  screenshotImage?: string | null;

  @Prop({
    type: Types.ObjectId,
    ref: 'PaymentProof',
    default: null,
  })
  paymentProofId?: Types.ObjectId | null;

  /*
   * Snapshot of the student's fee-cycle marker (Student.feeCycleStartedAt)
   * at the moment this payment was collected — stamped once here so the
   * cycle a payment belongs to never changes retroactively even if the
   * student later starts another cycle. Payments sharing the same value
   * belong to the same fee cycle; used only to restart "Nth Due" numbering
   * at 1 for each new cycle (see Payment.jsx's history rendering) — not a
   * displayed value itself. Null for payments collected before this field
   * existed, which simply keep numbering continuously as one legacy group,
   * matching the pre-existing behavior for that older history.
   */
  @Prop({
    type: Date,
    default: null,
  })
  feeCycleStartedAt?: Date | null;

  /*
   * Soft-delete flag for individual history-record deletion. Deleted
   * records are excluded from totals/history views but the document is
   * kept (screenshotImage is cleared) rather than hard-removed.
   */
  @Prop({
    type: Boolean,
    default: false,
  })
  deleted?: boolean;
}

export const PaymentSchema = SchemaFactory.createForClass(Payment);
PaymentSchema.index({
  studentId: 1,
  paymentDate: -1,
});
