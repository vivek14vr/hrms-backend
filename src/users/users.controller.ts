import { Body, Controller, Delete, Get, Param, ParseEnumPipe, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { UsersService } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { StatusDto } from './dto/status.dto';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RequestUser } from '../common/types/request-user';

@ApiTags('users') @Controller('users') @UseGuards(JwtAuthGuard, RolesGuard) @Roles(UserRole.ADMIN, UserRole.HR_MANAGER)
export class UsersController {
  constructor(private readonly users: UsersService) {}
  @Get() findAll(@Query('search') search?: string, @Query('role', new ParseEnumPipe(UserRole, { optional: true })) role?: UserRole) { return this.users.findAll(search, role); }
  @Post() create(@Body() dto: CreateUserDto, @CurrentUser() user: RequestUser) { return this.users.create(dto, user); }
  @Patch(':id') update(@Param('id') id: string, @Body() dto: UpdateUserDto, @CurrentUser() user: RequestUser) { return this.users.update(id, dto, user); }
  @Patch(':id/status') updateStatus(@Param('id') id: string, @Body() dto: StatusDto, @CurrentUser() user: RequestUser) { return this.users.updateStatus(id, dto.isActive, user); }
  @Post(':id/password-reset') issuePasswordResetLink(@Param('id') id: string, @CurrentUser() user: RequestUser) { return this.users.issuePasswordResetLink(id, user); }
  @Delete(':id') remove(@Param('id') id: string, @CurrentUser() user: RequestUser) { return this.users.remove(id, user); }
}
