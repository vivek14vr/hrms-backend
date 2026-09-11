import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException, Optional } from '@nestjs/common';
import { AttendanceCorrectionStatus, AttendanceStatus, EmploymentStatus, Prisma, UserRole } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { RequestUser } from '../common/types/request-user';
import { CreateAttendanceDto } from './dto/create-attendance.dto';
import { UpdateAttendanceDto } from './dto/update-attendance.dto';
import { CreateAttendanceCorrectionDto } from './dto/create-attendance-correction.dto';
import { ReviewAttendanceCorrectionDto } from './dto/review-attendance-correction.dto';
import { AuditService } from '../audit/audit.service';
import { calendarDateInTimeZone, clockMinutes, dateAtUtcMidnight, minutesInTimeZone, monthPeriod, startOfDayInTimeZone, workingDays, workingWeekdays } from './attendance-metrics';

const include = { employee: { select: { id: true, employeeCode: true, firstName: true, lastName: true, department: true, designation: true, avatarUrl: true } } } as const;
const PUNCH_STATUSES = new Set<AttendanceStatus>([AttendanceStatus.PRESENT, AttendanceStatus.LATE, AttendanceStatus.WORK_FROM_HOME]);
const NON_PUNCH_STATUSES = new Set<AttendanceStatus>([AttendanceStatus.ABSENT, AttendanceStatus.LEAVE]);
const correctionInclude = { employee: { select: { id: true, employeeCode: true, firstName: true, lastName: true, department: true, designation: true, avatarUrl: true } }, reviewedBy: { select: { id: true, name: true, email: true } } } as const;

type AttendanceQuery = { employeeId?: string; department?: string; status?: AttendanceStatus; dateFrom?: string; dateTo?: string; page?: number; limit?: number };
type AttendanceWithEmployee = Prisma.AttendanceRecordGetPayload<{ include: typeof include }>;
type AttendancePolicy = { timezone: string; shiftStart: string; shiftEnd: string; graceMinutes: number; overtimeAfterMinutes: number };

