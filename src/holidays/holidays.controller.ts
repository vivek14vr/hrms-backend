import { Body, Controller, Delete, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import { RequestUser } from '../common/types/request-user';
import { CreateHolidayDto } from './dto/create-holiday.dto';
import { HolidaysService } from './holidays.service';

@ApiTags('holidays')
@Controller('holidays')
@UseGuards(JwtAuthGuard, RolesGuard)
export class HolidaysController {
  constructor(private readonly holidays: HolidaysService) {}

  @Get()
  findAll(@Query('year') year?: string) { return this.holidays.findAll(year ? Number(year) : undefined); }

  @Post()
  @Roles(UserRole.ADMIN, UserRole.HR_MANAGER)
  create(@Body() dto: CreateHolidayDto, @CurrentUser() user: RequestUser) { return this.holidays.create(dto, user); }

  @Delete(':id')
  @Roles(UserRole.ADMIN, UserRole.HR_MANAGER)
  remove(@Param('id') id: string, @CurrentUser() user: RequestUser) { return this.holidays.remove(id, user); }
}
