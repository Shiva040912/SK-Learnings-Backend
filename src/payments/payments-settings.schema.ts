import {
  Prop,
  Schema,
  SchemaFactory,
} from '@nestjs/mongoose';

import { HydratedDocument } from 'mongoose';

export type PaymentSettingDocument =
  HydratedDocument<PaymentSetting>;

@Schema({
  timestamps: true,
})
export class PaymentSetting {
  @Prop({
    required: true,
    type: Date,
  })
  feeDueDate!: Date;

  @Prop({
    type: String,
    default: '',
    trim: true,
  })
  upiId?: string;

  @Prop({
    type: String,
    default: '',
    trim: true,
  })
  receiverName?: string;

  @Prop({
    type: String,
    default: '',
    trim: true,
  })
  paymentPhone?: string;

  @Prop({
    type: String,
    default: '',
  })
  upiQrImage?: string;

  @Prop({
    default: true,
  })
  isActive!: boolean;

  @Prop({
    type: Date,
    default: null,
  })
  lastReminderSentAt?: Date | null;
}

export const PaymentSettingSchema =
  SchemaFactory.createForClass(
    PaymentSetting,
  );