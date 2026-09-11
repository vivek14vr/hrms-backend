import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException, Optional } from '@nestjs/common';
import { PaymentStatus, PayrollRunStatus, Prisma, UserRole } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { RequestUser } from '../common/types/request-user';
import { CreateSalarySlipDto } from './dto/create-salary-slip.dto';
import { UpdateSalarySlipDto } from './dto/update-salary-slip.dto';
import { AuditService } from '../audit/audit.service';

const include = { employee: { select: { id: true, employeeCode: true, firstName: true, lastName: true, email: true, department: true, designation: true, avatarUrl: true, employmentStatus: true } }, payrollRun: { select: { id: true, status: true } } } as const;
const runInclude = { createdBy: { select: { id: true, name: true, email: true } }, approvedBy: { select: { id: true, name: true, email: true } } } as const;
const LOCKED_RUN_STATUSES = new Set<PayrollRunStatus>([PayrollRunStatus.APPROVED, PayrollRunStatus.PROCESSED, PayrollRunStatus.PAID]);
const NEXT_RUN_STATUS: Partial<Record<PayrollRunStatus, PayrollRunStatus>> = { [PayrollRunStatus.DRAFT]: PayrollRunStatus.REVIEW, [PayrollRunStatus.REVIEW]: PayrollRunStatus.APPROVED, [PayrollRunStatus.APPROVED]: PayrollRunStatus.PROCESSED, [PayrollRunStatus.PROCESSED]: PayrollRunStatus.PAID };
const money = (value: unknown) => Number(value ?? 0);

type PayrollAmounts = {
  basicSalary: number;
  houseRentAllowance: number;
  transportAllowance: number;
  performanceBonus: number;
  providentFund: number;
  professionalTax: number;
  incomeTax: number;
  otherDeductions: number;
};

function validatePeriod(month: number, year: number) {
  if (!Number.isInteger(month) || month < 1 || month > 12) throw new BadRequestException('Payroll month must be between 1 and 12');
  if (!Number.isInteger(year) || year < 2020 || year > 2100) throw new BadRequestException('Payroll year must be between 2020 and 2100');
}

function parsePaymentDate(value: string | null | undefined) {
  if (value == null) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) throw new BadRequestException('Payment date must be a valid date');
  return date;
}

function calculatePayrollTotals(values: PayrollAmounts) {
  for (const [name, value] of Object.entries(values)) {
    if (!Number.isFinite(value) || value < 0) throw new BadRequestException(`${name} must be a finite, non-negative amount`);
  }

  const grossSalary = values.basicSalary + values.houseRentAllowance + values.transportAllowance + values.performanceBonus;
  const totalDeductions = values.providentFund + values.professionalTax + values.incomeTax + values.otherDeductions;
  if (totalDeductions > grossSalary) throw new BadRequestException('Total deductions cannot exceed gross salary');

  return { ...values, grossSalary, totalDeductions, netSalary: grossSalary - totalDeductions };
}

type SalarySlipWithRelations = Prisma.SalarySlipGetPayload<{ include: typeof include }>;
type PayrollRunWithRelations = Prisma.PayrollRunGetPayload<{ include: typeof runInclude }>;

function serialize(row: SalarySlipWithRelations) { return { ...row, basicSalary: money(row.basicSalary), houseRentAllowance: money(row.houseRentAllowance), transportAllowance: money(row.transportAllowance), performanceBonus: money(row.performanceBonus), providentFund: money(row.providentFund), professionalTax: money(row.professionalTax), incomeTax: money(row.incomeTax), otherDeductions: money(row.otherDeductions), grossSalary: money(row.grossSalary), totalDeductions: money(row.totalDeductions), netSalary: money(row.netSalary) }; }
function serializeRun(row: PayrollRunWithRelations) { return { ...row, totalGross: money(row.totalGross), totalDeductions: money(row.totalDeductions), totalNet: money(row.totalNet) }; }

@Injectable()
export class PayrollService {
  constructor(private readonly prisma: PrismaService, @Optional() private readonly audit?: AuditService) {}
  async findRuns() {
    const rows = await this.prisma.payrollRun.findMany({ include: runInclude, orderBy: [{ year: 'desc' }, { month: 'desc' }] });
    return rows.map(serializeRun);
  }

