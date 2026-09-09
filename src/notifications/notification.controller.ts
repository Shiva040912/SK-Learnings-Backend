import {
  Controller,
  Body,
  Get,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';

import { NotificationsService } from './notification.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PagePermissionGuard } from '../auth/page-permission.guard';
import { RequirePage } from '../auth/page-permission.decorator';
import { NotificationActionGuard } from '../auth/notification-permission.guard';
import { RequireNotificationAction } from '../auth/notification-permission.decorator';
import { GranularPermissionsMap } from '../auth/student-permission-keys';
import { redactNotificationListForUser } from './notification-field-redaction.util';

interface RequestWithUser {
  user?: {
    role: string;
    granularPermissions?: GranularPermissionsMap;
  };
}

@Controller('notifications')
@UseGuards(JwtAuthGuard, PagePermissionGuard)
@RequirePage('notifications')
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get()
  async getNotifications(
    @Req()
    request: RequestWithUser,
  ) {
    const result = await this.notificationsService.getNotifications();

    return {
      ...result,
      notifications: redactNotificationListForUser(
        result.notifications as unknown as Record<string, unknown>[],
        request.user,
      ),
    };
  }

  @UseGuards(NotificationActionGuard)
  @RequireNotificationAction('sendReminder')
  @Post('student/:studentId/send-reminder')
  sendManualReminder(
    @Param('studentId')
    studentId: string,
  ) {
    return this.notificationsService.sendManualReminder(studentId);
  }

  @UseGuards(NotificationActionGuard)
  @RequireNotificationAction('sendToAll')
  @Post('send-all-unpaid')
  sendAllUnpaidReminders() {
    return this.notificationsService.sendAllUnpaidReminders();
  }

  @UseGuards(NotificationActionGuard)
  @RequireNotificationAction('sendIndividualSelected')
  @Post('send-selected')
  sendSelectedReminders(@Body('studentIds') studentIds: string[]) {
    return this.notificationsService.sendSelectedReminders(studentIds);
  }

  @UseGuards(NotificationActionGuard)
  @RequireNotificationAction('notificationPreferences')
  @Patch('student/:studentId/preferences')
  updateStudentPreferences(
    @Param('studentId') studentId: string,
    @Body() preferences: Record<string, unknown>,
  ) {
    return this.notificationsService.updateStudentPreferences(
      studentId,
      preferences,
    );
  }
}
