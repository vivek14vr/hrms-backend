import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException, Optional } from '@nestjs/common';
import { EmploymentStatus, Prisma, UserRole } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { RequestUser } from '../common/types/request-user';
import { CreateEmployeeDto } from './dto/create-employee.dto';
import { UpdateEmployeeDto } from './dto/update-employee.dto';
import { UpdateMyProfileDto } from './dto/update-my-profile.dto';
import { CreateCompensationHistoryDto } from './dto/create-compensation-history.dto';
import { AuditService } from '../audit/audit.service';

const employeeInclude = {
  user: { select: { id: true, name: true, email: true, role: true, isActive: true, createdAt: true, updatedAt: true } },
  manager: { select: { id: true, employeeCode: true, firstName: true, lastName: true, department: true, designation: true } },
  schedule: { select: { id: true, name: true, timezone: true, workWeek: true, shiftStart: true, shiftEnd: true, graceMinutes: true, overtimeAfterMinutes: true, active: true } },
} as const;
const EMPLOYEE_CODE_SEQUENCE_ID = 'employee-code';
const clean = (value?: string) => value?.trim() || undefined;
const parseDate = (value: string, label: string) => { const date = new Date(value); if (Number.isNaN(date.getTime())) throw new BadRequestException(`${label} must be a valid date`); return date; };
const parseOptionalDate = (value?: string) => value ? parseDate(value, 'Date of birth') : undefined;
const parseEffectiveDate = (value: string) => parseDate(value, 'Compensation effective date');

