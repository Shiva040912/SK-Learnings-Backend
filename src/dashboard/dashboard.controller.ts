import { Controller, Get, UseGuards } from '@nestjs/common';

import { DashboardService } from './dashboard.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PagePermissionGuard } from '../auth/page-permission.guard';
import { RequirePage } from '../auth/page-permission.decorator';

@Controller('dashboard')
@UseGuards(JwtAuthGuard, PagePermissionGuard)
@RequirePage('dashboard')
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get('summary')
  getDashboardSummary() {
    return this.dashboardService.getDashboardSummary();
  }
}
