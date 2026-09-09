import { Type } from 'class-transformer';
import { IsBoolean, IsOptional, ValidateNested } from 'class-validator';

// Settings has no Fields layer — each tab is one coherent admin-config
// form gated as a single section action. See settings-permission-keys.ts.
export class SettingsActionsDto {
  @IsOptional()
  @IsBoolean()
  profileSettings?: boolean;

  @IsOptional()
  @IsBoolean()
  feeSettings?: boolean;

  @IsOptional()
  @IsBoolean()
  notificationSettings?: boolean;

  @IsOptional()
  @IsBoolean()
  invoiceSettings?: boolean;
}

export class SettingsPermissionsDto {
  @IsOptional()
  @ValidateNested()
  @Type(() => SettingsActionsDto)
  actions?: SettingsActionsDto;
}
