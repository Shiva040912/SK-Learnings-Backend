import { Type } from 'class-transformer';
import { IsBoolean, IsOptional, ValidateNested } from 'class-validator';

import { PaymentPermissionsDto } from './payment-permissions.dto';
import { NotificationPermissionsDto } from './notification-permissions.dto';
import { InvoicePermissionsDto } from './invoice-permissions.dto';
import { SettingsPermissionsDto } from './settings-permissions.dto';

export class StudentActionsDto {
  @IsOptional()
  @IsBoolean()
  view?: boolean;

  @IsOptional()
  @IsBoolean()
  add?: boolean;

  @IsOptional()
  @IsBoolean()
  edit?: boolean;

  @IsOptional()
  @IsBoolean()
  delete?: boolean;

  // Accepted but never trusted on its own — the service layer always
  // recomputes this from `add` before saving. See normalizeStudentActions.
  @IsOptional()
  @IsBoolean()
  bulkUpload?: boolean;

  @IsOptional()
  @IsBoolean()
  addCourse?: boolean;

  @IsOptional()
  @IsBoolean()
  deleteCourse?: boolean;

  @IsOptional()
  @IsBoolean()
  addBatch?: boolean;

  @IsOptional()
  @IsBoolean()
  deleteBatch?: boolean;
}

// One flag per actual student data field — controls that field everywhere
// it is displayed (table column and profile popup alike). Deliberately no
// separate columns/details DTOs: a field is configured once.
export class StudentFieldsDto {
  @IsOptional()
  @IsBoolean()
  studentName?: boolean;

  @IsOptional()
  @IsBoolean()
  rollNo?: boolean;

  @IsOptional()
  @IsBoolean()
  parentName?: boolean;

  @IsOptional()
  @IsBoolean()
  dateOfBirth?: boolean;

  @IsOptional()
  @IsBoolean()
  gender?: boolean;

  @IsOptional()
  @IsBoolean()
  phone?: boolean;

  @IsOptional()
  @IsBoolean()
  alternatePhone?: boolean;

  @IsOptional()
  @IsBoolean()
  email?: boolean;

  @IsOptional()
  @IsBoolean()
  course?: boolean;

  @IsOptional()
  @IsBoolean()
  idproof?: boolean;

  @IsOptional()
  @IsBoolean()
  batch?: boolean;

  @IsOptional()
  @IsBoolean()
  schoolName?: boolean;

  @IsOptional()
  @IsBoolean()
  address?: boolean;
}

export class StudentPermissionsDto {
  @IsOptional()
  @ValidateNested()
  @Type(() => StudentActionsDto)
  actions?: StudentActionsDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => StudentFieldsDto)
  fields?: StudentFieldsDto;
}

export class GranularPermissionsDto {
  @IsOptional()
  @ValidateNested()
  @Type(() => StudentPermissionsDto)
  students?: StudentPermissionsDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => PaymentPermissionsDto)
  payments?: PaymentPermissionsDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => NotificationPermissionsDto)
  notifications?: NotificationPermissionsDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => InvoicePermissionsDto)
  invoices?: InvoicePermissionsDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => SettingsPermissionsDto)
  settings?: SettingsPermissionsDto;
}
