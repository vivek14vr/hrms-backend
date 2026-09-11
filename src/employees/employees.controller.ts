import { Controller, Delete, Get, Param, ParseEnumPipe, Patch, Post, Body, Query, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { EmploymentStatus, UserRole } from '@prisma/client';
import { EmployeesService } from './employees.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RequestUser } from '../common/types/request-user';
import { CreateEmployeeDto } from './dto/create-employee.dto';
import { UpdateEmployeeDto } from './dto/update-employee.dto';
import { UpdateMyProfileDto } from './dto/update-my-profile.dto';
import { CreateCompensationHistoryDto } from './dto/create-compensation-history.dto';

@ApiTags('employees') @Controller('employees') @UseGuards(JwtAuthGuard, RolesGuard)
export class EmployeesController {
  constructor(private readonly employees: EmployeesService) {}
  @Get() @Roles(UserRole.ADMIN, UserRole.HR_MANAGER) findAll(@Query('search') search?: string, @Query('department') department?: string, @Query('status', new ParseEnumPipe(EmploymentStatus, { optional: true })) status?: EmploymentStatus, @Query('designation') designation?: string, @Query('page') page?: string, @Query('limit') limit?: string) { return this.employees.findAll({ search, department, status, designation, page: Number(page) || 1, limit: Number(limit) || 10 }); }
  @Get('departments') @Roles(UserRole.ADMIN, UserRole.HR_MANAGER) departments() { return this.employees.departments(); }
  @Get(':id/compensation-history') compensationHistory(@Param('id') id: string, @CurrentUser() user: RequestUser) { return this.employees.compensationHistory(id, user); }
  @Post(':id/compensation-history') @Roles(UserRole.ADMIN, UserRole.HR_MANAGER) addCompensationHistory(@Param('id') id: string, @Body() dto: CreateCompensationHistoryDto, @CurrentUser() user: RequestUser) { return this.employees.addCompensationHistory(id, dto, user); }
  @Get(':id') findOne(@Param('id') id: string, @CurrentUser() user: RequestUser) { return this.employees.findOne(id, user); }
  @Patch('me') updateSelf(@CurrentUser() user: RequestUser, @Body() dto: UpdateMyProfileDto) { return this.employees.updateSelf(user, dto); }
  @Post() @Roles(UserRole.ADMIN, UserRole.HR_MANAGER) create(@Body() dto: CreateEmployeeDto, @CurrentUser() user: RequestUser) { return this.employees.create(dto, user); }
  @Patch(':id') @Roles(UserRole.ADMIN, UserRole.HR_MANAGER) update(@Param('id') id: string, @Body() dto: UpdateEmployeeDto, @CurrentUser() user: RequestUser) { return this.employees.update(id, dto, user); }
  @Delete(':id') @Roles(UserRole.ADMIN, UserRole.HR_MANAGER) remove(@Param('id') id: string, @CurrentUser() user: RequestUser) { return this.employees.remove(id, user); }
}