@Injectable()
export class AttendanceService {
  constructor(private readonly prisma: PrismaService, @Optional() private readonly audit?: AuditService) {}
  async findAll(user: RequestUser, query: AttendanceQuery) {
    const page = Math.max(1, query.page ?? 1); const limit = Math.min(100, Math.max(1, query.limit ?? 20));
    const employeeId = user.role === UserRole.EMPLOYEE ? user.employeeId ?? '__none__' : query.employeeId;
    const where: Prisma.AttendanceRecordWhereInput = { employeeId, status: query.status, employee: query.department ? { department: query.department } : undefined, date: { gte: query.dateFrom ? new Date(query.dateFrom) : undefined, lte: query.dateTo ? new Date(`${query.dateTo}T23:59:59.999Z`) : undefined } };
    const [items, total] = await this.prisma.$transaction([this.prisma.attendanceRecord.findMany({ where, include, orderBy: { date: 'desc' }, skip: (page - 1) * limit, take: limit }), this.prisma.attendanceRecord.count({ where })]);
    return { items, total, page, limit, totalPages: Math.ceil(total / limit) };
  }
  async summary(user: RequestUser, month?: number, year?: number) {
    validateSummaryPeriod(month, year);
    const now = new Date();
    const [settings, employee] = await Promise.all([
      this.prisma.workspaceSettings.findUnique({ where: { id: 'workspace-settings' }, select: { timezone: true, workWeek: true } }),
      user.role === UserRole.EMPLOYEE && user.employeeId && this.prisma.employee?.findUnique ? this.prisma.employee.findUnique({ where: { id: user.employeeId }, select: { schedule: { select: { timezone: true, workWeek: true, active: true } } } }) : Promise.resolve(null),
    ]);
    const schedule = employee?.schedule?.active ? employee.schedule : null;
    const timezone = schedule?.timezone ?? settings?.timezone;
    const workWeek = schedule?.workWeek ?? settings?.workWeek;
    const currentDate = calendarDateInTimeZone(now, timezone);
    const selectedMonth = month ?? Number(currentDate.slice(5, 7)); const selectedYear = year ?? Number(currentDate.slice(0, 4));
    const { start, endExclusive } = monthPeriod(selectedMonth, selectedYear, now, timezone);
    const employeeId = user.role === UserRole.EMPLOYEE ? user.employeeId ?? '__none__' : undefined;
    const where: Prisma.AttendanceRecordWhereInput = { employeeId, date: { gte: start, lt: endExclusive } };
    const [rows, employeeCount, holidays] = await Promise.all([
      this.prisma.attendanceRecord.findMany({ where, select: { status: true } }),
      user.role === UserRole.EMPLOYEE ? Promise.resolve(user.employeeId ? 1 : 0) : this.prisma.employee.count({ where: { employmentStatus: EmploymentStatus.ACTIVE } }),
      this.prisma.holiday.findMany({ where: { active: true, date: { gte: start, lt: endExclusive } }, select: { date: true } }),
    ]);
    const count = (status: AttendanceStatus) => rows.filter((row) => row.status === status).length;
    const workingStatuses = new Set<AttendanceStatus>([AttendanceStatus.PRESENT, AttendanceStatus.LATE, AttendanceStatus.WORK_FROM_HOME]);
    const working = rows.filter((row) => workingStatuses.has(row.status)).length;
    const expectedWorkingDays = employeeCount * workingDays(start, endExclusive, holidays.map((holiday) => holiday.date), workingWeekdays(workWeek));
    return { month: selectedMonth, year: selectedYear, total: rows.length, expectedWorkingDays, present: count(AttendanceStatus.PRESENT), absent: count(AttendanceStatus.ABSENT), late: count(AttendanceStatus.LATE), leave: count(AttendanceStatus.LEAVE), workFromHome: count(AttendanceStatus.WORK_FROM_HOME), attendancePercentage: expectedWorkingDays ? Math.min(100, Math.round((working / expectedWorkingDays) * 100)) : 0 };
  }
  async clockIn(user: RequestUser) {
    const employeeId = this.employeeIdForUser(user);
    const now = new Date();
    const policy = effectivePolicy(await this.workspacePolicy(employeeId));
    const date = attendanceDateForPunch(now, policy);
    const existing = await this.prisma.attendanceRecord.findUnique({ where: { employeeId_date: { employeeId, date } } });
    if (existing) throw new ConflictException(existing.checkIn ? 'You are already clocked in today' : 'A record already exists for today; request an attendance correction');
    const status = isLatePunch(now, policy) ? AttendanceStatus.LATE : AttendanceStatus.PRESENT;
    const record = await this.prisma.attendanceRecord.create({ data: { employeeId, date, checkIn: now, status }, include });
    await this.audit?.record({ actorUserId: user.id, action: 'ATTENDANCE_CLOCKED_IN', entityType: 'AttendanceRecord', entityId: record.id, requestId: user.requestId, metadata: { employeeId } });
    return record;
  }
  async clockOut(user: RequestUser) {
    const employeeId = this.employeeIdForUser(user);
    const checkOut = new Date();
    const policy = effectivePolicy(await this.workspacePolicy(employeeId));
    const date = attendanceDateForPunch(checkOut, policy);
    const record = await this.prisma.attendanceRecord.findUnique({ where: { employeeId_date: { employeeId, date } } });
    if (!record?.checkIn) throw new BadRequestException('Clock in before clocking out');
    if (record.checkOut) throw new ConflictException('You are already clocked out today');
    if (checkOut <= record.checkIn) throw new BadRequestException('Clock-out time must be after clock-in time');
    const workHours = Math.round(((checkOut.getTime() - record.checkIn.getTime()) / 3_600_000) * 100) / 100;
    const updated = await this.prisma.attendanceRecord.update({ where: { id: record.id }, data: { checkOut, workHours: new Prisma.Decimal(workHours), overtimeHours: new Prisma.Decimal(overtimeHoursFor(workHours, policy.overtimeAfterMinutes)) }, include });
    await this.audit?.record({ actorUserId: user.id, action: 'ATTENDANCE_CLOCKED_OUT', entityType: 'AttendanceRecord', entityId: record.id, requestId: user.requestId, metadata: { employeeId, workHours } });
    return updated;
  }
  async corrections(user: RequestUser, requestStatus?: AttendanceCorrectionStatus) {
    const employeeId = user.role === UserRole.EMPLOYEE ? user.employeeId ?? '__none__' : undefined;
    return this.prisma.attendanceCorrectionRequest.findMany({ where: { employeeId, requestStatus }, include: correctionInclude, orderBy: { createdAt: 'desc' } });
  }
  async createCorrection(dto: CreateAttendanceCorrectionDto, user: RequestUser) {
    const employeeId = this.employeeIdForUser(user);
    const policy = effectivePolicy(await this.workspacePolicy(employeeId));
    const normalized = this.validateRecord({ date: dto.date, checkIn: dto.checkIn, checkOut: dto.checkOut, workHours: dto.workHours, status: dto.status }, policy.timezone, policy);
    const reason = dto.reason.trim();
    if (reason.length < 3) throw new BadRequestException('A correction reason is required');
    const pending = await this.prisma.attendanceCorrectionRequest.findFirst({ where: { employeeId, date: normalized.date, requestStatus: AttendanceCorrectionStatus.PENDING } });
    if (pending) throw new ConflictException('A correction request is already pending for this date');
    const request = await this.prisma.attendanceCorrectionRequest.create({ data: { employeeId, date: normalized.date, checkIn: normalized.checkIn, checkOut: normalized.checkOut, workHours: normalized.workHours, status: dto.status, reason }, include: correctionInclude });
    await this.audit?.record({ actorUserId: user.id, action: 'ATTENDANCE_CORRECTION_REQUESTED', entityType: 'AttendanceCorrectionRequest', entityId: request.id, requestId: user.requestId, metadata: { employeeId, date: normalized.date.toISOString(), status: dto.status } });
    return request;
  }
  async reviewCorrection(id: string, dto: ReviewAttendanceCorrectionDto, user: RequestUser) {
    if (user.role !== UserRole.ADMIN && user.role !== UserRole.HR_MANAGER) throw new ForbiddenException('Only HR or an administrator can review attendance corrections');
    if (dto.status === AttendanceCorrectionStatus.PENDING) throw new BadRequestException('A correction review must approve or reject the request');
    const request = await this.prisma.attendanceCorrectionRequest.findUnique({ where: { id } });
    if (!request) throw new NotFoundException('Attendance correction request not found');
    if (request.requestStatus !== AttendanceCorrectionStatus.PENDING) throw new ConflictException('This attendance correction has already been reviewed');
    const reviewedAt = new Date();
    const reviewNotes = dto.reviewNotes?.trim() || null;
    if (dto.status === AttendanceCorrectionStatus.REJECTED) {
      const rejected = await this.prisma.attendanceCorrectionRequest.update({ where: { id }, data: { requestStatus: dto.status, reviewNotes, reviewedById: user.id, reviewedAt }, include: correctionInclude });
      await this.audit?.record({ actorUserId: user.id, action: 'ATTENDANCE_CORRECTION_REJECTED', entityType: 'AttendanceCorrectionRequest', entityId: id, requestId: user.requestId });
      return rejected;
    }

    const policy = effectivePolicy(await this.workspacePolicy(request.employeeId));
    const normalized = this.validateRecord({ date: request.date, checkIn: request.checkIn, checkOut: request.checkOut, workHours: request.workHours === null ? undefined : Number(request.workHours), status: request.status }, policy.timezone, policy);
    const result = await this.prisma.$transaction(async (transaction) => {
      const current = await transaction.attendanceCorrectionRequest.findUnique({ where: { id } });
      if (!current || current.requestStatus !== AttendanceCorrectionStatus.PENDING) throw new ConflictException('This attendance correction has already been reviewed');
      const attendance = await transaction.attendanceRecord.findUnique({ where: { employeeId_date: { employeeId: current.employeeId, date: normalized.date } } });
      const data = { date: normalized.date, checkIn: normalized.checkIn, checkOut: normalized.checkOut, workHours: normalized.workHours, overtimeHours: new Prisma.Decimal(overtimeHoursFor(normalized.workHours === null ? null : Number(normalized.workHours), policy.overtimeAfterMinutes)), status: current.status, notes: attendance?.notes ?? `Correction approved: ${current.reason}` };
      const applied = attendance ? await transaction.attendanceRecord.update({ where: { id: attendance.id }, data, include }) : await transaction.attendanceRecord.create({ data: { ...data, employeeId: current.employeeId }, include });
      const reviewed = await transaction.attendanceCorrectionRequest.update({ where: { id }, data: { requestStatus: dto.status, reviewNotes, reviewedById: user.id, reviewedAt }, include: correctionInclude });
      return { request: reviewed, attendance: applied };
    });
    await this.audit?.record({ actorUserId: user.id, action: 'ATTENDANCE_CORRECTION_APPROVED', entityType: 'AttendanceCorrectionRequest', entityId: id, requestId: user.requestId, metadata: { employeeId: result.request.employeeId } });
    return result;
  }
  async create(dto: CreateAttendanceDto, user: RequestUser) {
    if (user.role === UserRole.EMPLOYEE) throw new ForbiddenException('Employees must use clock-in and clock-out actions');
    const employeeId = dto.employeeId;
    if (!employeeId) throw new ForbiddenException('An employee record is required');
    const employee = await this.prisma.employee.findUnique({ where: { id: employeeId } }); if (!employee) throw new NotFoundException('Employee not found');
    const policy = effectivePolicy(await this.workspacePolicy(employeeId));
    const normalized = this.validateRecord({ date: dto.date, checkIn: dto.checkIn, checkOut: dto.checkOut, workHours: dto.workHours, status: dto.status }, policy.timezone, policy);
    const existing = await this.prisma.attendanceRecord.findUnique({ where: { employeeId_date: { employeeId, date: normalized.date } } });
    if (existing) throw new ConflictException('An attendance record already exists for this employee and date');
    const record = await this.prisma.attendanceRecord.create({ data: { employeeId, date: normalized.date, checkIn: normalized.checkIn, checkOut: normalized.checkOut, workHours: normalized.workHours, overtimeHours: new Prisma.Decimal(overtimeHoursFor(normalized.workHours === null ? null : Number(normalized.workHours), policy.overtimeAfterMinutes)), status: dto.status, notes: dto.notes }, include });
    await this.audit?.record({ actorUserId: user.id, action: 'ATTENDANCE_RECORD_CREATED', entityType: 'AttendanceRecord', entityId: record.id, requestId: user.requestId, metadata: { employeeId } });
    return record;
  }
  async update(id: string, dto: UpdateAttendanceDto, user: RequestUser) {
    const record = await this.prisma.attendanceRecord.findUnique({ where: { id } });
    if (!record) throw new NotFoundException('Attendance record not found');
    if (user.role === UserRole.EMPLOYEE && record.employeeId !== user.employeeId) throw new ForbiddenException('Employees can only update their own attendance');
    const policy = effectivePolicy(await this.workspacePolicy(record.employeeId));
    const normalized = this.validateRecord({ date: dto.date ?? record.date, checkIn: dto.checkIn ?? record.checkIn, checkOut: dto.checkOut ?? record.checkOut, workHours: dto.workHours ?? (record.workHours === null ? undefined : Number(record.workHours)), status: dto.status ?? record.status }, policy.timezone, policy);
    const existing = await this.prisma.attendanceRecord.findUnique({ where: { employeeId_date: { employeeId: record.employeeId, date: normalized.date } } });
    if (existing && existing.id !== id) throw new ConflictException('An attendance record already exists for this employee and date');
    const updated = await this.prisma.attendanceRecord.update({ where: { id }, data: { date: normalized.date, checkIn: normalized.checkIn, checkOut: normalized.checkOut, workHours: normalized.workHours, overtimeHours: new Prisma.Decimal(overtimeHoursFor(normalized.workHours === null ? null : Number(normalized.workHours), policy.overtimeAfterMinutes)), status: dto.status ?? record.status, notes: dto.notes ?? record.notes }, include });
    await this.audit?.record({ actorUserId: user.id, action: 'ATTENDANCE_RECORD_UPDATED', entityType: 'AttendanceRecord', entityId: id, requestId: user.requestId, metadata: { employeeId: record.employeeId } });
    return updated;
  }
  async remove(id: string, user: RequestUser) { const record = await this.prisma.attendanceRecord.findUnique({ where: { id } }); if (!record) throw new NotFoundException('Attendance record not found'); if (user.role === UserRole.EMPLOYEE && record.employeeId !== user.employeeId) throw new ForbiddenException('Employees can only delete their own attendance'); await this.prisma.attendanceRecord.delete({ where: { id } }); await this.audit?.record({ actorUserId: user.id, action: 'ATTENDANCE_RECORD_DELETED', entityType: 'AttendanceRecord', entityId: id, requestId: user.requestId, metadata: { employeeId: record.employeeId } }); return { success: true }; }
  async csv(user: RequestUser, query: Omit<AttendanceQuery, 'page' | 'limit'>) { const { items } = await this.findAll(user, { ...query, page: 1, limit: 10000 }); const header = 'Date,Employee,Department,Check-in,Check-out,Work hours,Status'; const lines = items.map((row: AttendanceWithEmployee) => [row.date.toISOString().slice(0, 10), `${row.employee.firstName} ${row.employee.lastName}`, row.employee.department, row.checkIn?.toISOString() ?? '', row.checkOut?.toISOString() ?? '', row.workHours?.toString() ?? '', row.status].map((field) => `"${String(field).replace(/"/g, '""')}"`).join(',')); return `${header}\n${lines.join('\n')}`; }
  private employeeIdForUser(user: RequestUser) { if (user.role !== UserRole.EMPLOYEE || !user.employeeId) throw new ForbiddenException('An employee record is required'); return user.employeeId; }
  private validateRecord(input: { date: string | Date; checkIn?: string | Date | null; checkOut?: string | Date | null; workHours?: number; status: AttendanceStatus }, timeZone = 'UTC', policy?: AttendancePolicy) {
    const date = normalizeAttendanceDate(input.date, timeZone);
    if (Number.isNaN(date.getTime())) throw new BadRequestException('Attendance date is invalid');
    if (date > startOfDayInTimeZone(new Date(), timeZone)) throw new BadRequestException('Attendance cannot be recorded for a future date');
    const checkIn = input.checkIn ? new Date(input.checkIn) : null;
    const checkOut = input.checkOut ? new Date(input.checkOut) : null;
    if (checkIn && Number.isNaN(checkIn.getTime())) throw new BadRequestException('Check-in time is invalid');
    if (checkOut && Number.isNaN(checkOut.getTime())) throw new BadRequestException('Check-out time is invalid');
    if (checkIn && attendanceDateForPunch(checkIn, policyForTimezone(policy, timeZone)).getTime() !== date.getTime()) throw new BadRequestException('Check-in must be on the attendance date');
    if (checkOut && attendanceDateForPunch(checkOut, policyForTimezone(policy, timeZone)).getTime() !== date.getTime()) throw new BadRequestException('Check-out must be on the attendance date');
    if (checkIn && checkOut && checkOut <= checkIn) throw new BadRequestException('Check-out must be after check-in');
    if (input.workHours !== undefined && (!Number.isFinite(input.workHours) || input.workHours < 0 || input.workHours > 24)) throw new BadRequestException('Work hours must be between 0 and 24');
    if (NON_PUNCH_STATUSES.has(input.status) && (checkIn || checkOut || (input.workHours ?? 0) > 0)) throw new BadRequestException('Absent and leave records cannot contain punch times or work hours');
    if (PUNCH_STATUSES.has(input.status) && !checkIn) throw new BadRequestException('A punch time is required for this attendance status');
    const workHours = NON_PUNCH_STATUSES.has(input.status) ? new Prisma.Decimal(0) : input.workHours === undefined ? (checkIn && checkOut ? new Prisma.Decimal(Math.round(((checkOut.getTime() - checkIn.getTime()) / 3_600_000) * 100) / 100) : null) : new Prisma.Decimal(input.workHours);
    return { date, checkIn, checkOut, workHours };
  }

