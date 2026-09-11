import { BadRequestException, ForbiddenException, Injectable, Optional } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import { RequestUser } from '../common/types/request-user';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateSettingsDto } from './dto/update-settings.dto';

const SETTINGS_ID = 'workspace-settings';
const defaults = { name: 'PeopleOS Demo', timezone: 'Asia/Kolkata', currency: 'INR', workWeek: 'Monday – Friday', shiftStart: '09:00', shiftEnd: '18:00', graceMinutes: 15, overtimeAfterMinutes: 480 };

@Injectable()
export class SettingsService {
  constructor(private readonly prisma: PrismaService, @Optional() private readonly audit?: AuditService) {}

  get() {
    return this.prisma.workspaceSettings.upsert({ where: { id: SETTINGS_ID }, update: {}, create: { id: SETTINGS_ID, ...defaults } });
  }

  async update(dto: UpdateSettingsDto, actor: RequestUser) {
    if (actor.role !== UserRole.ADMIN && actor.role !== UserRole.HR_MANAGER) throw new ForbiddenException('Only HR or an administrator can update workspace settings');
    const current = await this.get();
    const name = dto.name === undefined ? current.name : dto.name.trim();
    const timezone = dto.timezone === undefined ? current.timezone : dto.timezone.trim();
    const currency = dto.currency === undefined ? current.currency : dto.currency.trim().toUpperCase();
    const workWeek = dto.workWeek === undefined ? current.workWeek : dto.workWeek;
    const shiftStart = dto.shiftStart === undefined ? current.shiftStart : dto.shiftStart;
    const shiftEnd = dto.shiftEnd === undefined ? current.shiftEnd : dto.shiftEnd;
    const graceMinutes = dto.graceMinutes === undefined ? current.graceMinutes : dto.graceMinutes;
    const overtimeAfterMinutes = dto.overtimeAfterMinutes === undefined ? current.overtimeAfterMinutes : dto.overtimeAfterMinutes;
    if (!name) throw new BadRequestException('Workspace name is required');
    if (!timezone || !isValidTimezone(timezone)) throw new BadRequestException('Timezone must be a valid IANA timezone');
    if (!/^[A-Z]{3}$/.test(currency)) throw new BadRequestException('Currency must be a three-letter code');
    if (!['Monday – Friday', 'Sunday – Thursday', 'Monday – Saturday'].includes(workWeek)) throw new BadRequestException('Work week is not supported');
    if (shiftStart === shiftEnd) throw new BadRequestException('Shift start and end must be different');
    if (!Number.isInteger(graceMinutes) || graceMinutes < 0 || graceMinutes > 240) throw new BadRequestException('Grace period must be between 0 and 240 minutes');
    if (!Number.isInteger(overtimeAfterMinutes) || overtimeAfterMinutes < 1 || overtimeAfterMinutes > 1440) throw new BadRequestException('Overtime threshold must be between 1 and 1440 minutes');
    const settings = await this.prisma.workspaceSettings.update({ where: { id: SETTINGS_ID }, data: { name, timezone, currency, workWeek, shiftStart, shiftEnd, graceMinutes, overtimeAfterMinutes } });
    await this.audit?.record({ actorUserId: actor.id, action: 'WORKSPACE_SETTINGS_UPDATED', entityType: 'WorkspaceSettings', entityId: SETTINGS_ID, requestId: actor.requestId, metadata: { fields: Object.keys(dto) } });
    return settings;
  }
}

function isValidTimezone(timezone: string) {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: timezone }).format();
    return true;
  } catch {
    return false;
  }
}
