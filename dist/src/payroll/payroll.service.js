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
exports.PayrollService = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const prisma_service_1 = require("../prisma/prisma.service");
const include = { employee: { select: { id: true, employeeCode: true, firstName: true, lastName: true, email: true, department: true, designation: true, avatarUrl: true, employmentStatus: true } } };
const money = (value) => Number(value ?? 0);
function serialize(row) { return { ...row, basicSalary: money(row.basicSalary), houseRentAllowance: money(row.houseRentAllowance), transportAllowance: money(row.transportAllowance), performanceBonus: money(row.performanceBonus), providentFund: money(row.providentFund), professionalTax: money(row.professionalTax), incomeTax: money(row.incomeTax), otherDeductions: money(row.otherDeductions), grossSalary: money(row.grossSalary), totalDeductions: money(row.totalDeductions), netSalary: money(row.netSalary) }; }
let PayrollService = class PayrollService {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    async findAll(user, query) {
        const page = Math.max(1, query.page ?? 1);
        const limit = Math.min(100, Math.max(1, query.limit ?? 20));
        const employeeId = user.role === client_1.UserRole.EMPLOYEE ? user.employeeId ?? '__none__' : query.employeeId;
        const where = { employeeId, month: query.month, year: query.year, paymentStatus: query.paymentStatus, employee: query.department ? { department: query.department } : undefined };
        const [items, total] = await this.prisma.$transaction([this.prisma.salarySlip.findMany({ where, include, orderBy: [{ year: 'desc' }, { month: 'desc' }], skip: (page - 1) * limit, take: limit }), this.prisma.salarySlip.count({ where })]);
        return { items: items.map(serialize), total, page, limit, totalPages: Math.ceil(total / limit) };
    }
    async findOne(id, user) {
        const row = await this.prisma.salarySlip.findUnique({ where: { id }, include });
        if (!row)
            throw new common_1.NotFoundException('Salary slip not found');
        if (user.role === client_1.UserRole.EMPLOYEE && row.employeeId !== user.employeeId)
            throw new common_1.ForbiddenException('Employees can only view their own salary slips');
        return serialize(row);
    }
    async forEmployee(employeeId, user, query) {
        if (user.role === client_1.UserRole.EMPLOYEE && user.employeeId !== employeeId)
            throw new common_1.ForbiddenException('Employees can only view their own salary slips');
        const rows = await this.prisma.salarySlip.findMany({ where: { employeeId, month: query.month, year: query.year }, include, orderBy: [{ year: 'desc' }, { month: 'desc' }] });
        return rows.map(serialize);
    }
    async create(employeeId, dto) {
        const employee = await this.prisma.employee.findUnique({ where: { id: employeeId } });
        if (!employee)
            throw new common_1.NotFoundException('Employee not found');
        const basic = dto.basicSalary;
        const hra = dto.houseRentAllowance ?? Math.round(basic * 0.2);
        const transport = dto.transportAllowance ?? 2400;
        const bonus = dto.performanceBonus ?? 0;
        const pf = dto.providentFund ?? Math.round(basic * 0.12);
        const pt = dto.professionalTax ?? 200;
        const tax = dto.incomeTax ?? Math.round(basic * 0.08);
        const other = dto.otherDeductions ?? 0;
        const gross = basic + hra + transport + bonus;
        const total = pf + pt + tax + other;
        try {
            const row = await this.prisma.salarySlip.create({ data: { employeeId, month: dto.month, year: dto.year, basicSalary: basic, houseRentAllowance: hra, transportAllowance: transport, performanceBonus: bonus, providentFund: pf, professionalTax: pt, incomeTax: tax, otherDeductions: other, grossSalary: gross, totalDeductions: total, netSalary: gross - total, paymentStatus: dto.paymentStatus ?? client_1.PaymentStatus.PENDING, paymentDate: dto.paymentDate ? new Date(dto.paymentDate) : null }, include });
            return serialize(row);
        }
        catch (error) {
            if (error instanceof client_1.Prisma.PrismaClientKnownRequestError && error.code === 'P2002')
                throw new common_1.ConflictException('A salary slip already exists for this period');
            throw error;
        }
    }
    async update(id, dto) {
        const current = await this.prisma.salarySlip.findUnique({ where: { id } });
        if (!current)
            throw new common_1.NotFoundException('Salary slip not found');
        const values = { basicSalary: dto.basicSalary ?? money(current.basicSalary), houseRentAllowance: dto.houseRentAllowance ?? money(current.houseRentAllowance), transportAllowance: dto.transportAllowance ?? money(current.transportAllowance), performanceBonus: dto.performanceBonus ?? money(current.performanceBonus), providentFund: dto.providentFund ?? money(current.providentFund), professionalTax: dto.professionalTax ?? money(current.professionalTax), incomeTax: dto.incomeTax ?? money(current.incomeTax), otherDeductions: dto.otherDeductions ?? money(current.otherDeductions) };
        const gross = values.basicSalary + values.houseRentAllowance + values.transportAllowance + values.performanceBonus;
        const total = values.providentFund + values.professionalTax + values.incomeTax + values.otherDeductions;
        const data = { ...values, grossSalary: gross, totalDeductions: total, netSalary: gross - total };
        if (dto.month !== undefined)
            data.month = dto.month;
        if (dto.year !== undefined)
            data.year = dto.year;
        if (dto.paymentStatus)
            data.paymentStatus = dto.paymentStatus;
        if (dto.paymentDate !== undefined)
            data.paymentDate = dto.paymentDate ? new Date(dto.paymentDate) : null;
        const row = await this.prisma.salarySlip.update({ where: { id }, data, include });
        return serialize(row);
    }
    async remove(id) { const current = await this.prisma.salarySlip.findUnique({ where: { id } }); if (!current)
        throw new common_1.NotFoundException('Salary slip not found'); await this.prisma.salarySlip.delete({ where: { id } }); return { success: true }; }
};
exports.PayrollService = PayrollService;
exports.PayrollService = PayrollService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], PayrollService);
//# sourceMappingURL=payroll.service.js.map