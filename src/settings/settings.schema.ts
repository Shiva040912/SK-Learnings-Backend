


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

  /*
   * Kept for backward compatibility.
   * Monthly fee setup no longer has a fixed maximum month limit.
   */
  @Prop({
    default: 12,
    min: 1,
  })
  defaultMonths!: number;

  @Prop({
    default: 1,
    min: 1,
  })
  minimumMonths!: number;

  @Prop({
    default: 12,
    min: 1,
  })
  maximumMonths!: number;

  @Prop({
    default: true,
  })
  partialFeeEnabled!: boolean;

  /*
   * Legacy field retained so existing data/settings do not break.
   * Partial payment collection no longer enforces this minimum.
   */
  @Prop({
    default: 10000,
    min: 1,
  })
  minimumPartialAmount!: number;

  @Prop({
    default: true,
  })
  yearlyFeeEnabled!: boolean;

  /*
   * Controls whether the Payment page can apply one setup
   * to all eligible students.
   */
  @Prop({
    default: true,
  })
  commonFeeSetupEnabled!: boolean;

  /*
   * Controls whether the Payment page can apply one setup
   * to all eligible students in a selected course.
   */
  @Prop({
    default: true,
  })
  courseWiseFeeSetupEnabled!: boolean;

  /*
   * Monthly + Partial students share one recurring fee cycle.
   * These values are calendar day numbers (1-31), not fixed dates.
   */
  @Prop({
    default: 1,
    min: 1,
    max: 31,
  })
  recurringFeeStartDay!: number;

  @Prop({
    default: 10,
    min: 1,
    max: 31,
  })
  recurringFeeDueDay!: number;

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
