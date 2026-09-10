import { Injectable } from '@nestjs/common';
import { AttendanceStatus, PaymentStatus, Prisma, UserRole } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { RequestUser } from '../common/types/request-user';

@Injectable()
export class DashboardService {
  constructor(private readonly prisma: PrismaService) {}
  async summary(user: RequestUser) {
    const now = new Date(); const start = new Date(now.getFullYear(), now.getMonth(), 1); const end = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    const employeeWhere = user.role === UserRole.EMPLOYEE ? { id: user.employeeId ?? '__none__' } : {};
    const [totalEmployees, activeEmployees, employeesOnLeave, attendanceRows, currentPayroll, pendingPayroll] = await Promise.all([
      this.prisma.employee.count({ where: employeeWhere }), this.prisma.employee.count({ where: { ...employeeWhere, employmentStatus: 'ACTIVE' } }), this.prisma.employee.count({ where: { ...employeeWhere, employmentStatus: 'ON_LEAVE' } }),
      this.prisma.attendanceRecord.findMany({ where: { employeeId: user.role === UserRole.EMPLOYEE ? user.employeeId ?? '__none__' : undefined, date: { gte: start, lt: end } }, select: { status: true } }),
      this.prisma.salarySlip.aggregate({ where: { employeeId: user.role === UserRole.EMPLOYEE ? user.employeeId ?? '__none__' : undefined, month: now.getMonth() + 1, year: now.getFullYear() }, _sum: { netSalary: true } }),
      this.prisma.salarySlip.aggregate({ where: { employeeId: user.role === UserRole.EMPLOYEE ? user.employeeId ?? '__none__' : undefined, paymentStatus: { in: [PaymentStatus.PENDING, PaymentStatus.PROCESSING] } }, _sum: { netSalary: true } }),
    ]);
    const workingStatuses = new Set<AttendanceStatus>([AttendanceStatus.PRESENT, AttendanceStatus.LATE, AttendanceStatus.WORK_FROM_HOME]);
    const working = attendanceRows.filter((row) => workingStatuses.has(row.status)).length;
    return { totalEmployees, activeEmployees, employeesOnLeave, attendancePercentage: attendanceRows.length ? Math.round((working / attendanceRows.length) * 100) : 0, monthlyPayrollTotal: Number(currentPayroll._sum.netSalary ?? 0), pendingPayroll: Number(pendingPayroll._sum.netSalary ?? 0) };
  }
  async attendanceTrend(user: RequestUser, months = 6) {
    const now = new Date(); const results = [];
    const workingStatuses = new Set<AttendanceStatus>([AttendanceStatus.PRESENT, AttendanceStatus.LATE, AttendanceStatus.WORK_FROM_HOME]);
    for (let offset = months - 1; offset >= 0; offset -= 1) { const date = new Date(now.getFullYear(), now.getMonth() - offset, 1); const next = new Date(date.getFullYear(), date.getMonth() + 1, 1); const rows = await this.prisma.attendanceRecord.findMany({ where: { employeeId: user.role === UserRole.EMPLOYEE ? user.employeeId ?? '__none__' : undefined, date: { gte: date, lt: next } }, select: { status: true } }); const working = rows.filter((row) => workingStatuses.has(row.status)).length; results.push({ month: date.toLocaleString('en-US', { month: 'short' }), attendance: rows.length ? Math.round((working / rows.length) * 100) : 0 }); }
    return results;
  }
  async departmentHeadcount() { const rows = await this.prisma.employee.groupBy({ by: ['department'], where: { employmentStatus: { not: 'TERMINATED' } }, _count: { _all: true }, orderBy: { department: 'asc' } }); return rows.map((row) => ({ department: row.department, count: row._count._all })); }
  async recentActivity(user: RequestUser) {
    const employeeId = user.role === UserRole.EMPLOYEE ? user.employeeId ?? '__none__' : undefined;
    const [attendance, payroll] = await Promise.all([this.prisma.attendanceRecord.findMany({ where: { employeeId }, include: { employee: { select: { firstName: true, lastName: true } } }, orderBy: { createdAt: 'desc' }, take: 5 }), this.prisma.salarySlip.findMany({ where: { employeeId }, include: { employee: { select: { firstName: true, lastName: true } } }, orderBy: { updatedAt: 'desc' }, take: 5 })]);
    return [...attendance.map((row) => ({ id: row.id, type: 'attendance', title: `${row.employee.firstName} ${row.employee.lastName} marked attendance`, description: row.status.replaceAll('_', ' '), time: row.createdAt, tone: 'blue' })), ...payroll.map((row) => ({ id: row.id, type: 'payroll', title: `Salary slip · ${row.employee.firstName} ${row.employee.lastName}`, description: `${row.month}/${row.year} · ${row.paymentStatus}`, time: row.updatedAt, tone: 'violet' }))].sort((a, b) => +new Date(b.time) - +new Date(a.time)).slice(0, 8);
  }
}