  private async workspacePolicy(employeeId?: string) {
    const [settings, employee] = await Promise.all([
      this.prisma.workspaceSettings.findUnique({ where: { id: 'workspace-settings' }, select: { timezone: true, shiftStart: true, shiftEnd: true, graceMinutes: true, overtimeAfterMinutes: true } }),
      employeeId && this.prisma.employee?.findUnique ? this.prisma.employee.findUnique({ where: { id: employeeId }, select: { schedule: { select: { timezone: true, shiftStart: true, shiftEnd: true, graceMinutes: true, overtimeAfterMinutes: true, active: true } } } }) : Promise.resolve(null),
    ]);
    return employee?.schedule?.active ? employee.schedule : settings as AttendancePolicy | null;
  }
}

function validateSummaryPeriod(month?: number, year?: number) {
  if (month !== undefined && (!Number.isInteger(month) || month < 1 || month > 12)) throw new BadRequestException('Attendance month must be an integer between 1 and 12');
  if (year !== undefined && (!Number.isInteger(year) || year < 2020 || year > 2100)) throw new BadRequestException('Attendance year must be an integer between 2020 and 2100');
}

function normalizeAttendanceDate(value: string | Date, timeZone: string) {
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return value;
    return dateAtUtcMidnight(value.toISOString().slice(0, 10));
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    try { return dateAtUtcMidnight(value); } catch { return new Date(Number.NaN); }
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return parsed;
  return startOfDayInTimeZone(parsed, timeZone);
}

