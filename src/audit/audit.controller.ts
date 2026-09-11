import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { AuditService } from './audit.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';

@ApiTags('audit') @Controller('audit-events') @UseGuards(JwtAuthGuard, RolesGuard) @Roles(UserRole.ADMIN)
export class AuditController {
  constructor(private readonly audit: AuditService) {}

  @Get() findAll(@Query('action') action?: string, @Query('entityType') entityType?: string, @Query('page') page?: string, @Query('limit') limit?: string) {
    return this.audit.findAll({ action, entityType, page: Number(page) || 1, limit: Number(limit) || 50 });
  }
}
