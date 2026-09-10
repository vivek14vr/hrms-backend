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
exports.EmployeesService = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const prisma_service_1 = require("../prisma/prisma.service");
const employeeInclude = { user: { select: { id: true, name: true, email: true, role: true, isActive: true, createdAt: true, updatedAt: true } } };
let EmployeesService = class EmployeesService {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    async findAll(query) {
        const page = Math.max(1, query.page ?? 1);
        const limit = Math.min(100, Math.max(1, query.limit ?? 10));
        const where = { department: query.department || undefined, employmentStatus: query.status, designation: query.designation || undefined, OR: query.search ? [{ firstName: { contains: query.search, mode: 'insensitive' } }, { lastName: { contains: query.search, mode: 'insensitive' } }, { email: { contains: query.search, mode: 'insensitive' } }, { employeeCode: { contains: query.search, mode: 'insensitive' } }] : undefined };
        const [items, total] = await this.prisma.$transaction([this.prisma.employee.findMany({ where, include: employeeInclude, orderBy: [{ employmentStatus: 'asc' }, { lastName: 'asc' }], skip: (page - 1) * limit, take: limit }), this.prisma.employee.count({ where })]);
        return { items, total, page, limit, totalPages: Math.ceil(total / limit) };
    }
    async findOne(id, user) {
        if (user?.role === client_1.UserRole.EMPLOYEE && user.employeeId !== id)
            throw new common_1.ForbiddenException('Employees can only view their own profile');
        const employee = await this.prisma.employee.findUnique({ where: { id }, include: employeeInclude });
        if (!employee)
            throw new common_1.NotFoundException('Employee not found');
        return employee;
    }
    async create(dto) {
        const nextCode = `PO-${String((await this.prisma.employee.count()) + 1).padStart(4, '0')}`;
        const employee = await this.prisma.employee.create({ data: { ...dto, employeeCode: nextCode, email: dto.email.toLowerCase(), joiningDate: new Date(dto.joiningDate), employmentStatus: dto.employmentStatus ?? client_1.EmploymentStatus.ACTIVE, baseSalary: new client_1.Prisma.Decimal(dto.baseSalary) }, include: employeeInclude });
        return employee;
    }
    async update(id, dto) {
        await this.findOne(id);
        const data = { ...dto };
        if (dto.joiningDate)
            data.joiningDate = new Date(dto.joiningDate);
        if (dto.email)
            data.email = dto.email.toLowerCase();
        if (dto.baseSalary !== undefined)
            data.baseSalary = new client_1.Prisma.Decimal(dto.baseSalary);
        return this.prisma.employee.update({ where: { id }, data, include: employeeInclude });
    }
    async remove(id) { await this.findOne(id); await this.prisma.employee.update({ where: { id }, data: { employmentStatus: client_1.EmploymentStatus.INACTIVE } }); return { success: true }; }
    async departments() { const rows = await this.prisma.employee.findMany({ distinct: ['department'], select: { department: true }, orderBy: { department: 'asc' } }); return rows.map((row) => row.department); }
};
exports.EmployeesService = EmployeesService;
exports.EmployeesService = EmployeesService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], EmployeesService);
//# sourceMappingURL=employees.service.js.map