  async createRun(dto: { month: number; year: number }, user: RequestUser) {
    validatePeriod(dto.month, dto.year);
    try {
      const run = await this.prisma.$transaction(async (transaction) => {
        const slips = await transaction.salarySlip.findMany({ where: { month: dto.month, year: dto.year }, select: { basicSalary: true, houseRentAllowance: true, transportAllowance: true, performanceBonus: true, providentFund: true, professionalTax: true, incomeTax: true, otherDeductions: true, paymentStatus: true } });
        if (slips.some((slip) => slip.paymentStatus === PaymentStatus.PAID)) throw new ConflictException('A payroll run cannot be created for a period with paid slips');
        const totals = slips.reduce((result, slip) => ({ gross: result.gross + money(slip.basicSalary) + money(slip.houseRentAllowance) + money(slip.transportAllowance) + money(slip.performanceBonus), deductions: result.deductions + money(slip.providentFund) + money(slip.professionalTax) + money(slip.incomeTax) + money(slip.otherDeductions) }), { gross: 0, deductions: 0 });
        if (totals.deductions > totals.gross) throw new BadRequestException('Payroll run deductions cannot exceed gross pay');
        const created = await transaction.payrollRun.create({ data: { month: dto.month, year: dto.year, totalGross: totals.gross, totalDeductions: totals.deductions, totalNet: totals.gross - totals.deductions, slipCount: slips.length, createdById: user.id }, include: runInclude });
        await transaction.salarySlip.updateMany({ where: { month: dto.month, year: dto.year, payrollRunId: null }, data: { payrollRunId: created.id } });
        return created;
      });
      await this.audit?.record({ actorUserId: user.id, action: 'PAYROLL_RUN_CREATED', entityType: 'PayrollRun', entityId: run.id, requestId: user.requestId, metadata: { month: dto.month, year: dto.year, slipCount: run.slipCount } });
      return serializeRun(run);
    } catch (error) { if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') throw new ConflictException('A payroll run already exists for this period'); throw error; }
  }

  async updateRunStatus(id: string, status: PayrollRunStatus, user: RequestUser) {
    const updated = await this.prisma.$transaction(async (transaction) => {
      const current = await transaction.payrollRun.findUnique({ where: { id } });
      if (!current) throw new NotFoundException('Payroll run not found');
      if (NEXT_RUN_STATUS[current.status] !== status) throw new BadRequestException(`Payroll run can only move from ${current.status} to ${NEXT_RUN_STATUS[current.status] ?? 'a terminal state'}`);
      if (current.status === PayrollRunStatus.DRAFT && current.slipCount === 0) throw new BadRequestException('A payroll run must contain at least one salary slip before review');
      const now = new Date();
      if (status === PayrollRunStatus.PROCESSED) await transaction.salarySlip.updateMany({ where: { payrollRunId: id }, data: { paymentStatus: PaymentStatus.PROCESSING } });
      if (status === PayrollRunStatus.PAID) await transaction.salarySlip.updateMany({ where: { payrollRunId: id }, data: { paymentStatus: PaymentStatus.PAID, paymentDate: now } });
      return transaction.payrollRun.update({ where: { id }, data: { status, approvedById: status === PayrollRunStatus.APPROVED ? user.id : undefined, processedAt: status === PayrollRunStatus.PROCESSED ? now : undefined, paidAt: status === PayrollRunStatus.PAID ? now : undefined }, include: runInclude });
    });
    await this.audit?.record({ actorUserId: user.id, action: 'PAYROLL_RUN_STATUS_CHANGED', entityType: 'PayrollRun', entityId: id, requestId: user.requestId, metadata: { status } });
    return serializeRun(updated);
  }
  async findAll(user: RequestUser, query: { employeeId?: string; department?: string; month?: number; year?: number; paymentStatus?: PaymentStatus; page?: number; limit?: number }) {
    if (query.month !== undefined || query.year !== undefined) validatePeriod(query.month ?? 1, query.year ?? 2020);
    const page = Math.max(1, query.page ?? 1); const limit = Math.min(100, Math.max(1, query.limit ?? 20));
    const employeeId = user.role === UserRole.EMPLOYEE ? user.employeeId ?? '__none__' : query.employeeId;
    const where: Prisma.SalarySlipWhereInput = { employeeId, month: query.month, year: query.year, paymentStatus: query.paymentStatus, employee: query.department ? { department: query.department } : undefined };
    const [items, total] = await this.prisma.$transaction([this.prisma.salarySlip.findMany({ where, include, orderBy: [{ year: 'desc' }, { month: 'desc' }], skip: (page - 1) * limit, take: limit }), this.prisma.salarySlip.count({ where })]);
    return { items: items.map(serialize), total, page, limit, totalPages: Math.ceil(total / limit) };
  }
  async findOne(id: string, user: RequestUser) {
    const row = await this.prisma.salarySlip.findUnique({ where: { id }, include });
    if (!row) throw new NotFoundException('Salary slip not found');
    if (user.role === UserRole.EMPLOYEE && row.employeeId !== user.employeeId) throw new ForbiddenException('Employees can only view their own salary slips');
    return serialize(row);
  }
  async forEmployee(employeeId: string, user: RequestUser, query: { month?: number; year?: number }) {
    if (user.role === UserRole.EMPLOYEE && user.employeeId !== employeeId) throw new ForbiddenException('Employees can only view their own salary slips');
    if (query.month !== undefined || query.year !== undefined) validatePeriod(query.month ?? 1, query.year ?? 2020);
    const rows = await this.prisma.salarySlip.findMany({ where: { employeeId, month: query.month, year: query.year }, include, orderBy: [{ year: 'desc' }, { month: 'desc' }] });
    return rows.map(serialize);
  }
  async create(employeeId: string, dto: CreateSalarySlipDto, actor?: RequestUser) {
    const employee = await this.prisma.employee.findUnique({ where: { id: employeeId } }); if (!employee) throw new NotFoundException('Employee not found');
    validatePeriod(dto.month, dto.year);
    const run = await this.prisma.payrollRun.findUnique({ where: { month_year: { month: dto.month, year: dto.year } } });
    if (run && LOCKED_RUN_STATUSES.has(run.status)) throw new ConflictException('Salary slips cannot be changed after payroll approval');
    const effectiveCompensation = dto.basicSalary === undefined && this.prisma.compensationHistory?.findFirst ? await this.prisma.compensationHistory.findFirst({ where: { employeeId, effectiveFrom: { lte: new Date() } }, orderBy: { effectiveFrom: 'desc' }, select: { baseSalary: true } }) : null;
    const basic = dto.basicSalary ?? Number(effectiveCompensation?.baseSalary ?? employee.baseSalary);
    const totals = calculatePayrollTotals({
      basicSalary: basic,
      houseRentAllowance: dto.houseRentAllowance ?? Math.round(basic * 0.2),
      transportAllowance: dto.transportAllowance ?? 2400,
      performanceBonus: dto.performanceBonus ?? 0,
      providentFund: dto.providentFund ?? Math.round(basic * 0.12),
      professionalTax: dto.professionalTax ?? 200,
      incomeTax: dto.incomeTax ?? Math.round(basic * 0.08),
      otherDeductions: dto.otherDeductions ?? 0,
    });
    try {
      const row = await this.prisma.salarySlip.create({ data: { employeeId, month: dto.month, year: dto.year, ...totals, paymentStatus: dto.paymentStatus ?? PaymentStatus.PENDING, paymentDate: parsePaymentDate(dto.paymentDate), payrollRunId: run?.id }, include });
      if (run) await this.refreshRunTotals(this.prisma, run.id);
      await this.audit?.record({ actorUserId: actor?.id, action: 'SALARY_SLIP_CREATED', entityType: 'SalarySlip', entityId: row.id, requestId: actor?.requestId, metadata: { employeeId, month: dto.month, year: dto.year } });
      return serialize(row);
    } catch (error) { if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') throw new ConflictException('A salary slip already exists for this period'); throw error; }
  }
  async update(id: string, dto: UpdateSalarySlipDto, actor?: RequestUser) {
    const current = await this.prisma.salarySlip.findUnique({ where: { id }, include: { payrollRun: { select: { id: true, status: true } } } }); if (!current) throw new NotFoundException('Salary slip not found');
    const month = dto.month ?? current.month;
    const year = dto.year ?? current.year;
    validatePeriod(month, year);
    if (current.payrollRun && LOCKED_RUN_STATUSES.has(current.payrollRun.status)) throw new ConflictException('Salary slips cannot be changed after payroll approval');
    if (current.payrollRun && (month !== current.month || year !== current.year)) throw new BadRequestException('A salary slip linked to a payroll run cannot change period');
    const targetRun = await this.prisma.payrollRun.findUnique({ where: { month_year: { month, year } } });
    if (targetRun && LOCKED_RUN_STATUSES.has(targetRun.status)) throw new ConflictException('Salary slips cannot be changed after payroll approval');
    const totals = calculatePayrollTotals({
      basicSalary: dto.basicSalary ?? money(current.basicSalary),
      houseRentAllowance: dto.houseRentAllowance ?? money(current.houseRentAllowance),
      transportAllowance: dto.transportAllowance ?? money(current.transportAllowance),
      performanceBonus: dto.performanceBonus ?? money(current.performanceBonus),
      providentFund: dto.providentFund ?? money(current.providentFund),
      professionalTax: dto.professionalTax ?? money(current.professionalTax),
      incomeTax: dto.incomeTax ?? money(current.incomeTax),
      otherDeductions: dto.otherDeductions ?? money(current.otherDeductions),
    });
    const data: Prisma.SalarySlipUpdateInput = { ...totals, month, year };
    if (dto.paymentStatus !== undefined) data.paymentStatus = dto.paymentStatus;
    if (dto.paymentDate !== undefined) data.paymentDate = parsePaymentDate(dto.paymentDate);
    const row = await this.prisma.salarySlip.update({ where: { id }, data, include });
    if (current.payrollRunId) await this.refreshRunTotals(this.prisma, current.payrollRunId);
    await this.audit?.record({ actorUserId: actor?.id, action: 'SALARY_SLIP_UPDATED', entityType: 'SalarySlip', entityId: id, requestId: actor?.requestId, metadata: { fields: Object.keys(dto) } });
    return serialize(row);
  }
  async remove(id: string, actor?: RequestUser) { const current = await this.prisma.salarySlip.findUnique({ where: { id }, include: { payrollRun: { select: { id: true, status: true } } } }); if (!current) throw new NotFoundException('Salary slip not found'); if (current.payrollRun && LOCKED_RUN_STATUSES.has(current.payrollRun.status)) throw new ConflictException('Salary slips cannot be deleted after payroll approval'); await this.prisma.salarySlip.delete({ where: { id } }); if (current.payrollRunId) await this.refreshRunTotals(this.prisma, current.payrollRunId); await this.audit?.record({ actorUserId: actor?.id, action: 'SALARY_SLIP_DELETED', entityType: 'SalarySlip', entityId: id, requestId: actor?.requestId }); return { success: true }; }

  private async refreshRunTotals(db: Pick<PrismaService, 'salarySlip' | 'payrollRun'>, runId: string) {
    const slips = await db.salarySlip.findMany({ where: { payrollRunId: runId }, select: { basicSalary: true, houseRentAllowance: true, transportAllowance: true, performanceBonus: true, providentFund: true, professionalTax: true, incomeTax: true, otherDeductions: true } });
    const totals = slips.reduce((result, slip) => ({ gross: result.gross + money(slip.basicSalary) + money(slip.houseRentAllowance) + money(slip.transportAllowance) + money(slip.performanceBonus), deductions: result.deductions + money(slip.providentFund) + money(slip.professionalTax) + money(slip.incomeTax) + money(slip.otherDeductions) }), { gross: 0, deductions: 0 });
    return db.payrollRun.update({ where: { id: runId }, data: { totalGross: totals.gross, totalDeductions: totals.deductions, totalNet: totals.gross - totals.deductions, slipCount: slips.length } });
  }
}
