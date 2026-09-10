import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';
import { LoginDto } from './dto/login.dto';
import bcrypt from 'bcryptjs';
import { UserRole } from '@prisma/client';

@Injectable()
export class AuthService {
  constructor(private readonly prisma: PrismaService, private readonly jwt: JwtService) {}

  private safeUser(user: { id: string; name: string; email: string; role: UserRole; employeeId: string | null; isActive: boolean; createdAt: Date; updatedAt: Date }) {
    return { id: user.id, name: user.name, email: user.email, role: user.role, employeeId: user.employeeId, isActive: user.isActive, createdAt: user.createdAt, updatedAt: user.updatedAt };
  }

  async login(dto: LoginDto) {
    const user = await this.prisma.user.findUnique({ where: { email: dto.email.toLowerCase() }, include: { employee: true } });
    if (!user || !user.isActive || !(await bcrypt.compare(dto.password, user.passwordHash))) throw new UnauthorizedException('Invalid email or password');
    if (dto.portal === 'admin' && user.role !== UserRole.ADMIN && user.role !== UserRole.HR_MANAGER) throw new UnauthorizedException('Use the employee portal for this account');
    if (dto.portal === 'employee' && user.role !== UserRole.EMPLOYEE) throw new UnauthorizedException('Use the admin portal for this account');
    const payload = { sub: user.id, email: user.email, role: user.role, employeeId: user.employeeId };
    const accessToken = await this.jwt.signAsync(payload);
    const refreshToken = await this.jwt.signAsync(payload, { secret: process.env.JWT_REFRESH_SECRET ?? 'peopleos-development-refresh-secret', expiresIn: '7d' });
    return { accessToken, refreshToken, user: this.safeUser(user), employee: user.employee };
  }

  async refresh(refreshToken: string | undefined) {
    if (!refreshToken) throw new UnauthorizedException('Refresh token is missing');
    try {
      const payload = await this.jwt.verifyAsync<{ sub: string }>(refreshToken, { secret: process.env.JWT_REFRESH_SECRET ?? 'peopleos-development-refresh-secret' });
      const user = await this.prisma.user.findUnique({ where: { id: payload.sub }, include: { employee: true } });
      if (!user || !user.isActive) throw new UnauthorizedException('User is inactive');
      const accessToken = await this.jwt.signAsync({ sub: user.id, email: user.email, role: user.role, employeeId: user.employeeId });
      return { accessToken, user: this.safeUser(user), employee: user.employee };
    } catch { throw new UnauthorizedException('Refresh token is invalid or expired'); }
  }

  async me(id: string) {
    const user = await this.prisma.user.findUnique({ where: { id }, include: { employee: true } });
    if (!user || !user.isActive) throw new UnauthorizedException('Session expired');
    return { user: this.safeUser(user), employee: user.employee };
  }
}
