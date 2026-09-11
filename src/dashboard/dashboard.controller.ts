import { Controller, Get, Req, UseGuards } from '@nestjs/common';

import { DashboardService } from './dashboard.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PagePermissionGuard } from '../auth/page-permission.guard';
import { RequirePage } from '../auth/page-permission.decorator';
import { redactDashboardSummaryForUser } from '../payments/payment-field-redaction.util';
import { GranularPermissionsMap } from '../auth/student-permission-keys';

interface RequestWithUser {
  user?: {
    role: string;
    granularPermissions?: GranularPermissionsMap;
  };
}

@Controller('dashboard')
@UseGuards(JwtAuthGuard, PagePermissionGuard)
@RequirePage('dashboard')
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get('summary')
  async getDashboardSummary(@Req() request: RequestWithUser) {
    const summary = await this.dashboardService.getDashboardSummary();

    return redactDashboardSummaryForUser(summary, request.user);
  }
}
