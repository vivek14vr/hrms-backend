import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { DashboardService } from './dashboard.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RequestUser } from '../common/types/request-user';

@ApiTags('dashboard') @Controller('dashboard') @UseGuards(JwtAuthGuard, RolesGuard)
export class DashboardController {
  constructor(private readonly dashboard: DashboardService) {}
  @Get('summary') summary(@CurrentUser() user: RequestUser) { return this.dashboard.summary(user); }
  @Get('attendance-trend') trend(@CurrentUser() user: RequestUser, @Query('months') months?: string) { return this.dashboard.attendanceTrend(user, Number(months) || 6); }
  @Get('department-headcount') @Roles(UserRole.ADMIN, UserRole.HR_MANAGER) headcount() { return this.dashboard.departmentHeadcount(); }
  @Get('recent-activity') recent(@CurrentUser() user: RequestUser) { return this.dashboard.recentActivity(user); }
}
