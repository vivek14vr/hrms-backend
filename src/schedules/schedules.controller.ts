import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { RequestUser } from '../common/types/request-user';
import { CreateScheduleDto } from './dto/create-schedule.dto';
import { UpdateScheduleDto } from './dto/update-schedule.dto';
import { SchedulesService } from './schedules.service';

@ApiTags('schedules')
@Controller('schedules')
@UseGuards(JwtAuthGuard, RolesGuard)
export class SchedulesController {
  constructor(private readonly schedules: SchedulesService) {}

  @Get()
  findAll(@Query('includeInactive') includeInactive?: string) { return this.schedules.findAll(includeInactive === 'true'); }

  @Post()
  @Roles(UserRole.ADMIN, UserRole.HR_MANAGER)
  create(@Body() dto: CreateScheduleDto, @CurrentUser() actor: RequestUser) { return this.schedules.create(dto, actor); }

  @Patch(':id')
  @Roles(UserRole.ADMIN, UserRole.HR_MANAGER)
  update(@Param('id') id: string, @Body() dto: UpdateScheduleDto, @CurrentUser() actor: RequestUser) { return this.schedules.update(id, dto, actor); }

  @Delete(':id')
  @Roles(UserRole.ADMIN, UserRole.HR_MANAGER)
  remove(@Param('id') id: string, @CurrentUser() actor: RequestUser) { return this.schedules.remove(id, actor); }
}
