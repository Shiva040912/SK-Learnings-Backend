import {
  Body,
  Controller,
  Get,
  Patch,
  UseGuards,
} from '@nestjs/common';

import { SettingsService } from './settings.service';
import { UpdateSettingsDto } from './dto/update-setting.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('settings')
@UseGuards(JwtAuthGuard)
export class SettingsController {
  constructor(
    private readonly settingsService:
      SettingsService,
  ) {}

  @Get()
  getSettings() {
    return this.settingsService.getSettings();
  }

  @Patch()
  updateSettings(
    @Body()
    updateSettingsDto:
      UpdateSettingsDto,
  ) {
    return this.settingsService.updateSettings(
      updateSettingsDto,
    );
  }

  @Get('fees')
  getFeeSettings() {
    return this.settingsService.getFeeSettings();
  }

  @Get('notifications')
  getNotificationSettings() {
    return this.settingsService.getNotificationSettings();
  }

  @Get('invoice')
  getInvoiceSettings() {
    return this.settingsService.getInvoiceSettings();
  }
}