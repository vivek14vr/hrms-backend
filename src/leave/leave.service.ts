import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException, Optional } from '@nestjs/common';
import { LeaveRequestStatus, Prisma, UserRole } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { RequestUser } from '../common/types/request-user';
import { AuditService } from '../audit/audit.service';
import { CreateLeaveRequestDto } from './dto/create-leave-request.dto';
import { CreateLeaveTypeDto } from './dto/create-leave-type.dto';
import { startOfDayInTimeZone, workingDays, workingWeekdays } from '../attendance/attendance-metrics';

const requestInclude = { employee: { select: { id: true, employeeCode: true, firstName: true, lastName: true, department: true, designation: true } }, leaveType: { select: { id: true, code: true, name: true, paid: true, annualAllowance: true } }, reviewedBy: { select: { id: true, name: true, email: true } } } as const;
const balanceInclude = { employee: { select: { id: true, employeeCode: true, firstName: true, lastName: true } }, leaveType: { select: { id: true, code: true, name: true, paid: true, annualAllowance: true } } } as const;

@Injectable()
export class LeaveService {
  constructor(private readonly prisma: PrismaService, @Optional() private readonly audit?: AuditService) {}

  async findTypes(includeInactive = false) {
    return this.prisma.leaveType.findMany({ where: includeInactive ? undefined : { active: true }, orderBy: { name: 'asc' } });
  }

