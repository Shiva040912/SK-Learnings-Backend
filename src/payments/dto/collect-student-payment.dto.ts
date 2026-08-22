import {
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  Min,
} from 'class-validator';

export class CollectStudentPaymentDto {
  @IsIn([
    'cash',
    'bank',
    'upi',
    'qr',
  ])
  paymentMethod!:
    | 'cash'
    | 'bank'
    | 'upi'
    | 'qr';

  @IsOptional()
  @IsNumber()
  @Min(0.01)
  amount?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  installmentNumber?: number;
}