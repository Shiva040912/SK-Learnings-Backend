import { Body, Controller, Get, Patch, UseGuards } from '@nestjs/common';

import { SettingsService } from './settings.service';
import { UpdateSettingsDto } from './dto/update-setting.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PagePermissionGuard } from '../auth/page-permission.guard';
import { RequirePage } from '../auth/page-permission.decorator';

@Controller('settings')
@UseGuards(JwtAuthGuard, PagePermissionGuard)
@RequirePage('settings')
export class SettingsController {
  constructor(private readonly settingsService: SettingsService) {}

  @Get()
  getSettings() {
    return this.settingsService.getSettings();
  }

  @Patch()
  updateSettings(
    @Body()
    updateSettingsDto: UpdateSettingsDto,
  ) {
    return this.settingsService.updateSettings(updateSettingsDto);
  }

  // Also reachable via the Payments page, which needs the fee-type toggles
  // (monthly/partial/yearly enabled, common/course-wise setup, recurring
  // fee days) to render its Fee Setup UI — overrides the class-level
  // @RequirePage('settings') so a user with Payments access but no Settings
  // access isn't blocked here, keeping Payments fully independent.
  @RequirePage('settings', 'payments')
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
