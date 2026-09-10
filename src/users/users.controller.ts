import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { UsersService } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { StatusDto } from './dto/status.dto';

@ApiTags('users') @Controller('users') @UseGuards(JwtAuthGuard, RolesGuard) @Roles(UserRole.ADMIN)
export class UsersController {
  constructor(private readonly users: UsersService) {}
  @Get() findAll(@Query('search') search?: string, @Query('role') role?: string) { return this.users.findAll(search, role); }
  @Post() create(@Body() dto: CreateUserDto) { return this.users.create(dto); }
  @Patch(':id') update(@Param('id') id: string, @Body() dto: UpdateUserDto) { return this.users.update(id, dto); }
  @Patch(':id/status') updateStatus(@Param('id') id: string, @Body() dto: StatusDto) { return this.users.updateStatus(id, dto.isActive); }
  @Delete(':id') remove(@Param('id') id: string) { return this.users.remove(id); }
}
