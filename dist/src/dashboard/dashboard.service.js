"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.DashboardService = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const prisma_service_1 = require("../prisma/prisma.service");
let DashboardService = class DashboardService {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    async summary(user) {
        const now = new Date();
        const start = new Date(now.getFullYear(), now.getMonth(), 1);
        const end = new Date(now.getFullYear(), now.getMonth() + 1, 1);
        const employeeWhere = user.role === client_1.UserRole.EMPLOYEE ? { id: user.employeeId ?? '__none__' } : {};
        const [totalEmployees, activeEmployees, employeesOnLeave, attendanceRows, currentPayroll, pendingPayroll] = await Promise.all([
            this.prisma.employee.count({ where: employeeWhere }), this.prisma.employee.count({ where: { ...employeeWhere, employmentStatus: 'ACTIVE' } }), this.prisma.employee.count({ where: { ...employeeWhere, employmentStatus: 'ON_LEAVE' } }),
            this.prisma.attendanceRecord.findMany({ where: { employeeId: user.role === client_1.UserRole.EMPLOYEE ? user.employeeId ?? '__none__' : undefined, date: { gte: start, lt: end } }, select: { status: true } }),
            this.prisma.salarySlip.aggregate({ where: { employeeId: user.role === client_1.UserRole.EMPLOYEE ? user.employeeId ?? '__none__' : undefined, month: now.getMonth() + 1, year: now.getFullYear() }, _sum: { netSalary: true } }),
            this.prisma.salarySlip.aggregate({ where: { employeeId: user.role === client_1.UserRole.EMPLOYEE ? user.employeeId ?? '__none__' : undefined, paymentStatus: { in: [client_1.PaymentStatus.PENDING, client_1.PaymentStatus.PROCESSING] } }, _sum: { netSalary: true } }),
        ]);
        const workingStatuses = new Set([client_1.AttendanceStatus.PRESENT, client_1.AttendanceStatus.LATE, client_1.AttendanceStatus.WORK_FROM_HOME]);
        const working = attendanceRows.filter((row) => workingStatuses.has(row.status)).length;
        return { totalEmployees, activeEmployees, employeesOnLeave, attendancePercentage: attendanceRows.length ? Math.round((working / attendanceRows.length) * 100) : 0, monthlyPayrollTotal: Number(currentPayroll._sum.netSalary ?? 0), pendingPayroll: Number(pendingPayroll._sum.netSalary ?? 0) };
    }
    async attendanceTrend(user, months = 6) {
        const now = new Date();
        const results = [];
        const workingStatuses = new Set([client_1.AttendanceStatus.PRESENT, client_1.AttendanceStatus.LATE, client_1.AttendanceStatus.WORK_FROM_HOME]);
        for (let offset = months - 1; offset >= 0; offset -= 1) {
            const date = new Date(now.getFullYear(), now.getMonth() - offset, 1);
            const next = new Date(date.getFullYear(), date.getMonth() + 1, 1);
            const rows = await this.prisma.attendanceRecord.findMany({ where: { employeeId: user.role === client_1.UserRole.EMPLOYEE ? user.employeeId ?? '__none__' : undefined, date: { gte: date, lt: next } }, select: { status: true } });
            const working = rows.filter((row) => workingStatuses.has(row.status)).length;
            results.push({ month: date.toLocaleString('en-US', { month: 'short' }), attendance: rows.length ? Math.round((working / rows.length) * 100) : 0 });
        }
        return results;
    }
    async departmentHeadcount() { const rows = await this.prisma.employee.groupBy({ by: ['department'], where: { employmentStatus: { not: 'TERMINATED' } }, _count: { _all: true }, orderBy: { department: 'asc' } }); return rows.map((row) => ({ department: row.department, count: row._count._all })); }
    async recentActivity(user) {
        const employeeId = user.role === client_1.UserRole.EMPLOYEE ? user.employeeId ?? '__none__' : undefined;
        const [attendance, payroll] = await Promise.all([this.prisma.attendanceRecord.findMany({ where: { employeeId }, include: { employee: { select: { firstName: true, lastName: true } } }, orderBy: { createdAt: 'desc' }, take: 5 }), this.prisma.salarySlip.findMany({ where: { employeeId }, include: { employee: { select: { firstName: true, lastName: true } } }, orderBy: { updatedAt: 'desc' }, take: 5 })]);
        return [...attendance.map((row) => ({ id: row.id, type: 'attendance', title: `${row.employee.firstName} ${row.employee.lastName} marked attendance`, description: row.status.replaceAll('_', ' '), time: row.createdAt, tone: 'blue' })), ...payroll.map((row) => ({ id: row.id, type: 'payroll', title: `Salary slip · ${row.employee.firstName} ${row.employee.lastName}`, description: `${row.month}/${row.year} · ${row.paymentStatus}`, time: row.updatedAt, tone: 'violet' }))].sort((a, b) => +new Date(b.time) - +new Date(a.time)).slice(0, 8);
    }
};
exports.DashboardService = DashboardService;
exports.DashboardService = DashboardService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], DashboardService);
//# sourceMappingURL=dashboard.service.js.map