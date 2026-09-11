import { Body, Controller, Delete, Get, Header, Param, Patch, Post, Query, Res, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { AttendanceCorrectionStatus, AttendanceStatus, UserRole } from '@prisma/client';
import { ParseEnumPipe } from '@nestjs/common';
import { Response } from 'express';
import { AttendanceService } from './attendance.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RequestUser } from '../common/types/request-user';
import { CreateAttendanceDto } from './dto/create-attendance.dto';
import { UpdateAttendanceDto } from './dto/update-attendance.dto';
import { CreateAttendanceCorrectionDto } from './dto/create-attendance-correction.dto';
import { ReviewAttendanceCorrectionDto } from './dto/review-attendance-correction.dto';
import { optionalQueryNumber } from '../common/utils/query-number';

@ApiTags('attendance') @Controller('attendance') @UseGuards(JwtAuthGuard, RolesGuard)
export class AttendanceController {
  constructor(private readonly attendance: AttendanceService) {}
  @Get() findAll(@CurrentUser() user: RequestUser, @Query('employeeId') employeeId?: string, @Query('department') department?: string, @Query('status', new ParseEnumPipe(AttendanceStatus, { optional: true })) status?: AttendanceStatus, @Query('dateFrom') dateFrom?: string, @Query('dateTo') dateTo?: string, @Query('page') page?: string, @Query('limit') limit?: string) { return this.attendance.findAll(user, { employeeId, department, status, dateFrom, dateTo, page: Number(page) || 1, limit: Number(limit) || 20 }); }
  @Get('summary') summary(@CurrentUser() user: RequestUser, @Query('month') month?: string, @Query('year') year?: string) { return this.attendance.summary(user, optionalQueryNumber(month), optionalQueryNumber(year)); }
  @Get('corrections') corrections(@CurrentUser() user: RequestUser, @Query('status', new ParseEnumPipe(AttendanceCorrectionStatus, { optional: true })) status?: AttendanceCorrectionStatus) { return this.attendance.corrections(user, status); }
  @Get('export') @Roles(UserRole.ADMIN, UserRole.HR_MANAGER) @Header('Content-Type', 'text/csv') async exportCsv(@CurrentUser() user: RequestUser, @Res() response: Response, @Query('employeeId') employeeId?: string, @Query('department') department?: string, @Query('status', new ParseEnumPipe(AttendanceStatus, { optional: true })) status?: AttendanceStatus, @Query('dateFrom') dateFrom?: string, @Query('dateTo') dateTo?: string) { response.attachment('peopleos-attendance.csv'); response.send(await this.attendance.csv(user, { employeeId, department, status, dateFrom, dateTo })); }
  @Post('clock-in') clockIn(@CurrentUser() user: RequestUser) { return this.attendance.clockIn(user); }
  @Post('clock-out') clockOut(@CurrentUser() user: RequestUser) { return this.attendance.clockOut(user); }
  @Post('corrections') createCorrection(@Body() dto: CreateAttendanceCorrectionDto, @CurrentUser() user: RequestUser) { return this.attendance.createCorrection(dto, user); }
  @Patch('corrections/:id') @Roles(UserRole.ADMIN, UserRole.HR_MANAGER) reviewCorrection(@Param('id') id: string, @Body() dto: ReviewAttendanceCorrectionDto, @CurrentUser() user: RequestUser) { return this.attendance.reviewCorrection(id, dto, user); }
  @Post() @Roles(UserRole.ADMIN, UserRole.HR_MANAGER) create(@Body() dto: CreateAttendanceDto, @CurrentUser() user: RequestUser) { return this.attendance.create(dto, user); }
  @Patch(':id') @Roles(UserRole.ADMIN, UserRole.HR_MANAGER) update(@Param('id') id: string, @Body() dto: UpdateAttendanceDto, @CurrentUser() user: RequestUser) { return this.attendance.update(id, dto, user); }
  @Delete(':id') @Roles(UserRole.ADMIN, UserRole.HR_MANAGER) remove(@Param('id') id: string, @CurrentUser() user: RequestUser) { return this.attendance.remove(id, user); }
}
