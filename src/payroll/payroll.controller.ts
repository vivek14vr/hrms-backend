import { Body, Controller, Delete, Get, Param, ParseEnumPipe, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { PaymentStatus, PayrollRunStatus, UserRole } from '@prisma/client';
import { PayrollService } from './payroll.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RequestUser } from '../common/types/request-user';
import { CreateSalarySlipDto } from './dto/create-salary-slip.dto';
import { UpdateSalarySlipDto } from './dto/update-salary-slip.dto';
import { CreatePayrollRunDto } from './dto/create-payroll-run.dto';
import { UpdatePayrollRunStatusDto } from './dto/update-payroll-run-status.dto';
import { optionalQueryNumber } from '../common/utils/query-number';

@ApiTags('payroll') @Controller() @UseGuards(JwtAuthGuard, RolesGuard)
export class PayrollController {
  constructor(private readonly payroll: PayrollService) {}
  @Get('payroll-runs') @Roles(UserRole.ADMIN, UserRole.HR_MANAGER) findRuns() { return this.payroll.findRuns(); }
  @Post('payroll-runs') @Roles(UserRole.ADMIN, UserRole.HR_MANAGER) createRun(@Body() dto: CreatePayrollRunDto, @CurrentUser() user: RequestUser) { return this.payroll.createRun(dto, user); }
  @Patch('payroll-runs/:id/status') @Roles(UserRole.ADMIN, UserRole.HR_MANAGER) updateRunStatus(@Param('id') id: string, @Body() dto: UpdatePayrollRunStatusDto, @CurrentUser() user: RequestUser) { return this.payroll.updateRunStatus(id, dto.status, user); }
  @Get('salary-slips') findAll(@CurrentUser() user: RequestUser, @Query('employeeId') employeeId?: string, @Query('department') department?: string, @Query('month') month?: string, @Query('year') year?: string, @Query('paymentStatus', new ParseEnumPipe(PaymentStatus, { optional: true })) paymentStatus?: PaymentStatus, @Query('page') page?: string, @Query('limit') limit?: string) { return this.payroll.findAll(user, { employeeId, department, month: optionalQueryNumber(month), year: optionalQueryNumber(year), paymentStatus, page: Number(page) || 1, limit: Number(limit) || 20 }); }
  @Get('salary-slips/:id') findOne(@Param('id') id: string, @CurrentUser() user: RequestUser) { return this.payroll.findOne(id, user); }
  @Get('employees/:employeeId/salary-slips') forEmployee(@Param('employeeId') employeeId: string, @CurrentUser() user: RequestUser, @Query('month') month?: string, @Query('year') year?: string) { return this.payroll.forEmployee(employeeId, user, { month: optionalQueryNumber(month), year: optionalQueryNumber(year) }); }
  @Post('employees/:employeeId/salary-slips') @Roles(UserRole.ADMIN, UserRole.HR_MANAGER) create(@Param('employeeId') employeeId: string, @Body() dto: CreateSalarySlipDto, @CurrentUser() user: RequestUser) { return this.payroll.create(employeeId, dto, user); }
  @Patch('salary-slips/:id') @Roles(UserRole.ADMIN, UserRole.HR_MANAGER) update(@Param('id') id: string, @Body() dto: UpdateSalarySlipDto, @CurrentUser() user: RequestUser) { return this.payroll.update(id, dto, user); }
  @Delete('salary-slips/:id') @Roles(UserRole.ADMIN, UserRole.HR_MANAGER) remove(@Param('id') id: string, @CurrentUser() user: RequestUser) { return this.payroll.remove(id, user); }
}
