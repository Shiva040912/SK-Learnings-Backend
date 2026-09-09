import { Type } from 'class-transformer';
import { IsBoolean, IsOptional, ValidateNested } from 'class-validator';

export class PaymentActionsDto {
  @IsOptional()
  @IsBoolean()
  search?: boolean;

  @IsOptional()
  @IsBoolean()
  filter?: boolean;

  @IsOptional()
  @IsBoolean()
  upiSettings?: boolean;

  @IsOptional()
  @IsBoolean()
  feeSetupIndividual?: boolean;

  @IsOptional()
  @IsBoolean()
  feeSetupCommon?: boolean;

  @IsOptional()
  @IsBoolean()
  feeSetupCourseWise?: boolean;

  @IsOptional()
  @IsBoolean()
  collectPayment?: boolean;

  @IsOptional()
  @IsBoolean()
  reverseResetFeeSetup?: boolean;

  @IsOptional()
  @IsBoolean()
  viewStudentPaymentDetails?: boolean;

  @IsOptional()
  @IsBoolean()
  editFee?: boolean;

  @IsOptional()
  @IsBoolean()
  addPartPayment?: boolean;

  @IsOptional()
  @IsBoolean()
  viewPaymentHistory?: boolean;

  @IsOptional()
  @IsBoolean()
  clearPaymentHistory?: boolean;

  @IsOptional()
  @IsBoolean()
  assignNextFee?: boolean;
}

// One flag per actual payment/student data field — controls that field
// everywhere it is displayed (table column, details modal and history modal
// alike). Deliberately no separate columns/details DTOs, and no Monthly
// Installment fields (that flow is dead in the live UI).
export class PaymentFieldsDto {
  @IsOptional()
  @IsBoolean()
  studentName?: boolean;

  @IsOptional()
  @IsBoolean()
  rollNo?: boolean;

  @IsOptional()
  @IsBoolean()
  course?: boolean;

  @IsOptional()
  @IsBoolean()
  batch?: boolean;

  @IsOptional()
  @IsBoolean()
  totalFee?: boolean;

  @IsOptional()
  @IsBoolean()
  feeType?: boolean;

  @IsOptional()
  @IsBoolean()
  feeStartingDate?: boolean;

  @IsOptional()
  @IsBoolean()
  feeEndingDate?: boolean;

  @IsOptional()
  @IsBoolean()
  feeSetupCompleted?: boolean;

  @IsOptional()
  @IsBoolean()
  paidAmount?: boolean;

  @IsOptional()
  @IsBoolean()
  pendingAmount?: boolean;

  @IsOptional()
  @IsBoolean()
  paymentStatus?: boolean;

  @IsOptional()
  @IsBoolean()
  paymentMethod?: boolean;

  @IsOptional()
  @IsBoolean()
  paymentDate?: boolean;
}

// Global UPI receiver configuration fields — not per-student data, kept
// separate from PaymentFieldsDto.
export class PaymentUpiFieldsDto {
  @IsOptional()
  @IsBoolean()
  upiId?: boolean;

  @IsOptional()
  @IsBoolean()
  receiverName?: boolean;

  @IsOptional()
  @IsBoolean()
  paymentPhone?: boolean;

  @IsOptional()
  @IsBoolean()
  upiQrImage?: boolean;
}

export class PaymentPermissionsDto {
  @IsOptional()
  @ValidateNested()
  @Type(() => PaymentActionsDto)
  actions?: PaymentActionsDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => PaymentFieldsDto)
  fields?: PaymentFieldsDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => PaymentUpiFieldsDto)
  upiSettings?: PaymentUpiFieldsDto;
}
