import { Body, Controller, Get, Param, ParseEnumPipe, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { LeaveRequestStatus, UserRole } from '@prisma/client';
import { LeaveService } from './leave.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RequestUser } from '../common/types/request-user';
import { CreateLeaveTypeDto } from './dto/create-leave-type.dto';
import { CreateLeaveRequestDto } from './dto/create-leave-request.dto';
import { ReviewLeaveRequestDto } from './dto/review-leave-request.dto';

@ApiTags('leave') @Controller() @UseGuards(JwtAuthGuard, RolesGuard)
export class LeaveController {
  constructor(private readonly leave: LeaveService) {}

  @Get('leave-types') findTypes() { return this.leave.findTypes(); }
  @Post('leave-types') @Roles(UserRole.ADMIN, UserRole.HR_MANAGER) createType(@Body() dto: CreateLeaveTypeDto, @CurrentUser() user: RequestUser) { return this.leave.createType(dto, user); }
  @Get('leave-requests') findRequests(@CurrentUser() user: RequestUser, @Query('status', new ParseEnumPipe(LeaveRequestStatus, { optional: true })) status?: LeaveRequestStatus) { return this.leave.findRequests(user, status); }
  @Post('leave-requests') createRequest(@Body() dto: CreateLeaveRequestDto, @CurrentUser() user: RequestUser) { return this.leave.createRequest(dto, user); }
  @Patch('leave-requests/:id/cancel') cancelRequest(@Param('id') id: string, @CurrentUser() user: RequestUser) { return this.leave.cancelRequest(id, user); }
  @Get('leave-balances') findBalances(@CurrentUser() user: RequestUser, @Query('year') year?: string) { return this.leave.findBalances(user, year === undefined || year.trim() === '' ? new Date().getFullYear() : Number(year)); }
  @Patch('leave-requests/:id/review') @Roles(UserRole.ADMIN, UserRole.HR_MANAGER) reviewRequest(@Param('id') id: string, @Body() dto: ReviewLeaveRequestDto, @CurrentUser() user: RequestUser) { return this.leave.reviewRequest(id, dto.status, dto.reviewNotes, user); }
}
