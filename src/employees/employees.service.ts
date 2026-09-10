import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { EmploymentStatus, Prisma, UserRole } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { RequestUser } from '../common/types/request-user';
import { CreateEmployeeDto } from './dto/create-employee.dto';
import { UpdateEmployeeDto } from './dto/update-employee.dto';

const employeeInclude = { user: { select: { id: true, name: true, email: true, role: true, isActive: true, createdAt: true, updatedAt: true } } } as const;

@Injectable()
export class EmployeesService {
  constructor(private readonly prisma: PrismaService) {}
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
  async create(dto: CreateEmployeeDto) {
    const nextCode = `PO-${String((await this.prisma.employee.count()) + 1).padStart(4, '0')}`;
    const employee = await this.prisma.employee.create({ data: { ...dto, employeeCode: nextCode, email: dto.email.toLowerCase(), joiningDate: new Date(dto.joiningDate), employmentStatus: dto.employmentStatus ?? EmploymentStatus.ACTIVE, baseSalary: new Prisma.Decimal(dto.baseSalary) }, include: employeeInclude });
    return employee;
  }
  async update(id: string, dto: UpdateEmployeeDto) {
    await this.findOne(id);
    const data: any = { ...dto }; if (dto.joiningDate) data.joiningDate = new Date(dto.joiningDate); if (dto.email) data.email = dto.email.toLowerCase(); if (dto.baseSalary !== undefined) data.baseSalary = new Prisma.Decimal(dto.baseSalary);
    return this.prisma.employee.update({ where: { id }, data, include: employeeInclude });
  }
  async remove(id: string) { await this.findOne(id); await this.prisma.employee.update({ where: { id }, data: { employmentStatus: EmploymentStatus.INACTIVE } }); return { success: true }; }
  async departments() { const rows = await this.prisma.employee.findMany({ distinct: ['department'], select: { department: true }, orderBy: { department: 'asc' } }); return rows.map((row) => row.department); }
}
