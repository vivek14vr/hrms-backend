import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { PaymentStatus, UserRole } from '@prisma/client';
import { PayrollService } from './payroll.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RequestUser } from '../common/types/request-user';
import { CreateSalarySlipDto } from './dto/create-salary-slip.dto';
import { UpdateSalarySlipDto } from './dto/update-salary-slip.dto';

@ApiTags('payroll') @Controller() @UseGuards(JwtAuthGuard, RolesGuard)
export class PayrollController {
  constructor(private readonly payroll: PayrollService) {}
  @Get('salary-slips') findAll(@CurrentUser() user: RequestUser, @Query('employeeId') employeeId?: string, @Query('department') department?: string, @Query('month') month?: string, @Query('year') year?: string, @Query('paymentStatus') paymentStatus?: PaymentStatus, @Query('page') page?: string, @Query('limit') limit?: string) { return this.payroll.findAll(user, { employeeId, department, month: Number(month) || undefined, year: Number(year) || undefined, paymentStatus, page: Number(page) || 1, limit: Number(limit) || 20 }); }
  @Get('salary-slips/:id') findOne(@Param('id') id: string, @CurrentUser() user: RequestUser) { return this.payroll.findOne(id, user); }
  @Get('employees/:employeeId/salary-slips') forEmployee(@Param('employeeId') employeeId: string, @CurrentUser() user: RequestUser, @Query('month') month?: string, @Query('year') year?: string) { return this.payroll.forEmployee(employeeId, user, { month: Number(month) || undefined, year: Number(year) || undefined }); }
  @Post('employees/:employeeId/salary-slips') @Roles(UserRole.ADMIN, UserRole.HR_MANAGER) create(@Param('employeeId') employeeId: string, @Body() dto: CreateSalarySlipDto) { return this.payroll.create(employeeId, dto); }
  @Patch('salary-slips/:id') @Roles(UserRole.ADMIN, UserRole.HR_MANAGER) update(@Param('id') id: string, @Body() dto: UpdateSalarySlipDto) { return this.payroll.update(id, dto); }
  @Delete('salary-slips/:id') @Roles(UserRole.ADMIN, UserRole.HR_MANAGER) remove(@Param('id') id: string) { return this.payroll.remove(id); }
}
