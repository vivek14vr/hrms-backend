import { Injectable } from '@nestjs/common';
import { AttendanceStatus, EmploymentStatus, PaymentStatus, Prisma, UserRole } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { RequestUser } from '../common/types/request-user';
import { calendarDateInTimeZone, monthPeriod, workingDays, workingWeekdays } from '../attendance/attendance-metrics';

@Injectable()
export class DashboardService {
  constructor(private readonly prisma: PrismaService) {}
  async summary(user: RequestUser) {
    const now = new Date();
    const [settings, employee] = await Promise.all([
      this.prisma.workspaceSettings.findUnique({ where: { id: 'workspace-settings' }, select: { timezone: true, workWeek: true } }),
      user.role === UserRole.EMPLOYEE && user.employeeId && this.prisma.employee?.findUnique ? this.prisma.employee.findUnique({ where: { id: user.employeeId }, select: { schedule: { select: { timezone: true, workWeek: true, active: true } } } }) : Promise.resolve(null),
    ]);
    const schedule = employee?.schedule?.active ? employee.schedule : null;
    const timezone = schedule?.timezone ?? settings?.timezone;
    const workWeek = schedule?.workWeek ?? settings?.workWeek;
    const currentDate = calendarDateInTimeZone(now, timezone);
    const currentMonth = Number(currentDate.slice(5, 7)); const currentYear = Number(currentDate.slice(0, 4));
    const { start, endExclusive: end } = monthPeriod(currentMonth, currentYear, now, timezone);
    const employeeWhere = user.role === UserRole.EMPLOYEE ? { id: user.employeeId ?? '__none__' } : {};
    const [totalEmployees, activeEmployees, employeesOnLeave, attendanceRows, currentPayroll, pendingPayroll, holidays] = await Promise.all([
      this.prisma.employee.count({ where: employeeWhere }), this.prisma.employee.count({ where: { ...employeeWhere, employmentStatus: 'ACTIVE' } }), this.prisma.employee.count({ where: { ...employeeWhere, employmentStatus: 'ON_LEAVE' } }),
      this.prisma.attendanceRecord.findMany({ where: { employeeId: user.role === UserRole.EMPLOYEE ? user.employeeId ?? '__none__' : undefined, date: { gte: start, lt: end } }, select: { status: true } }),
      this.prisma.salarySlip.aggregate({ where: { employeeId: user.role === UserRole.EMPLOYEE ? user.employeeId ?? '__none__' : undefined, month: currentMonth, year: currentYear }, _sum: { netSalary: true } }),
      this.prisma.salarySlip.aggregate({ where: { employeeId: user.role === UserRole.EMPLOYEE ? user.employeeId ?? '__none__' : undefined, paymentStatus: { in: [PaymentStatus.PENDING, PaymentStatus.PROCESSING] } }, _sum: { netSalary: true } }),
      this.prisma.holiday.findMany({ where: { active: true, date: { gte: start, lt: end } }, select: { date: true } }),
    ]);
    const workingStatuses = new Set<AttendanceStatus>([AttendanceStatus.PRESENT, AttendanceStatus.LATE, AttendanceStatus.WORK_FROM_HOME]);
    const working = attendanceRows.filter((row) => workingStatuses.has(row.status)).length;
    const expectedEmployeeCount = user.role === UserRole.EMPLOYEE ? (user.employeeId ? 1 : 0) : activeEmployees;
    const expectedWorkingDays = expectedEmployeeCount * workingDays(start, end, holidays.map((holiday) => holiday.date), workingWeekdays(workWeek));
    return { totalEmployees, activeEmployees, employeesOnLeave, expectedWorkingDays, attendancePercentage: expectedWorkingDays ? Math.min(100, Math.round((working / expectedWorkingDays) * 100)) : 0, monthlyPayrollTotal: Number(currentPayroll._sum.netSalary ?? 0), pendingPayroll: Number(pendingPayroll._sum.netSalary ?? 0) };
  }
  async attendanceTrend(user: RequestUser, months = 6) {
    const now = new Date(); const [settings, employee] = await Promise.all([this.prisma.workspaceSettings.findUnique({ where: { id: 'workspace-settings' }, select: { timezone: true, workWeek: true } }), user.role === UserRole.EMPLOYEE && user.employeeId && this.prisma.employee?.findUnique ? this.prisma.employee.findUnique({ where: { id: user.employeeId }, select: { schedule: { select: { timezone: true, workWeek: true, active: true } } } }) : Promise.resolve(null)]); const schedule = employee?.schedule?.active ? employee.schedule : null; const timezone = schedule?.timezone ?? settings?.timezone; const workWeek = schedule?.workWeek ?? settings?.workWeek; const currentDate = calendarDateInTimeZone(now, timezone); const currentYear = Number(currentDate.slice(0, 4)); const currentMonth = Number(currentDate.slice(5, 7)); const results = [];
    const workingStatuses = new Set<AttendanceStatus>([AttendanceStatus.PRESENT, AttendanceStatus.LATE, AttendanceStatus.WORK_FROM_HOME]);
    const employeeCount = user.role === UserRole.EMPLOYEE ? (user.employeeId ? 1 : 0) : await this.prisma.employee.count({ where: { employmentStatus: EmploymentStatus.ACTIVE } });
    const trendStart = new Date(Date.UTC(currentYear, currentMonth - months, 1));
    const trendEnd = new Date(Date.UTC(currentYear, currentMonth, 1));
    const holidays = await this.prisma.holiday.findMany({ where: { active: true, date: { gte: trendStart, lt: trendEnd } }, select: { date: true } });
    for (let offset = months - 1; offset >= 0; offset -= 1) { const date = new Date(Date.UTC(currentYear, currentMonth - 1 - offset, 1)); const { start, endExclusive } = monthPeriod(date.getUTCMonth() + 1, date.getUTCFullYear(), now, timezone); const monthHolidays = holidays.filter((holiday) => holiday.date >= start && holiday.date < endExclusive).map((holiday) => holiday.date); const rows = await this.prisma.attendanceRecord.findMany({ where: { employeeId: user.role === UserRole.EMPLOYEE ? user.employeeId ?? '__none__' : undefined, date: { gte: start, lt: endExclusive } }, select: { status: true } }); const working = rows.filter((row) => workingStatuses.has(row.status)).length; const expectedWorkingDays = employeeCount * workingDays(start, endExclusive, monthHolidays, workingWeekdays(workWeek)); results.push({ month: date.toLocaleString('en-US', { month: 'short', timeZone: 'UTC' }), attendance: expectedWorkingDays ? Math.min(100, Math.round((working / expectedWorkingDays) * 100)) : 0 }); }
    return results;
  }
  async departmentHeadcount() { const rows = await this.prisma.employee.groupBy({ by: ['department'], where: { employmentStatus: { not: 'TERMINATED' } }, _count: { _all: true }, orderBy: { department: 'asc' } }); return rows.map((row) => ({ department: row.department, count: row._count._all })); }
  async recentActivity(user: RequestUser) {
    const employeeId = user.role === UserRole.EMPLOYEE ? user.employeeId ?? '__none__' : undefined;
    const [attendance, payroll] = await Promise.all([this.prisma.attendanceRecord.findMany({ where: { employeeId }, include: { employee: { select: { firstName: true, lastName: true } } }, orderBy: { createdAt: 'desc' }, take: 5 }), this.prisma.salarySlip.findMany({ where: { employeeId }, include: { employee: { select: { firstName: true, lastName: true } } }, orderBy: { updatedAt: 'desc' }, take: 5 })]);
    return [...attendance.map((row) => ({ id: row.id, type: 'attendance', title: `${row.employee.firstName} ${row.employee.lastName} marked attendance`, description: String(row.status).replace(/_/g, ' '), time: row.createdAt, tone: 'blue' })), ...payroll.map((row) => ({ id: row.id, type: 'payroll', title: `Salary slip · ${row.employee.firstName} ${row.employee.lastName}`, description: `${row.month}/${row.year} · ${row.paymentStatus}`, time: row.updatedAt, tone: 'violet' }))].sort((a, b) => +new Date(b.time) - +new Date(a.time)).slice(0, 8);
  }
}
