import {
  Controller,
  Get,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';

import { NotificationsService } from './notification.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('notifications')
@UseGuards(JwtAuthGuard)
export class NotificationsController {
  constructor(
    private readonly notificationsService:
      NotificationsService,
  ) {}

  @Get()
  getNotifications() {
    return this.notificationsService.getNotifications();
  }

  @Post('student/:studentId/send-reminder')
  sendManualReminder(
    @Param('studentId')
    studentId: string,
  ) {
    return this.notificationsService.sendManualReminder(
      studentId,
    );
  }

  @Post('send-all-unpaid')
  sendAllUnpaidReminders() {
    return this.notificationsService.sendAllUnpaidReminders();
  }
}