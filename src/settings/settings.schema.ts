import {
  Prop,
  Schema,
  SchemaFactory,
} from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type SettingsDocument =
  HydratedDocument<Settings>;

@Schema({
  timestamps: true,
})
export class Settings {
  @Prop({
    default: true,
  })
  monthlyFeeEnabled!: boolean;

  @Prop({
    default: 12,
    min: 3,
    max: 12,
  })
  defaultMonths!: number;

  @Prop({
    default: 3,
    min: 1,
    max: 12,
  })
  minimumMonths!: number;

  @Prop({
    default: 12,
    min: 3,
    max: 12,
  })
  maximumMonths!: number;

  @Prop({
    default: true,
  })
  partialFeeEnabled!: boolean;

  @Prop({
    default: 10000,
    min: 1,
  })
  minimumPartialAmount!: number;

  @Prop({
    default: true,
  })
  yearlyFeeEnabled!: boolean;

  @Prop({
    default: false,
  })
  whatsappEnabled!: boolean;

  @Prop({
    default: 3,
    min: 0,
    max: 30,
  })
  reminderDaysBeforeDue!: number;

  @Prop({
    default: true,
  })
  reminderOnDueDate!: boolean;

  @Prop({
    default: true,
  })
  overdueReminderEnabled!: boolean;

  @Prop({
    default: 3,
    min: 1,
    max: 30,
  })
  overdueReminderIntervalDays!: number;

  @Prop({
    default: false,
  })
  invoiceEnabled!: boolean;

  @Prop({
    default: 'SK-INV',
    trim: true,
  })
  invoicePrefix!: string;

  @Prop({
    default: '',
    trim: true,
  })
  invoiceSuffix!: string;

  @Prop({
    default: '',
    trim: true,
  })
  invoiceQrCode!: string;

  @Prop({
    default: '',
    trim: true,
  })
  gstNumber!: string;

  @Prop({
    default: '',
    trim: true,
  })
  ownerName!: string;

  @Prop({
    default: '',
    trim: true,
  })
  invoiceAddress!: string;

  @Prop({
    default: '',
    trim: true,
  })
  invoiceFooter!: string;

  @Prop({
    default: '',
    trim: true,
  })
  invoiceTerms!: string;
}

export const SettingsSchema =
  SchemaFactory.createForClass(Settings);