@Injectable()
export class EmployeesService {
  constructor(private readonly prisma: PrismaService, @Optional() private readonly audit?: AuditService) {}
  async findAll(query: { search?: string; department?: string; status?: EmploymentStatus; designation?: string; page?: number; limit?: number }) {
    const page = Math.max(1, query.page ?? 1); const limit = Math.min(100, Math.max(1, query.limit ?? 10));
    const where: Prisma.EmployeeWhereInput = { department: query.department || undefined, employmentStatus: query.status, designation: query.designation || undefined, OR: query.search ? [{ firstName: { contains: query.search, mode: 'insensitive' } }, { lastName: { contains: query.search, mode: 'insensitive' } }, { email: { contains: query.search, mode: 'insensitive' } }, { employeeCode: { contains: query.search, mode: 'insensitive' } }] : undefined };
    const [items, total] = await this.prisma.$transaction([this.prisma.employee.findMany({ where, include: employeeInclude, orderBy: [{ employmentStatus: 'asc' }, { lastName: 'asc' }], skip: (page - 1) * limit, take: limit }), this.prisma.employee.count({ where })]);
    return { items, total, page, limit, totalPages: Math.ceil(total / limit) };
  }
  async findOne(id: string, user?: RequestUser) {
    if (user?.role === UserRole.EMPLOYEE && user.employeeId !== id) throw new ForbiddenException('Employees can only view their own profile');
    const employee = await this.prisma.employee.findUnique({ where: { id }, include: employeeInclude });
    if (!employee) throw new NotFoundException('Employee not found');
    return employee;
  }
  async compensationHistory(id: string, user?: RequestUser) {
    await this.findOne(id, user);
    return this.prisma.compensationHistory.findMany({ where: { employeeId: id }, orderBy: { effectiveFrom: 'desc' } });
  }
  async addCompensationHistory(id: string, dto: CreateCompensationHistoryDto, actor: RequestUser) {
    if (actor.role !== UserRole.ADMIN && actor.role !== UserRole.HR_MANAGER) throw new ForbiddenException('Only HR or an administrator can manage compensation history');
    await this.findOne(id);
    const effectiveFrom = parseEffectiveDate(dto.effectiveFrom);
    const baseSalary = new Prisma.Decimal(dto.baseSalary);
    const reason = dto.reason?.trim() || null;
    try {
      const history = await this.prisma.$transaction(async (transaction) => {
        const created = await transaction.compensationHistory.create({ data: { employeeId: id, effectiveFrom, baseSalary, reason } });
        if (effectiveFrom <= new Date()) await transaction.employee.update({ where: { id }, data: { baseSalary } });
        return created;
      });
      await this.audit?.record({ actorUserId: actor.id, action: 'COMPENSATION_HISTORY_CREATED', entityType: 'CompensationHistory', entityId: history.id, requestId: actor.requestId, metadata: { employeeId: id, effectiveFrom: effectiveFrom.toISOString() } });
      return history;
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') throw new ConflictException('A compensation record already exists for this effective date');
      throw error;
    }
  }
  async create(dto: CreateEmployeeDto, actor?: RequestUser) {
    const employee = await this.prisma.$transaction(async (transaction) => {
      const scheduleId = dto.scheduleId?.trim();
      const managerId = dto.managerId?.trim();
      if (scheduleId) {
        const schedule = await transaction.workSchedule.findFirst({ where: { id: scheduleId, active: true }, select: { id: true } });
        if (!schedule) throw new NotFoundException('Active work schedule not found');
      }
      if (managerId) {
        const manager = await transaction.employee.findFirst({ where: { id: managerId, employmentStatus: { in: [EmploymentStatus.ACTIVE, EmploymentStatus.ON_LEAVE] } }, select: { id: true } });
        if (!manager) throw new NotFoundException('Active manager not found');
      }
      const joiningDate = parseDate(dto.joiningDate, 'Joining date');
      const baseSalary = new Prisma.Decimal(dto.baseSalary);
      const sequence = await transaction.employeeCodeSequence.update({
        where: { id: EMPLOYEE_CODE_SEQUENCE_ID },
        data: { nextValue: { increment: 1 } },
      });
      const nextCode = `PO-${String(sequence.nextValue - 1).padStart(4, '0')}`;
      return transaction.employee.create({ data: {
        employeeCode: nextCode, firstName: dto.firstName.trim(), lastName: dto.lastName.trim(), email: dto.email.trim().toLowerCase(),
        phone: clean(dto.phone), department: dto.department.trim(), designation: dto.designation.trim(), employmentType: dto.employmentType,
        employmentStatus: dto.employmentStatus ?? EmploymentStatus.ACTIVE, joiningDate,
        managerName: clean(dto.managerName), location: clean(dto.location), dateOfBirth: parseOptionalDate(dto.dateOfBirth), avatarUrl: clean(dto.avatarUrl),
        address: clean(dto.address), emergencyContactName: clean(dto.emergencyContactName), emergencyContactPhone: clean(dto.emergencyContactPhone),
        baseSalary,
        schedule: scheduleId ? { connect: { id: scheduleId } } : undefined,
        manager: managerId ? { connect: { id: managerId } } : undefined,
        compensationHistory: { create: { effectiveFrom: joiningDate, baseSalary, reason: 'Initial compensation' } },
      }, include: employeeInclude });
    });
    await this.audit?.record({ actorUserId: actor?.id, action: 'EMPLOYEE_CREATED', entityType: 'Employee', entityId: employee.id, requestId: actor?.requestId, metadata: { email: employee.email } });
    return employee;
  }
  async update(id: string, dto: UpdateEmployeeDto, actor?: RequestUser) {
    const current = await this.findOne(id);
    const scheduleId = dto.scheduleId?.trim();
    const managerId = dto.managerId?.trim();
    if (scheduleId) {
      const schedule = await this.prisma.workSchedule.findFirst({ where: { id: scheduleId, active: true }, select: { id: true } });
      if (!schedule) throw new NotFoundException('Active work schedule not found');
    }
    if (managerId === id) throw new BadRequestException('An employee cannot manage themselves');
    if (managerId) {
      const manager = await this.prisma.employee.findFirst({ where: { id: managerId, employmentStatus: { in: [EmploymentStatus.ACTIVE, EmploymentStatus.ON_LEAVE] } }, select: { id: true } });
      if (!manager) throw new NotFoundException('Active manager not found');
    }
    const { scheduleId: requestedScheduleId, managerId: requestedManagerId, compensationEffectiveFrom: requestedCompensationEffectiveFrom, compensationReason: requestedCompensationReason, ...fields } = dto;
    const salaryChanged = dto.baseSalary !== undefined && Number(dto.baseSalary) !== Number(current.baseSalary);
    const data: Prisma.EmployeeUpdateInput = { ...fields, firstName: dto.firstName?.trim(), lastName: dto.lastName?.trim(), email: dto.email?.trim().toLowerCase(), phone: clean(dto.phone), department: dto.department?.trim(), designation: dto.designation?.trim(), joiningDate: dto.joiningDate ? parseDate(dto.joiningDate, 'Joining date') : undefined, managerName: clean(dto.managerName), location: clean(dto.location), dateOfBirth: parseOptionalDate(dto.dateOfBirth), avatarUrl: clean(dto.avatarUrl), address: clean(dto.address), emergencyContactName: clean(dto.emergencyContactName), emergencyContactPhone: clean(dto.emergencyContactPhone), baseSalary: dto.baseSalary !== undefined ? new Prisma.Decimal(dto.baseSalary) : undefined, schedule: requestedScheduleId === undefined ? undefined : scheduleId ? { connect: { id: scheduleId } } : { disconnect: true }, manager: requestedManagerId === undefined ? undefined : managerId ? { connect: { id: managerId } } : { disconnect: true }, compensationHistory: salaryChanged ? { create: { effectiveFrom: parseEffectiveDate(requestedCompensationEffectiveFrom ?? new Date().toISOString()), baseSalary: new Prisma.Decimal(dto.baseSalary!), reason: clean(requestedCompensationReason) ?? 'Compensation update' } } : undefined };
    const employee = await this.prisma.employee.update({ where: { id }, data, include: employeeInclude });
    await this.audit?.record({ actorUserId: actor?.id, action: 'EMPLOYEE_UPDATED', entityType: 'Employee', entityId: id, requestId: actor?.requestId, metadata: { fields: Object.keys(dto) } });
    return employee;
  }
  async updateSelf(user: RequestUser, dto: UpdateMyProfileDto) {
    if (user.role !== UserRole.EMPLOYEE || !user.employeeId) throw new ForbiddenException('Only employees can update their own profile');
    await this.findOne(user.employeeId, user);
    const data: Prisma.EmployeeUpdateInput = { phone: clean(dto.phone), avatarUrl: clean(dto.avatarUrl), address: clean(dto.address), emergencyContactName: clean(dto.emergencyContactName), emergencyContactPhone: clean(dto.emergencyContactPhone) };
    const employee = await this.prisma.employee.update({ where: { id: user.employeeId }, data, include: employeeInclude });
    await this.audit?.record({ actorUserId: user.id, action: 'EMPLOYEE_SELF_PROFILE_UPDATED', entityType: 'Employee', entityId: user.employeeId, requestId: user.requestId, metadata: { fields: Object.keys(dto) } });
    return employee;
  }
  async remove(id: string, actor?: RequestUser) { await this.findOne(id); await this.prisma.employee.update({ where: { id }, data: { employmentStatus: EmploymentStatus.INACTIVE } }); await this.audit?.record({ actorUserId: actor?.id, action: 'EMPLOYEE_DEACTIVATED', entityType: 'Employee', entityId: id, requestId: actor?.requestId }); return { success: true }; }
  async departments() { const rows = await this.prisma.employee.findMany({ distinct: ['department'], select: { department: true }, orderBy: { department: 'asc' } }); return rows.map((row) => row.department); }
}
