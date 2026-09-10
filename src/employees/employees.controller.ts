import { Controller, Delete, Get, Patch, Post, Body, Param, Query, UseGuards } from '@nestjs/common';
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

@ApiTags('employees') @Controller('employees') @UseGuards(JwtAuthGuard, RolesGuard)
export class EmployeesController {
  constructor(private readonly employees: EmployeesService) {}
  @Get() @Roles(UserRole.ADMIN, UserRole.HR_MANAGER) findAll(@Query('search') search?: string, @Query('department') department?: string, @Query('status') status?: EmploymentStatus, @Query('designation') designation?: string, @Query('page') page?: string, @Query('limit') limit?: string) { return this.employees.findAll({ search, department, status, designation, page: Number(page) || 1, limit: Number(limit) || 10 }); }
  @Get('departments') @Roles(UserRole.ADMIN, UserRole.HR_MANAGER) departments() { return this.employees.departments(); }
  @Get(':id') findOne(@Param('id') id: string, @CurrentUser() user: RequestUser) { return this.employees.findOne(id, user); }
  @Post() @Roles(UserRole.ADMIN, UserRole.HR_MANAGER) create(@Body() dto: CreateEmployeeDto) { return this.employees.create(dto); }
  @Patch(':id') @Roles(UserRole.ADMIN, UserRole.HR_MANAGER) update(@Param('id') id: string, @Body() dto: UpdateEmployeeDto) { return this.employees.update(id, dto); }
  @Delete(':id') @Roles(UserRole.ADMIN, UserRole.HR_MANAGER) remove(@Param('id') id: string) { return this.employees.remove(id); }
}