function overtimeHoursFor(workHours: number | null, overtimeAfterMinutes = 480) {
  if (workHours === null) return 0;
  return Math.max(0, Math.round((workHours - overtimeAfterMinutes / 60) * 100) / 100);
}

function effectivePolicy(policy: Partial<AttendancePolicy> | null | undefined): AttendancePolicy {
  return { timezone: policy?.timezone ?? 'UTC', shiftStart: policy?.shiftStart ?? '09:00', shiftEnd: policy?.shiftEnd ?? '18:00', graceMinutes: policy?.graceMinutes ?? 15, overtimeAfterMinutes: policy?.overtimeAfterMinutes ?? 480 };
}

function policyForTimezone(policy: AttendancePolicy | undefined, timeZone: string): AttendancePolicy {
  return policy ?? { timezone: timeZone, shiftStart: '09:00', shiftEnd: '18:00', graceMinutes: 15, overtimeAfterMinutes: 480 };
}

function overnightShift(policy: AttendancePolicy) { return clockMinutes(policy.shiftStart) > clockMinutes(policy.shiftEnd); }

function attendanceDateForPunch(value: Date, policy: AttendancePolicy) {
  const localDate = startOfDayInTimeZone(value, policy.timezone);
  if (overnightShift(policy) && minutesInTimeZone(value, policy.timezone) <= clockMinutes(policy.shiftEnd)) localDate.setUTCDate(localDate.getUTCDate() - 1);
  return localDate;
}

function isLatePunch(value: Date, policy: AttendancePolicy) {
  const minute = minutesInTimeZone(value, policy.timezone);
  const start = clockMinutes(policy.shiftStart);
  const end = clockMinutes(policy.shiftEnd);
  if (overnightShift(policy)) {
    if (minute < end || minute < start) return false;
  }
  return minute > start + policy.graceMinutes;
}
