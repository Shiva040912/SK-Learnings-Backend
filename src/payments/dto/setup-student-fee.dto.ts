


import {
  IsInt,
  IsNumber,
  Max,
  Min,
} from 'class-validator';

export class SetupStudentFeeDto {
  @IsNumber()
  @Min(1)
  totalFee!: number;

  @IsInt()
  @Min(1)
  @Max(31)
  feeDueDay!: number;
}
