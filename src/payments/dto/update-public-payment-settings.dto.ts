import {
  IsOptional,
  IsString,
} from 'class-validator';

export class UpdatePublicPaymentSettingsDto {
  @IsOptional()
  @IsString()
  upiId?: string;

  @IsOptional()
  @IsString()
  receiverName?: string;

  @IsOptional()
  @IsString()
  paymentPhone?: string;

  @IsOptional()
  @IsString()
  upiQrImage?: string;
}