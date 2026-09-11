import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException, Optional } from '@nestjs/common';
import { Prisma, UserRole } from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import { RequestUser } from '../common/types/request-user';
import { PrismaService } from '../prisma/prisma.service';
import { CreateHolidayDto } from './dto/create-holiday.dto';

@Injectable()
export class HolidaysService {
  constructor(private readonly prisma: PrismaService, @Optional() private readonly audit?: AuditService) {}

  async findAll(year?: number) {
    const selectedYear = year ?? new Date().getUTCFullYear();
    validateYear(selectedYear);
    return this.prisma.holiday.findMany({ where: { active: true, date: { gte: new Date(Date.UTC(selectedYear, 0, 1)), lt: new Date(Date.UTC(selectedYear + 1, 0, 1)) } }, orderBy: { date: 'asc' } });
  }

  async create(dto: CreateHolidayDto, user: RequestUser) {
    assertManager(user);
    const name = dto.name.trim();
    if (!name) throw new BadRequestException('Holiday name is required');
    const date = dateOnly(dto.date);
    try {
      const holiday = await this.prisma.holiday.create({ data: { name, date } });
      await this.audit?.record({ actorUserId: user.id, action: 'HOLIDAY_CREATED', entityType: 'Holiday', entityId: holiday.id, requestId: user.requestId, metadata: { name, date: date.toISOString() } });
      return holiday;
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') throw new ConflictException('A holiday already exists for this date');
      throw error;
    }
  }

  async remove(id: string, user: RequestUser) {
    assertManager(user);
    const holiday = await this.prisma.holiday.findUnique({ where: { id } });
    if (!holiday) throw new NotFoundException('Holiday not found');
    await this.prisma.holiday.delete({ where: { id } });
    await this.audit?.record({ actorUserId: user.id, action: 'HOLIDAY_DELETED', entityType: 'Holiday', entityId: id, requestId: user.requestId, metadata: { name: holiday.name, date: holiday.date.toISOString() } });
    return { success: true };
  }
}

function assertManager(user: RequestUser) {
  if (user.role !== UserRole.ADMIN && user.role !== UserRole.HR_MANAGER) throw new ForbiddenException('Only HR or an administrator can manage holidays');
}

function validateYear(year: number) {
  if (!Number.isInteger(year) || year < 2020 || year > 2100) throw new BadRequestException('Holiday year must be between 2020 and 2100');
}

function dateOnly(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new BadRequestException('Holiday date must use YYYY-MM-DD format');
  const date = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value) throw new BadRequestException('Holiday date must be valid');
  return date;
}
