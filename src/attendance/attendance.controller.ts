import { Body, Controller, Delete, Get, Header, Param, Patch, Post, Query, Res, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { AttendanceStatus, UserRole } from '@prisma/client';
import { Response } from 'express';
import { AttendanceService } from './attendance.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RequestUser } from '../common/types/request-user';
import { CreateAttendanceDto } from './dto/create-attendance.dto';
import { UpdateAttendanceDto } from './dto/update-attendance.dto';

@ApiTags('attendance') @Controller('attendance') @UseGuards(JwtAuthGuard, RolesGuard)
export class AttendanceController {
  constructor(private readonly attendance: AttendanceService) {}
  @Get() findAll(@CurrentUser() user: RequestUser, @Query('employeeId') employeeId?: string, @Query('department') department?: string, @Query('status') status?: AttendanceStatus, @Query('dateFrom') dateFrom?: string, @Query('dateTo') dateTo?: string, @Query('page') page?: string, @Query('limit') limit?: string) { return this.attendance.findAll(user, { employeeId, department, status, dateFrom, dateTo, page: Number(page) || 1, limit: Number(limit) || 20 }); }
  @Get('summary') summary(@CurrentUser() user: RequestUser, @Query('month') month?: string, @Query('year') year?: string) { return this.attendance.summary(user, Number(month) || undefined, Number(year) || undefined); }
  @Get('export') @Roles(UserRole.ADMIN, UserRole.HR_MANAGER) @Header('Content-Type', 'text/csv') async exportCsv(@CurrentUser() user: RequestUser, @Res() response: Response, @Query() query: any) { response.attachment('peopleos-attendance.csv'); response.send(await this.attendance.csv(user, query)); }
  @Post() create(@Body() dto: CreateAttendanceDto, @CurrentUser() user: RequestUser) { return this.attendance.create(dto, user); }
  @Patch(':id') update(@Param('id') id: string, @Body() dto: UpdateAttendanceDto, @CurrentUser() user: RequestUser) { return this.attendance.update(id, dto, user); }
  @Delete(':id') @Roles(UserRole.ADMIN, UserRole.HR_MANAGER) remove(@Param('id') id: string, @CurrentUser() user: RequestUser) { return this.attendance.remove(id, user); }
}
