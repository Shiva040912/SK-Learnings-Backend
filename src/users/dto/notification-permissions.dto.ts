import { Type } from 'class-transformer';
import { IsBoolean, IsOptional, ValidateNested } from 'class-validator';

export class NotificationActionsDto {
  @IsOptional()
  @IsBoolean()
  search?: boolean;

  @IsOptional()
  @IsBoolean()
  filter?: boolean;

  @IsOptional()
  @IsBoolean()
  refresh?: boolean;

  @IsOptional()
  @IsBoolean()
  sendNotification?: boolean;

  // Sub-actions of sendNotification — accepted independently, but only
  // ever effective when sendNotification is also true. See
  // hasNotificationAction.
  @IsOptional()
  @IsBoolean()
  sendToAll?: boolean;

  @IsOptional()
  @IsBoolean()
  sendIndividualSelected?: boolean;

  @IsOptional()
  @IsBoolean()
  sendReminder?: boolean;

  @IsOptional()
  @IsBoolean()
  notificationPreferences?: boolean;
}

// One flag per actual notification data field — controls that field
// everywhere it is displayed (table column, row subtext and the
// preferences menu alike). Deliberately no separate columns/details DTOs.
export class NotificationFieldsDto {
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
  pendingAmount?: boolean;

  @IsOptional()
  @IsBoolean()
  paidAmount?: boolean;

  @IsOptional()
  @IsBoolean()
  feeEndingDate?: boolean;

  @IsOptional()
  @IsBoolean()
  alertType?: boolean;

  @IsOptional()
  @IsBoolean()
  reminderCount?: boolean;

  @IsOptional()
  @IsBoolean()
  lastReminderSentAt?: boolean;

  @IsOptional()
  @IsBoolean()
  nextReminderDate?: boolean;

  @IsOptional()
  @IsBoolean()
  paymentStatus?: boolean;

  @IsOptional()
  @IsBoolean()
  muteAll?: boolean;

  @IsOptional()
  @IsBoolean()
  muteReminder?: boolean;
}

export class NotificationPermissionsDto {
  @IsOptional()
  @ValidateNested()
  @Type(() => NotificationActionsDto)
  actions?: NotificationActionsDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => NotificationFieldsDto)
  fields?: NotificationFieldsDto;
}
