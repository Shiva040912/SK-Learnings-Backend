


import {
  IsDateString,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  Min,
} from 'class-validator';

export class SetupStudentFeeDto {
  @IsNumber()
  @Min(1)
  totalFee!: number;

  @IsIn([
    'monthly',
    'partial',
    'yearly',
  ])
  feeType!:
    | 'monthly'
    | 'partial'
    | 'yearly';

  /*
   * Required by business logic only for Yearly.
   * Monthly / Partial dates come from common Settings.
   */
  @IsOptional()
  @IsDateString()
  feeStartingDate?: string;

  @IsOptional()
  @IsDateString()
  feeEndingDate?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  selectedMonths?: number;
}
