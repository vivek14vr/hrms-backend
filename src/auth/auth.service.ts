import { Injectable, InternalServerErrorException, NotFoundException, Optional, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';
import { LoginDto } from './dto/login.dto';
import bcrypt from 'bcryptjs';
import { UserRole } from '@prisma/client';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { AuditService } from '../audit/audit.service';
import { CompletePasswordResetDto } from './dto/complete-password-reset.dto';

const REFRESH_TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const PASSWORD_RESET_TTL_MS = 60 * 60 * 1000;
const LOGIN_FAILURE_LIMIT = 5;
const LOGIN_LOCKOUT_MS = 15 * 60 * 1000;

type AuthUser = {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  employeeId: string | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  employee: unknown;
};

type TokenPayload = { sub: string; email: string; role: UserRole; employeeId: string | null; sid: string };
type RefreshPayload = Pick<TokenPayload, 'sub' | 'sid'>;
export type SessionMetadata = { userAgent?: string; ipAddress?: string };

@Injectable()
export class AuthService {
  constructor(private readonly prisma: PrismaService, private readonly jwt: JwtService, private readonly config: ConfigService, @Optional() private readonly audit?: AuditService) {}

  private safeUser(user: Pick<AuthUser, 'id' | 'name' | 'email' | 'role' | 'employeeId' | 'isActive' | 'createdAt' | 'updatedAt'>) {
    return { id: user.id, name: user.name, email: user.email, role: user.role, employeeId: user.employeeId, isActive: user.isActive, createdAt: user.createdAt, updatedAt: user.updatedAt };
  }

  private refreshSecret() { return this.config.getOrThrow<string>('JWT_REFRESH_SECRET'); }

  private hashToken(token: string) { return createHash('sha256').update(token).digest('hex'); }

  private payloadFor(user: Pick<AuthUser, 'id' | 'email' | 'role' | 'employeeId'>, sessionId: string): TokenPayload {
    return { sub: user.id, email: user.email, role: user.role, employeeId: user.employeeId, sid: sessionId };
  }

  private async issueSession(user: AuthUser, metadata?: SessionMetadata) {
    const sessionId = randomUUID();
    const payload = this.payloadFor(user, sessionId);
    const refreshToken = await this.jwt.signAsync({ sub: payload.sub, sid: payload.sid, jti: randomUUID() }, { secret: this.refreshSecret(), expiresIn: '7d' });
    await this.prisma.authSession.create({ data: { id: sessionId, userId: user.id, refreshTokenHash: this.hashToken(refreshToken), expiresAt: new Date(Date.now() + REFRESH_TOKEN_TTL_MS), ...normalizeSessionMetadata(metadata) } });
    const accessToken = await this.jwt.signAsync(payload);
    return { accessToken, refreshToken, user: this.safeUser(user), employee: user.employee };
  }

  async login(dto: LoginDto, requestId?: string, metadata?: SessionMetadata) {
    const user = await this.prisma.user.findUnique({ where: { email: dto.email.trim().toLowerCase() }, include: { employee: true } });
    const now = new Date();
    if (!user || !user.isActive || (user.lockedUntil && user.lockedUntil > now)) {
      await this.audit?.record({ action: 'AUTH_LOGIN_FAILED', entityType: 'User', entityId: user?.id, requestId, metadata: { reason: user?.lockedUntil ? 'account-locked' : 'invalid-account' } });
      throw new UnauthorizedException('Invalid email or password');
    }
    if (user.lockedUntil && user.lockedUntil <= now) await this.prisma.user.update({ where: { id: user.id }, data: { failedLoginAttempts: 0, lockedUntil: null } });
    if (!(await bcrypt.compare(dto.password, user.passwordHash))) {
      await this.recordFailedLogin(user.id, requestId);
      throw new UnauthorizedException('Invalid email or password');
    }
    if (user.failedLoginAttempts > 0 || user.lockedUntil) await this.prisma.user.update({ where: { id: user.id }, data: { failedLoginAttempts: 0, lockedUntil: null } });
    if (dto.portal === 'admin' && user.role !== UserRole.ADMIN && user.role !== UserRole.HR_MANAGER) throw new UnauthorizedException('Use the employee portal for this account');
    if (dto.portal === 'employee' && user.role !== UserRole.EMPLOYEE) throw new UnauthorizedException('Use the admin portal for this account');
    const result = await this.issueSession(user, metadata);
    await this.audit?.record({ actorUserId: user.id, action: 'AUTH_LOGIN', entityType: 'User', entityId: user.id, requestId });
    return result;
  }

  private async recordFailedLogin(userId: string, requestId?: string) {
    const updated = await this.prisma.user.update({ where: { id: userId }, data: { failedLoginAttempts: { increment: 1 } }, select: { failedLoginAttempts: true } });
    const locked = updated.failedLoginAttempts >= LOGIN_FAILURE_LIMIT;
    if (locked) await this.prisma.user.updateMany({ where: { id: userId, lockedUntil: null }, data: { lockedUntil: new Date(Date.now() + LOGIN_LOCKOUT_MS) } });
    await this.audit?.record({ action: locked ? 'AUTH_ACCOUNT_LOCKED' : 'AUTH_LOGIN_FAILED', entityType: 'User', entityId: userId, requestId, metadata: { failedAttempts: updated.failedLoginAttempts } });
  }

  async refresh(refreshToken: string | undefined, requestId?: string, metadata?: SessionMetadata) {
    if (!refreshToken) throw new UnauthorizedException('Refresh token is missing');
    try {
      const payload = await this.jwt.verifyAsync<RefreshPayload & { jti?: string }>(refreshToken, { secret: this.refreshSecret() });
      if (!payload.sub || !payload.sid) throw new UnauthorizedException('Refresh token is invalid or expired');
      const session = await this.prisma.authSession.findUnique({ where: { id: payload.sid } });
      if (!session || session.userId !== payload.sub || session.revokedAt || session.expiresAt <= new Date()) throw new UnauthorizedException('Refresh token is invalid or expired');
      const currentTokenHash = this.hashToken(refreshToken);
      if (session.refreshTokenHash !== currentTokenHash) {
        await this.revokeSession(session.id);
        throw new UnauthorizedException('Refresh token has already been rotated');
      }
      const user = await this.prisma.user.findUnique({ where: { id: payload.sub }, include: { employee: true } });
      if (!user || !user.isActive) throw new UnauthorizedException('User is inactive');
      const nextRefreshToken = await this.jwt.signAsync({ sub: user.id, sid: session.id, jti: randomUUID() }, { secret: this.refreshSecret(), expiresIn: '7d' });
      const rotated = await this.prisma.authSession.updateMany({ where: { id: session.id, refreshTokenHash: currentTokenHash, revokedAt: null, expiresAt: { gt: new Date() } }, data: { refreshTokenHash: this.hashToken(nextRefreshToken), lastUsedAt: new Date(), ...normalizeSessionMetadata(metadata) } });
      if (rotated.count !== 1) {
        await this.revokeSession(session.id);
        throw new UnauthorizedException('Refresh token has already been rotated');
      }
      const accessToken = await this.jwt.signAsync(this.payloadFor(user, session.id));
      await this.audit?.record({ actorUserId: user.id, action: 'AUTH_REFRESH', entityType: 'AuthSession', entityId: session.id, requestId });
      return { accessToken, refreshToken: nextRefreshToken, user: this.safeUser(user), employee: user.employee };
    } catch (error) {
      if (error instanceof UnauthorizedException) throw error;
      throw new UnauthorizedException('Refresh token is invalid or expired');
    }
  }

  async logout(refreshToken: string | undefined, requestId?: string) {
    if (refreshToken) await this.prisma.authSession.updateMany({ where: { refreshTokenHash: this.hashToken(refreshToken), revokedAt: null }, data: { revokedAt: new Date() } });
    await this.audit?.record({ action: 'AUTH_LOGOUT', entityType: 'AuthSession', requestId });
  }

  async listSessions(userId: string, currentSessionId?: string) {
    const sessions = await this.prisma.authSession.findMany({ where: { userId, revokedAt: null, expiresAt: { gt: new Date() } }, select: { id: true, userAgent: true, ipAddress: true, createdAt: true, lastUsedAt: true, expiresAt: true }, orderBy: { lastUsedAt: 'desc' } });
    return sessions.map((session) => ({ ...session, isCurrent: session.id === currentSessionId }));
  }

  async revokeSessionForUser(sessionId: string, userId: string, requestId?: string) {
    const revoked = await this.prisma.authSession.updateMany({ where: { id: sessionId, userId, revokedAt: null, expiresAt: { gt: new Date() } }, data: { revokedAt: new Date() } });
    if (revoked.count !== 1) throw new NotFoundException('Active session not found');
    await this.audit?.record({ actorUserId: userId, action: 'AUTH_SESSION_REVOKED', entityType: 'AuthSession', entityId: sessionId, requestId });
    return { success: true };
  }

  async issuePasswordResetLink(userId: string, requestId?: string, actorUserId?: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId }, select: { id: true, isActive: true } });
    if (!user || !user.isActive) throw new NotFoundException('Active user not found');
    const frontendUrl = this.config.get<string>('FRONTEND_URL')?.trim();
    if (!frontendUrl) throw new InternalServerErrorException('FRONTEND_URL must be configured to issue password reset links');
    const token = randomBytes(32).toString('base64url');
    const now = new Date();
    const expiresAt = new Date(now.getTime() + PASSWORD_RESET_TTL_MS);
    await this.prisma.$transaction([
      this.prisma.passwordResetToken.updateMany({ where: { userId, usedAt: null }, data: { usedAt: now } }),
      this.prisma.passwordResetToken.create({ data: { userId, tokenHash: this.hashToken(token), expiresAt } }),
    ]);
    await this.audit?.record({ actorUserId, action: 'AUTH_PASSWORD_RESET_LINK_ISSUED', entityType: 'User', entityId: userId, requestId, metadata: { expiresAt: expiresAt.toISOString() } });
    return { resetUrl: `${frontendUrl.replace(/\/$/, '')}/reset-password?token=${encodeURIComponent(token)}`, expiresAt };
  }

  async completePasswordReset(dto: CompletePasswordResetDto, requestId?: string) {
    const now = new Date();
    const passwordHash = await bcrypt.hash(dto.password, 12);
    const userId = await this.prisma.$transaction(async (transaction) => {
      const tokenRecord = await transaction.passwordResetToken.findUnique({ where: { tokenHash: this.hashToken(dto.token) } });
      if (!tokenRecord || tokenRecord.usedAt || tokenRecord.expiresAt <= now) throw new UnauthorizedException('Password reset link is invalid or expired');
      const consumed = await transaction.passwordResetToken.updateMany({ where: { id: tokenRecord.id, usedAt: null, expiresAt: { gt: now } }, data: { usedAt: now } });
      if (consumed.count !== 1) throw new UnauthorizedException('Password reset link is invalid or expired');
      const user = await transaction.user.findUnique({ where: { id: tokenRecord.userId }, select: { id: true, isActive: true } });
      if (!user || !user.isActive) throw new UnauthorizedException('Password reset link is invalid or expired');
      await transaction.user.update({ where: { id: user.id }, data: { passwordHash } });
      await transaction.authSession.updateMany({ where: { userId: user.id, revokedAt: null }, data: { revokedAt: now } });
      await transaction.passwordResetToken.updateMany({ where: { userId: user.id, usedAt: null }, data: { usedAt: now } });
      return user.id;
    });
    await this.audit?.record({ actorUserId: userId, action: 'AUTH_PASSWORD_RESET_COMPLETED', entityType: 'User', entityId: userId, requestId });
    return { success: true };
  }

  async revokeUserSessions(userId: string) {
    await this.prisma.authSession.updateMany({ where: { userId, revokedAt: null }, data: { revokedAt: new Date() } });
  }

  private async revokeSession(id: string) {
    await this.prisma.authSession.updateMany({ where: { id, revokedAt: null }, data: { revokedAt: new Date() } });
  }

  async me(id: string) {
    const user = await this.prisma.user.findUnique({ where: { id }, include: { employee: true } });
    if (!user || !user.isActive) throw new UnauthorizedException('Session expired');
    return { user: this.safeUser(user), employee: user.employee };
  }
}

function normalizeSessionMetadata(metadata?: SessionMetadata) {
  return metadata ? { userAgent: metadata.userAgent?.slice(0, 512), ipAddress: metadata.ipAddress?.slice(0, 64) } : {};
}
