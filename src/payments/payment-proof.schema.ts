import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type PaymentProofDocument = HydratedDocument<PaymentProof>;

// A student-submitted "I paid, here's the screenshot" claim. This is
// deliberately NOT the Payment (transaction history) record — it only
// becomes one once an Admin verifies the screenshot and records the actual
// amount received via the normal collect flow. Storing the screenshot as a
// base64 data URI on a plain String field mirrors the existing UPI QR
// image / profile photo upload pattern elsewhere in this codebase — no
// multer/disk storage needed.
@Schema({ timestamps: true })
export class PaymentProof {
  @Prop({ type: Types.ObjectId, ref: 'Student', required: true, index: true })
  studentId!: Types.ObjectId;

  @Prop({ required: true })
  imageData!: string;

  @Prop({ type: Number, default: null })
  amountClaimed?: number | null;

  // pending -> student uploaded, not yet verified/recorded by Admin.
  // processed -> Admin recorded the payment (or dismissed a stale proof).
  @Prop({ enum: ['pending', 'processed'], default: 'pending', index: true })
  status!: 'pending' | 'processed';

  @Prop({ type: Types.ObjectId, ref: 'Payment', default: null })
  paymentId?: Types.ObjectId | null;

  @Prop({ type: Date, default: null })
  processedAt?: Date | null;
}

export const PaymentProofSchema = SchemaFactory.createForClass(PaymentProof);
PaymentProofSchema.index({ studentId: 1, status: 1 });
