import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type AuditLogDocument = HydratedDocument<AuditLog>;

// A minimal, write-only trail for money-affecting actions (H4). No GET
// route reads this back anywhere — there is no audit-view feature in the
// app today, and adding one is explicitly out of scope for this fix.
// Deliberately holds only financial before/after state, never full
// documents — see AuditLogService.record's callers, which each pick just
// the relevant totalFee/paidAmount/pendingAmount/paymentStatus fields.
@Schema({ timestamps: true })
export class AuditLog {
  @Prop({ required: true, trim: true, index: true })
  action!: string;

  @Prop({ trim: true, default: 'Student' })
  targetType!: string;

  @Prop({ type: Types.ObjectId, required: true, index: true })
  targetId!: Types.ObjectId;

  @Prop({ type: Types.ObjectId, required: true, index: true })
  performedBy!: Types.ObjectId;

  @Prop({ required: true, trim: true })
  performedByRole!: string;

  @Prop({ type: Number, default: null })
  amount!: number | null;

  @Prop({ type: Object, default: null })
  before!: Record<string, unknown> | null;

  @Prop({ type: Object, default: null })
  after!: Record<string, unknown> | null;
}

export const AuditLogSchema = SchemaFactory.createForClass(AuditLog);
AuditLogSchema.index({ targetId: 1, createdAt: -1 });
