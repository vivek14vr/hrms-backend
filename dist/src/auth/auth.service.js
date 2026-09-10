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
exports.AuthService = void 0;
const common_1 = require("@nestjs/common");
const jwt_1 = require("@nestjs/jwt");
const prisma_service_1 = require("../prisma/prisma.service");
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const client_1 = require("@prisma/client");
let AuthService = class AuthService {
    prisma;
    jwt;
    constructor(prisma, jwt) {
        this.prisma = prisma;
        this.jwt = jwt;
    }
    safeUser(user) {
        return { id: user.id, name: user.name, email: user.email, role: user.role, employeeId: user.employeeId, isActive: user.isActive, createdAt: user.createdAt, updatedAt: user.updatedAt };
    }
    async login(dto) {
        const user = await this.prisma.user.findUnique({ where: { email: dto.email.toLowerCase() }, include: { employee: true } });
        if (!user || !user.isActive || !(await bcryptjs_1.default.compare(dto.password, user.passwordHash)))
            throw new common_1.UnauthorizedException('Invalid email or password');
        if (dto.portal === 'admin' && user.role !== client_1.UserRole.ADMIN && user.role !== client_1.UserRole.HR_MANAGER)
            throw new common_1.UnauthorizedException('Use the employee portal for this account');
        if (dto.portal === 'employee' && user.role !== client_1.UserRole.EMPLOYEE)
            throw new common_1.UnauthorizedException('Use the admin portal for this account');
        const payload = { sub: user.id, email: user.email, role: user.role, employeeId: user.employeeId };
        const accessToken = await this.jwt.signAsync(payload);
        const refreshToken = await this.jwt.signAsync(payload, { secret: process.env.JWT_REFRESH_SECRET ?? 'peopleos-development-refresh-secret', expiresIn: '7d' });
        return { accessToken, refreshToken, user: this.safeUser(user), employee: user.employee };
    }
    async refresh(refreshToken) {
        if (!refreshToken)
            throw new common_1.UnauthorizedException('Refresh token is missing');
        try {
            const payload = await this.jwt.verifyAsync(refreshToken, { secret: process.env.JWT_REFRESH_SECRET ?? 'peopleos-development-refresh-secret' });
            const user = await this.prisma.user.findUnique({ where: { id: payload.sub }, include: { employee: true } });
            if (!user || !user.isActive)
                throw new common_1.UnauthorizedException('User is inactive');
            const accessToken = await this.jwt.signAsync({ sub: user.id, email: user.email, role: user.role, employeeId: user.employeeId });
            return { accessToken, user: this.safeUser(user), employee: user.employee };
        }
        catch {
            throw new common_1.UnauthorizedException('Refresh token is invalid or expired');
        }
    }
    async me(id) {
        const user = await this.prisma.user.findUnique({ where: { id }, include: { employee: true } });
        if (!user || !user.isActive)
            throw new common_1.UnauthorizedException('Session expired');
        return { user: this.safeUser(user), employee: user.employee };
    }
};
exports.AuthService = AuthService;
exports.AuthService = AuthService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService, jwt_1.JwtService])
], AuthService);
//# sourceMappingURL=auth.service.js.map