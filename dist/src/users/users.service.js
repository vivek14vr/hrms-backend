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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.UsersService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../prisma/prisma.service");
const bcryptjs_1 = __importDefault(require("bcryptjs"));
let UsersService = class UsersService {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    safe(user) { const { passwordHash: _passwordHash, ...safeUser } = user; return safeUser; }
    async findAll(search, role) {
        const users = await this.prisma.user.findMany({ where: { role: role || undefined, OR: search ? [{ name: { contains: search, mode: 'insensitive' } }, { email: { contains: search, mode: 'insensitive' } }] : undefined }, include: { employee: true }, orderBy: { createdAt: 'desc' } });
        return users.map((user) => this.safe(user));
    }
    async create(dto) {
        const exists = await this.prisma.user.findUnique({ where: { email: dto.email.toLowerCase() } });
        if (exists)
            throw new common_1.ConflictException('A user with this email already exists');
        const user = await this.prisma.user.create({ data: { name: dto.name, email: dto.email.toLowerCase(), passwordHash: await bcryptjs_1.default.hash(dto.password, 12), role: dto.role, employeeId: dto.employeeId, isActive: dto.isActive ?? true }, include: { employee: true } });
        return this.safe(user);
    }
    async update(id, dto) {
        await this.assertExists(id);
        const data = { ...dto };
        if (dto.password) {
            data.passwordHash = await bcryptjs_1.default.hash(dto.password, 12);
            delete data.password;
        }
        if (dto.email)
            data.email = dto.email.toLowerCase();
        delete data.employeeId;
        const user = await this.prisma.user.update({ where: { id }, data, include: { employee: true } });
        if (dto.employeeId !== undefined)
            await this.prisma.user.update({ where: { id }, data: { employeeId: dto.employeeId || null } });
        return this.safe(user);
    }
    async updateStatus(id, isActive) { await this.assertExists(id); return this.safe(await this.prisma.user.update({ where: { id }, data: { isActive }, include: { employee: true } })); }
    async remove(id) { await this.assertExists(id); await this.prisma.user.delete({ where: { id } }); return { success: true }; }
    async assertExists(id) { const user = await this.prisma.user.findUnique({ where: { id } }); if (!user)
        throw new common_1.NotFoundException('User not found'); return user; }
};
exports.UsersService = UsersService;
exports.UsersService = UsersService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], UsersService);
//# sourceMappingURL=users.service.js.map