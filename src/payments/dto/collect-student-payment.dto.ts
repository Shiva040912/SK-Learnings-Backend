import {
  IsIn,
  IsInt,
  IsMongoId,
  IsNumber,
  IsOptional,
  Min,
} from 'class-validator';

export class CollectStudentPaymentDto {
  @IsIn(['cash', 'bank', 'upi', 'qr'])
  paymentMethod!: 'cash' | 'bank' | 'upi' | 'qr';

  @IsOptional()
  @IsNumber()
  @Min(0.01)
  amount?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  installmentNumber?: number;

  // Set when this payment is being recorded off a student-uploaded payment
  // proof (see PaymentProof) — links the proof to the resulting Payment and
  // marks it processed so the admin Payments page's red indicator clears.
  @IsOptional()
  @IsMongoId()
  proofId?: string;
}