  async createType(dto: CreateLeaveTypeDto, actor: RequestUser) {
    if (actor.role !== UserRole.ADMIN && actor.role !== UserRole.HR_MANAGER) throw new ForbiddenException('Only HR or an administrator can manage leave types');
    const code = dto.code.trim().toUpperCase();
    const name = dto.name.trim();
    if (!code || !name) throw new BadRequestException('Leave type code and name are required');
    try {
      const leaveType = await this.prisma.leaveType.create({ data: { code, name, paid: dto.paid ?? true, annualAllowance: dto.annualAllowance } });
      await this.audit?.record({ actorUserId: actor.id, action: 'LEAVE_TYPE_CREATED', entityType: 'LeaveType', entityId: leaveType.id, requestId: actor.requestId, metadata: { code, annualAllowance: dto.annualAllowance } });
      return leaveType;
    } catch (error) { if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') throw new ConflictException('A leave type with this code already exists'); throw error; }
  }

  async findRequests(user: RequestUser, status?: LeaveRequestStatus) {
    const employeeId = user.role === UserRole.EMPLOYEE ? user.employeeId ?? '__none__' : undefined;
    return this.prisma.leaveRequest.findMany({ where: { employeeId, status }, include: requestInclude, orderBy: { createdAt: 'desc' } });
  }

  async createRequest(dto: CreateLeaveRequestDto, user: RequestUser) {
    if (user.role !== UserRole.EMPLOYEE || !user.employeeId) throw new ForbiddenException('Only employees can submit leave requests for themselves');
    const leaveType = await this.prisma.leaveType.findUnique({ where: { id: dto.leaveTypeId } });
    if (!leaveType || !leaveType.active) throw new NotFoundException('Active leave type not found');
    const startDate = dateOnly(dto.startDate, 'Start date');
    const endDate = dateOnly(dto.endDate, 'End date');
    if (endDate < startDate) throw new BadRequestException('End date must be on or after the start date');
    if (startDate.getUTCFullYear() !== endDate.getUTCFullYear()) throw new BadRequestException('Leave requests cannot span calendar years');
    const [holidays, settings, employee] = await Promise.all([
      this.prisma.holiday.findMany({ where: { active: true, date: { gte: startDate, lt: nextDay(endDate) } }, select: { date: true } }),
      this.prisma.workspaceSettings.findUnique({ where: { id: 'workspace-settings' }, select: { workWeek: true } }),
      this.prisma.employee?.findUnique ? this.prisma.employee.findUnique({ where: { id: user.employeeId }, select: { schedule: { select: { workWeek: true, active: true } } } }) : Promise.resolve(null),
    ]);
    const workWeek = employee?.schedule?.active ? employee.schedule.workWeek : settings?.workWeek;
    const days = workingDays(startDate, nextDay(endDate), holidays.map((holiday) => holiday.date), workingWeekdays(workWeek));
    if (days < 1) throw new BadRequestException('The selected dates contain no working days');
    const reason = dto.reason.trim();
    const overlap = await this.prisma.leaveRequest.findFirst({ where: { employeeId: user.employeeId, status: { in: [LeaveRequestStatus.PENDING, LeaveRequestStatus.APPROVED] }, startDate: { lte: endDate }, endDate: { gte: startDate } } });
    if (overlap) throw new ConflictException('A pending or approved leave already overlaps these dates');
    const request = await this.prisma.leaveRequest.create({ data: { employeeId: user.employeeId, leaveTypeId: leaveType.id, startDate, endDate, days, reason, status: LeaveRequestStatus.PENDING }, include: requestInclude });
    await this.audit?.record({ actorUserId: user.id, action: 'LEAVE_REQUESTED', entityType: 'LeaveRequest', entityId: request.id, requestId: user.requestId, metadata: { leaveTypeId: leaveType.id, startDate: startDate.toISOString(), endDate: endDate.toISOString(), days } });
    return request;
  }

  async cancelRequest(id: string, user: RequestUser) {
    if (user.role !== UserRole.EMPLOYEE || !user.employeeId) throw new ForbiddenException('Only employees can cancel their own leave requests');
    const settings = await this.prisma.workspaceSettings.findUnique({ where: { id: 'workspace-settings' }, select: { timezone: true } });
    const today = startOfDayInTimeZone(new Date(), settings?.timezone);
    let balanceRestored = false;
    const result = await this.prisma.$transaction(async (transaction) => {
      const request = await transaction.leaveRequest.findUnique({ where: { id }, select: { employeeId: true, status: true, startDate: true, days: true, leaveTypeId: true } });
      if (!request) throw new NotFoundException('Leave request not found');
      if (request.employeeId !== user.employeeId) throw new ForbiddenException('You can only cancel your own leave requests');
      if (request.status !== LeaveRequestStatus.PENDING && request.status !== LeaveRequestStatus.APPROVED) throw new ConflictException('Only pending or approved leave requests can be cancelled');
      if (request.status === LeaveRequestStatus.APPROVED && request.startDate <= today) throw new ConflictException('Approved leave can only be cancelled before it starts');
      if (request.status === LeaveRequestStatus.APPROVED) {
        const balance = await transaction.leaveBalance.findUnique({ where: { employeeId_leaveTypeId_year: { employeeId: request.employeeId, leaveTypeId: request.leaveTypeId, year: request.startDate.getUTCFullYear() } } });
        if (!balance) throw new ConflictException('Leave balance is unavailable for this cancellation');
        const restored = await transaction.leaveBalance.updateMany({ where: { id: balance.id, used: { gte: request.days } }, data: { used: { decrement: request.days } } });
        if (restored.count !== 1) throw new ConflictException('Leave balance could not be restored');
        balanceRestored = true;
      }
      const changed = await transaction.leaveRequest.updateMany({ where: { id, employeeId: user.employeeId, status: request.status === LeaveRequestStatus.PENDING ? LeaveRequestStatus.PENDING : { in: [LeaveRequestStatus.APPROVED] } }, data: { status: LeaveRequestStatus.CANCELLED } });
      if (changed.count !== 1) throw new ConflictException('This leave request is no longer cancellable');
      return transaction.leaveRequest.findUnique({ where: { id }, include: requestInclude });
    });
    if (!result) throw new NotFoundException('Leave request not found');
    await this.audit?.record({ actorUserId: user.id, action: 'LEAVE_REQUEST_CANCELLED', entityType: 'LeaveRequest', entityId: id, requestId: user.requestId, metadata: { status: result.status, balanceRestored } });
    return result;
  }

  async findBalances(user: RequestUser, year: number) {
    if (!Number.isInteger(year) || year < 2020 || year > 2100) throw new BadRequestException('Leave balance year must be between 2020 and 2100');
    const employeeId = user.role === UserRole.EMPLOYEE ? user.employeeId ?? '__none__' : undefined;
    return this.prisma.leaveBalance.findMany({ where: { employeeId, year }, include: balanceInclude, orderBy: { leaveType: { name: 'asc' } } });
  }

  async reviewRequest(id: string, status: LeaveRequestStatus, reviewNotes: string | undefined, user: RequestUser) {
    if (user.role !== UserRole.ADMIN && user.role !== UserRole.HR_MANAGER) throw new ForbiddenException('Only HR or an administrator can review leave requests');
    if (status !== LeaveRequestStatus.APPROVED && status !== LeaveRequestStatus.REJECTED) throw new BadRequestException('A leave review must approve or reject the request');
    const reviewedAt = new Date();
    const notes = reviewNotes?.trim() || null;
    const result = await this.prisma.$transaction(async (transaction) => {
      const request = await transaction.leaveRequest.findUnique({ where: { id }, include: { leaveType: true } });
      if (!request) throw new NotFoundException('Leave request not found');
      if (request.status !== LeaveRequestStatus.PENDING) throw new ConflictException('This leave request has already been reviewed');
      if (status === LeaveRequestStatus.REJECTED) return transaction.leaveRequest.update({ where: { id }, data: { status, reviewNotes: notes, reviewedById: user.id, reviewedAt }, include: requestInclude });

      const balance = await transaction.leaveBalance.findUnique({ where: { employeeId_leaveTypeId_year: { employeeId: request.employeeId, leaveTypeId: request.leaveTypeId, year: request.startDate.getUTCFullYear() } } });
      if (!balance) {
        if (request.days > request.leaveType.annualAllowance) throw new ConflictException('Insufficient leave balance');
        await transaction.leaveBalance.create({ data: { employeeId: request.employeeId, leaveTypeId: request.leaveTypeId, year: request.startDate.getUTCFullYear(), allocated: request.leaveType.annualAllowance, used: request.days } });
      } else {
        const changed = await transaction.leaveBalance.updateMany({ where: { id: balance.id, used: { lte: balance.allocated - request.days } }, data: { used: { increment: request.days } } });
        if (changed.count !== 1) throw new ConflictException('Insufficient leave balance');
      }
      return transaction.leaveRequest.update({ where: { id }, data: { status, reviewNotes: notes, reviewedById: user.id, reviewedAt }, include: requestInclude });
    });
    await this.audit?.record({ actorUserId: user.id, action: status === LeaveRequestStatus.APPROVED ? 'LEAVE_REQUEST_APPROVED' : 'LEAVE_REQUEST_REJECTED', entityType: 'LeaveRequest', entityId: id, requestId: user.requestId, metadata: { status, days: result.days } });
    return result;
  }
}

function dateOnly(value: string, label: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new BadRequestException(`${label} must use YYYY-MM-DD format`);
  const date = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value) throw new BadRequestException(`${label} must be a valid date`);
  return date;
}

function nextDay(date: Date) { return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate() + 1)); }
