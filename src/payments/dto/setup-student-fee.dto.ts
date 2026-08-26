


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

  @IsIn(['partial', 'yearly'])
  feeType!: 'partial' | 'yearly';

  /*
   * Required by business logic only for Yearly.
   * Partial dates come from common Settings.
   */
  @IsOptional()
  @IsDateString()
  feeStartingDate?: string;

  @IsOptional()
  @IsDateString()
  feeEndingDate?: string;

}
