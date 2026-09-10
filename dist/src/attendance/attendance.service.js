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
exports.AttendanceService = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const prisma_service_1 = require("../prisma/prisma.service");
const include = { employee: { select: { id: true, employeeCode: true, firstName: true, lastName: true, department: true, designation: true, avatarUrl: true } } };
let AttendanceService = class AttendanceService {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    async findAll(user, query) {
        const page = Math.max(1, query.page ?? 1);
        const limit = Math.min(100, Math.max(1, query.limit ?? 20));
        const employeeId = user.role === client_1.UserRole.EMPLOYEE ? user.employeeId ?? '__none__' : query.employeeId;
        const where = { employeeId, status: query.status, employee: query.department ? { department: query.department } : undefined, date: { gte: query.dateFrom ? new Date(query.dateFrom) : undefined, lte: query.dateTo ? new Date(`${query.dateTo}T23:59:59.999Z`) : undefined } };
        const [items, total] = await this.prisma.$transaction([this.prisma.attendanceRecord.findMany({ where, include, orderBy: { date: 'desc' }, skip: (page - 1) * limit, take: limit }), this.prisma.attendanceRecord.count({ where })]);
        return { items, total, page, limit, totalPages: Math.ceil(total / limit) };
    }
    async summary(user, month, year) {
        const now = new Date();
        const selectedMonth = month ?? now.getMonth() + 1;
        const selectedYear = year ?? now.getFullYear();
        const where = { employeeId: user.role === client_1.UserRole.EMPLOYEE ? user.employeeId ?? '__none__' : undefined, date: { gte: new Date(selectedYear, selectedMonth - 1, 1), lt: new Date(selectedYear, selectedMonth, 1) } };
        const rows = await this.prisma.attendanceRecord.findMany({ where, select: { status: true } });
        const count = (status) => rows.filter((row) => row.status === status).length;
        const workingStatuses = new Set([client_1.AttendanceStatus.PRESENT, client_1.AttendanceStatus.LATE, client_1.AttendanceStatus.WORK_FROM_HOME]);
        const working = rows.filter((row) => workingStatuses.has(row.status)).length;
        return { month: selectedMonth, year: selectedYear, total: rows.length, present: count(client_1.AttendanceStatus.PRESENT), absent: count(client_1.AttendanceStatus.ABSENT), late: count(client_1.AttendanceStatus.LATE), leave: count(client_1.AttendanceStatus.LEAVE), workFromHome: count(client_1.AttendanceStatus.WORK_FROM_HOME), attendancePercentage: rows.length ? Math.round((working / rows.length) * 100) : 0 };
    }
    async create(dto, user) {
        const employeeId = user.role === client_1.UserRole.EMPLOYEE ? user.employeeId : dto.employeeId;
        if (!employeeId)
            throw new common_1.ForbiddenException('An employee record is required');
        const employee = await this.prisma.employee.findUnique({ where: { id: employeeId } });
        if (!employee)
            throw new common_1.NotFoundException('Employee not found');
        return this.prisma.attendanceRecord.create({ data: { employeeId, date: new Date(dto.date), checkIn: dto.checkIn ? new Date(dto.checkIn) : undefined, checkOut: dto.checkOut ? new Date(dto.checkOut) : undefined, workHours: dto.workHours === undefined ? undefined : new client_1.Prisma.Decimal(dto.workHours), status: dto.status, notes: dto.notes }, include });
    }
    async update(id, dto, user) {
        const record = await this.prisma.attendanceRecord.findUnique({ where: { id } });
        if (!record)
            throw new common_1.NotFoundException('Attendance record not found');
        if (user.role === client_1.UserRole.EMPLOYEE && record.employeeId !== user.employeeId)
            throw new common_1.ForbiddenException('Employees can only update their own attendance');
        const data = { ...dto };
        delete data.employeeId;
        if (dto.date)
            data.date = new Date(dto.date);
        if (dto.checkIn)
            data.checkIn = new Date(dto.checkIn);
        if (dto.checkOut)
            data.checkOut = new Date(dto.checkOut);
        if (dto.workHours !== undefined)
            data.workHours = new client_1.Prisma.Decimal(dto.workHours);
        return this.prisma.attendanceRecord.update({ where: { id }, data, include });
    }
    async remove(id, user) { const record = await this.prisma.attendanceRecord.findUnique({ where: { id } }); if (!record)
        throw new common_1.NotFoundException('Attendance record not found'); if (user.role === client_1.UserRole.EMPLOYEE && record.employeeId !== user.employeeId)
        throw new common_1.ForbiddenException('Employees can only delete their own attendance'); await this.prisma.attendanceRecord.delete({ where: { id } }); return { success: true }; }
    async csv(user, query) { const { items } = await this.findAll(user, { ...query, page: 1, limit: 10000 }); const header = 'Date,Employee,Department,Check-in,Check-out,Work hours,Status'; const lines = items.map((row) => [row.date.toISOString().slice(0, 10), `${row.employee.firstName} ${row.employee.lastName}`, row.employee.department, row.checkIn?.toISOString() ?? '', row.checkOut?.toISOString() ?? '', row.workHours?.toString() ?? '', row.status].map((field) => `"${String(field).replaceAll('"', '""')}"`).join(',')); return `${header}\n${lines.join('\n')}`; }
};
exports.AttendanceService = AttendanceService;
exports.AttendanceService = AttendanceService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], AttendanceService);
//# sourceMappingURL=attendance.service.js.map