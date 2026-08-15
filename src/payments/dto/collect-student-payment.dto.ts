import {
  IsIn,
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
  @Min(1)
  amount?: number;
}