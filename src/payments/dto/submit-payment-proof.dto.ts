import {
  IsNumber,
  IsOptional,
  IsString,
  Min,
  MinLength,
} from 'class-validator';

export class SubmitPaymentProofDto {
  @IsString()
  @MinLength(50)
  imageData!: string;

  @IsOptional()
  @IsNumber()
  @Min(0.01)
  amountClaimed?: number;
}
