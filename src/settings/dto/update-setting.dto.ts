


import {
  IsBoolean,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';

export class UpdateSettingsDto {
  @IsOptional()
  @IsBoolean()
  monthlyFeeEnabled?: boolean;

  @IsOptional()
  @IsInt()
  @Min(1)
  defaultMonths?: number;

  /*
   * Legacy settings retained for backward compatibility.
   * They are no longer used as a hard monthly duration limit.
   */
  @IsOptional()
  @IsInt()
  @Min(1)
  minimumMonths?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  maximumMonths?: number;

  @IsOptional()
  @IsBoolean()
  partialFeeEnabled?: boolean;

  @IsOptional()
  @IsNumber()
  @Min(1)
  minimumPartialAmount?: number;

  @IsOptional()
  @IsBoolean()
  yearlyFeeEnabled?: boolean;

  @IsOptional()
  @IsBoolean()
  commonFeeSetupEnabled?: boolean;

  @IsOptional()
  @IsBoolean()
  courseWiseFeeSetupEnabled?: boolean;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(31)
  recurringFeeStartDay?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(31)
  recurringFeeDueDay?: number;

  @IsOptional()
  @IsBoolean()
  whatsappEnabled?: boolean;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(30)
  reminderDaysBeforeDue?: number;

  @IsOptional()
  @IsBoolean()
  reminderOnDueDate?: boolean;

  @IsOptional()
  @IsBoolean()
  overdueReminderEnabled?: boolean;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(30)
  overdueReminderIntervalDays?: number;

  @IsOptional()
  @IsBoolean()
  invoiceEnabled?: boolean;

  @IsOptional()
  @IsString()
  invoicePrefix?: string;

  @IsOptional()
  @IsString()
  invoiceSuffix?: string;

  @IsOptional()
  @IsString()
  invoiceQrCode?: string;

  @IsOptional()
  @IsString()
  gstNumber?: string;

  @IsOptional()
  @IsString()
  ownerName?: string;

  @IsOptional()
  @IsString()
  invoiceAddress?: string;

  @IsOptional()
  @IsString()
  invoiceFooter?: string;

  @IsOptional()
  @IsString()
  invoiceTerms?: string;
}
