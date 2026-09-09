import { IsBoolean, IsOptional } from 'class-validator';

export class PagePermissionsDto {
  @IsOptional()
  @IsBoolean()
  dashboard?: boolean;

  @IsOptional()
  @IsBoolean()
  students?: boolean;

  @IsOptional()
  @IsBoolean()
  payments?: boolean;

  @IsOptional()
  @IsBoolean()
  invoices?: boolean;

  @IsOptional()
  @IsBoolean()
  notifications?: boolean;

  @IsOptional()
  @IsBoolean()
  users?: boolean;

  @IsOptional()
  @IsBoolean()
  settings?: boolean;
}
