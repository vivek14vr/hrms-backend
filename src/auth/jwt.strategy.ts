import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { Request } from 'express';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(config: ConfigService, private readonly prisma: PrismaService) {
    super({ jwtFromRequest: ExtractJwt.fromExtractors([(request: Request) => request?.cookies?.access_token, ExtractJwt.fromAuthHeaderAsBearerToken()]), ignoreExpiration: false, secretOrKey: config.get('JWT_SECRET') ?? 'peopleos-development-secret' });
  }
  async validate(payload: { sub: string; email: string }) {
    const user = await this.prisma.user.findUnique({ where: { id: payload.sub } });
    if (!user || !user.isActive) throw new UnauthorizedException('Session expired');
    return { id: user.id, name: user.name, email: user.email, role: user.role, employeeId: user.employeeId };
  }
}
