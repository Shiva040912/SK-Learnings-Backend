import { Body, Controller, Get, Patch, Req, UseGuards } from '@nestjs/common';

import { SettingsService } from './settings.service';
import { UpdateSettingsDto } from './dto/update-setting.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PagePermissionGuard } from '../auth/page-permission.guard';
import { RequirePage } from '../auth/page-permission.decorator';
import { GranularPermissionsMap } from '../auth/student-permission-keys';
import {
  assertSettingsWriteAllowed,
  redactSettingsForUser,
} from './settings-field-redaction.util';

interface RequestWithUser {
  user?: {
    role: string;
    granularPermissions?: GranularPermissionsMap;
  };
}

@Controller('settings')
@UseGuards(JwtAuthGuard, PagePermissionGuard)
@RequirePage('settings')
export class SettingsController {
  constructor(private readonly settingsService: SettingsService) {}

  @Get()
  async getSettings(@Req() request: RequestWithUser) {
    const settings = await this.settingsService.getSettings();

    return redactSettingsForUser(
      (settings as unknown as { toObject: () => Record<string, unknown> })
        .toObject(),
      request.user,
    );
  }

  @Patch()
  async updateSettings(
    @Body()
    updateSettingsDto: UpdateSettingsDto,

    @Req()
    request: RequestWithUser,
  ) {
    assertSettingsWriteAllowed(
      updateSettingsDto as unknown as Record<string, unknown>,
      request.user,
    );

    const result = await this.settingsService.updateSettings(
      updateSettingsDto,
    );

    return {
      ...result,
      settings: redactSettingsForUser(
        (
          result.settings as unknown as {
            toObject: () => Record<string, unknown>;
          }
        ).toObject(),
        request.user,
      ),
    };
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
