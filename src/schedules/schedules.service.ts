import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException, Optional } from '@nestjs/common';
import { Prisma, UserRole } from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import { RequestUser } from '../common/types/request-user';
import { PrismaService } from '../prisma/prisma.service';
import { CreateScheduleDto } from './dto/create-schedule.dto';
import { UpdateScheduleDto } from './dto/update-schedule.dto';

const scheduleSelect = {
  id: true,
  name: true,
  timezone: true,
  workWeek: true,
  shiftStart: true,
  shiftEnd: true,
  graceMinutes: true,
  overtimeAfterMinutes: true,
  active: true,
  createdAt: true,
  updatedAt: true,
} as const;

const supportedWorkWeeks = ['Monday – Friday', 'Sunday – Thursday', 'Monday – Saturday'] as const;

@Injectable()
export class SchedulesService {
  constructor(private readonly prisma: PrismaService, @Optional() private readonly audit?: AuditService) {}

  findAll(includeInactive = false) {
    return this.prisma.workSchedule.findMany({
      where: includeInactive ? undefined : { active: true },
      select: scheduleSelect,
      orderBy: [{ active: 'desc' }, { name: 'asc' }],
    });
  }

  async create(dto: CreateScheduleDto, actor: RequestUser) {
    assertManager(actor);
    const data = normalizeSchedule(dto);
    try {
      const schedule = await this.prisma.workSchedule.create({ data, select: scheduleSelect });
      await this.audit?.record({ actorUserId: actor.id, action: 'WORK_SCHEDULE_CREATED', entityType: 'WorkSchedule', entityId: schedule.id, requestId: actor.requestId, metadata: { name: schedule.name } });
      return schedule;
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') throw new ConflictException('A work schedule with these details already exists');
      throw error;
    }
  }

  async update(id: string, dto: UpdateScheduleDto, actor: RequestUser) {
    assertManager(actor);
    const current = await this.prisma.workSchedule.findUnique({ where: { id }, select: scheduleSelect });
    if (!current) throw new NotFoundException('Work schedule not found');
    const data = normalizeSchedule({ ...current, ...dto });
    const schedule = await this.prisma.workSchedule.update({ where: { id }, data, select: scheduleSelect });
    await this.audit?.record({ actorUserId: actor.id, action: 'WORK_SCHEDULE_UPDATED', entityType: 'WorkSchedule', entityId: id, requestId: actor.requestId, metadata: { fields: Object.keys(dto) } });
    return schedule;
  }

  async remove(id: string, actor: RequestUser) {
    assertManager(actor);
    const current = await this.prisma.workSchedule.findUnique({ where: { id }, select: scheduleSelect });
    if (!current) throw new NotFoundException('Work schedule not found');
    if (!current.active) return current;
    const schedule = await this.prisma.workSchedule.update({ where: { id }, data: { active: false }, select: scheduleSelect });
    await this.audit?.record({ actorUserId: actor.id, action: 'WORK_SCHEDULE_DEACTIVATED', entityType: 'WorkSchedule', entityId: id, requestId: actor.requestId, metadata: { name: current.name } });
    return schedule;
  }
}

function assertManager(actor: RequestUser) {
  if (actor.role !== UserRole.ADMIN && actor.role !== UserRole.HR_MANAGER) throw new ForbiddenException('Only HR or an administrator can manage work schedules');
}

function normalizeSchedule(dto: Partial<CreateScheduleDto>) {
  const name = dto.name?.trim();
  const timezone = dto.timezone?.trim();
  if (!name) throw new BadRequestException('Schedule name is required');
  if (!timezone || !isValidTimezone(timezone)) throw new BadRequestException('Timezone must be a valid IANA timezone');
  if (!dto.workWeek || !supportedWorkWeeks.includes(dto.workWeek as (typeof supportedWorkWeeks)[number])) throw new BadRequestException('Work week is not supported');
  if (!isTime(dto.shiftStart) || !isTime(dto.shiftEnd) || dto.shiftStart === dto.shiftEnd) throw new BadRequestException('Shift start and end must be different valid times');
  if (!Number.isInteger(dto.graceMinutes) || dto.graceMinutes! < 0 || dto.graceMinutes! > 240) throw new BadRequestException('Grace period must be between 0 and 240 minutes');
  if (!Number.isInteger(dto.overtimeAfterMinutes) || dto.overtimeAfterMinutes! < 1 || dto.overtimeAfterMinutes! > 1440) throw new BadRequestException('Overtime threshold must be between 1 and 1440 minutes');
  return { name, timezone, workWeek: dto.workWeek, shiftStart: dto.shiftStart!, shiftEnd: dto.shiftEnd!, graceMinutes: dto.graceMinutes!, overtimeAfterMinutes: dto.overtimeAfterMinutes!, active: dto.active ?? true };
}

function isTime(value?: string): value is string { return Boolean(value && /^([01]\d|2[0-3]):[0-5]\d$/.test(value)); }

function isValidTimezone(timezone: string) {
  try { new Intl.DateTimeFormat('en-US', { timeZone: timezone }).format(); return true; } catch { return false; }
}
