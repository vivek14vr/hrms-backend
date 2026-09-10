import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { AttendanceStatus, Prisma, UserRole } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { RequestUser } from '../common/types/request-user';
import { CreateAttendanceDto } from './dto/create-attendance.dto';
import { UpdateAttendanceDto } from './dto/update-attendance.dto';

const include = { employee: { select: { id: true, employeeCode: true, firstName: true, lastName: true, department: true, designation: true, avatarUrl: true } } } as const;

@Injectable()
export class AttendanceService {
  constructor(private readonly prisma: PrismaService) {}
  async findAll(user: RequestUser, query: { employeeId?: string; department?: string; status?: AttendanceStatus; dateFrom?: string; dateTo?: string; page?: number; limit?: number }) {
    const page = Math.max(1, query.page ?? 1); const limit = Math.min(100, Math.max(1, query.limit ?? 20));
    const employeeId = user.role === UserRole.EMPLOYEE ? user.employeeId ?? '__none__' : query.employeeId;
    const where: Prisma.AttendanceRecordWhereInput = { employeeId, status: query.status, employee: query.department ? { department: query.department } : undefined, date: { gte: query.dateFrom ? new Date(query.dateFrom) : undefined, lte: query.dateTo ? new Date(`${query.dateTo}T23:59:59.999Z`) : undefined } };
    const [items, total] = await this.prisma.$transaction([this.prisma.attendanceRecord.findMany({ where, include, orderBy: { date: 'desc' }, skip: (page - 1) * limit, take: limit }), this.prisma.attendanceRecord.count({ where })]);
    return { items, total, page, limit, totalPages: Math.ceil(total / limit) };
  }
  async summary(user: RequestUser, month?: number, year?: number) {
    const now = new Date(); const selectedMonth = month ?? now.getMonth() + 1; const selectedYear = year ?? now.getFullYear();
    const where: Prisma.AttendanceRecordWhereInput = { employeeId: user.role === UserRole.EMPLOYEE ? user.employeeId ?? '__none__' : undefined, date: { gte: new Date(selectedYear, selectedMonth - 1, 1), lt: new Date(selectedYear, selectedMonth, 1) } };
    const rows = await this.prisma.attendanceRecord.findMany({ where, select: { status: true } });
    const count = (status: AttendanceStatus) => rows.filter((row) => row.status === status).length;
    const workingStatuses = new Set<AttendanceStatus>([AttendanceStatus.PRESENT, AttendanceStatus.LATE, AttendanceStatus.WORK_FROM_HOME]);
    const working = rows.filter((row) => workingStatuses.has(row.status)).length;
    return { month: selectedMonth, year: selectedYear, total: rows.length, present: count(AttendanceStatus.PRESENT), absent: count(AttendanceStatus.ABSENT), late: count(AttendanceStatus.LATE), leave: count(AttendanceStatus.LEAVE), workFromHome: count(AttendanceStatus.WORK_FROM_HOME), attendancePercentage: rows.length ? Math.round((working / rows.length) * 100) : 0 };
  }
  async create(dto: CreateAttendanceDto, user: RequestUser) {
    const employeeId = user.role === UserRole.EMPLOYEE ? user.employeeId : dto.employeeId;
    if (!employeeId) throw new ForbiddenException('An employee record is required');
    const employee = await this.prisma.employee.findUnique({ where: { id: employeeId } }); if (!employee) throw new NotFoundException('Employee not found');
    return this.prisma.attendanceRecord.create({ data: { employeeId, date: new Date(dto.date), checkIn: dto.checkIn ? new Date(dto.checkIn) : undefined, checkOut: dto.checkOut ? new Date(dto.checkOut) : undefined, workHours: dto.workHours === undefined ? undefined : new Prisma.Decimal(dto.workHours), status: dto.status, notes: dto.notes }, include });
  }
  async update(id: string, dto: UpdateAttendanceDto, user: RequestUser) {
    const record = await this.prisma.attendanceRecord.findUnique({ where: { id } });
    if (!record) throw new NotFoundException('Attendance record not found');
    if (user.role === UserRole.EMPLOYEE && record.employeeId !== user.employeeId) throw new ForbiddenException('Employees can only update their own attendance');
    const data: any = { ...dto }; delete data.employeeId; if (dto.date) data.date = new Date(dto.date); if (dto.checkIn) data.checkIn = new Date(dto.checkIn); if (dto.checkOut) data.checkOut = new Date(dto.checkOut); if (dto.workHours !== undefined) data.workHours = new Prisma.Decimal(dto.workHours);
    return this.prisma.attendanceRecord.update({ where: { id }, data, include });
  }
  async remove(id: string, user: RequestUser) { const record = await this.prisma.attendanceRecord.findUnique({ where: { id } }); if (!record) throw new NotFoundException('Attendance record not found'); if (user.role === UserRole.EMPLOYEE && record.employeeId !== user.employeeId) throw new ForbiddenException('Employees can only delete their own attendance'); await this.prisma.attendanceRecord.delete({ where: { id } }); return { success: true }; }
  async csv(user: RequestUser, query: any) { const { items } = await this.findAll(user, { ...query, page: 1, limit: 10000 }); const header = 'Date,Employee,Department,Check-in,Check-out,Work hours,Status'; const lines = items.map((row: any) => [row.date.toISOString().slice(0, 10), `${row.employee.firstName} ${row.employee.lastName}`, row.employee.department, row.checkIn?.toISOString() ?? '', row.checkOut?.toISOString() ?? '', row.workHours?.toString() ?? '', row.status].map((field) => `"${String(field).replace(/"/g, '""')}"`).join(',')); return `${header}\n${lines.join('\n')}`; }
}
