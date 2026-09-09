import { Type } from 'class-transformer';
import { IsBoolean, IsOptional, ValidateNested } from 'class-validator';

export class InvoiceActionsDto {
  @IsOptional()
  @IsBoolean()
  search?: boolean;

  @IsOptional()
  @IsBoolean()
  filter?: boolean;

  @IsOptional()
  @IsBoolean()
  viewInvoice?: boolean;

  @IsOptional()
  @IsBoolean()
  downloadInvoice?: boolean;

  @IsOptional()
  @IsBoolean()
  printInvoice?: boolean;

  @IsOptional()
  @IsBoolean()
  clearInvoices?: boolean;
}

// One flag per actual invoice/student data field — controls that field
// everywhere it is displayed (receipt-board row and opened invoice document
// alike). Deliberately no separate columns/document DTOs.
export class InvoiceFieldsDto {
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
  parentName?: boolean;

  @IsOptional()
  @IsBoolean()
  phone?: boolean;

  @IsOptional()
  @IsBoolean()
  invoiceNumber?: boolean;

  @IsOptional()
  @IsBoolean()
  invoiceDate?: boolean;

  @IsOptional()
  @IsBoolean()
  dueDate?: boolean;

  @IsOptional()
  @IsBoolean()
  totalAmount?: boolean;

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
}

export class InvoicePermissionsDto {
  @IsOptional()
  @ValidateNested()
  @Type(() => InvoiceActionsDto)
  actions?: InvoiceActionsDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => InvoiceFieldsDto)
  fields?: InvoiceFieldsDto;
}
