import {
  IsDateString,
  IsIn,
  IsNumber,
  IsOptional,
  Max,
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

  @IsDateString()
  feeEndingDate!: string;

  @IsOptional()
  @IsNumber()
  @Min(3)
  @Max(12)
  selectedMonths?: number;
}