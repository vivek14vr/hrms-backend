import { BadRequestException, ConflictException, Injectable, NotFoundException, Optional } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import bcrypt from 'bcryptjs';
import { UserRole } from '@prisma/client';
import { RequestUser } from '../common/types/request-user';
import { AuditService } from '../audit/audit.service';
import { AuthService } from '../auth/auth.service';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService, @Optional() private readonly audit?: AuditService, @Optional() private readonly auth?: AuthService) {}
  private safe(user: Prisma.UserGetPayload<{ include: { employee: true } }>) { const { passwordHash: _passwordHash, ...safeUser } = user; return safeUser; }
  async findAll(search?: string, role?: UserRole) {
    const users = await this.prisma.user.findMany({ where: { role: role || undefined, OR: search ? [{ name: { contains: search, mode: 'insensitive' } }, { email: { contains: search, mode: 'insensitive' } }] : undefined }, include: { employee: true }, orderBy: { createdAt: 'desc' } });
    return users.map((user) => this.safe(user));
  }
  async create(dto: CreateUserDto, actor?: RequestUser) {
    const name = dto.name.trim();
    const email = dto.email.trim().toLowerCase();
    if (!name) throw new BadRequestException('User name is required');
    const exists = await this.prisma.user.findUnique({ where: { email } });
    if (exists) throw new ConflictException('A user with this email already exists');
    try {
      const user = await this.prisma.user.create({ data: { name, email, passwordHash: await bcrypt.hash(dto.password, 12), role: dto.role, employeeId: dto.employeeId, isActive: dto.isActive ?? true }, include: { employee: true } });
      await this.audit?.record({ actorUserId: actor?.id, action: 'USER_CREATED', entityType: 'User', entityId: user.id, requestId: actor?.requestId, metadata: { role: user.role } });
      return this.safe(user);
    } catch (error) { if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') throw new ConflictException('A user with this email or employee link already exists'); throw error; }
  }
  async update(id: string, dto: UpdateUserDto, actor?: RequestUser) {
    const current = await this.assertExists(id);
    await this.assertNotRemovingLastAdmin(current.role, current.isActive, dto.role ?? current.role, dto.isActive ?? current.isActive);
    const name = dto.name?.trim();
    if (dto.name !== undefined && !name) throw new BadRequestException('User name is required');
    const data: Prisma.UserUncheckedUpdateInput = { name, email: dto.email?.trim().toLowerCase(), role: dto.role, isActive: dto.isActive, employeeId: dto.employeeId === undefined ? undefined : dto.employeeId || null, passwordHash: dto.password ? await bcrypt.hash(dto.password, 12) : undefined };
    try {
      const user = await this.prisma.user.update({ where: { id }, data, include: { employee: true } });
      if (dto.password || dto.isActive === false || dto.role !== undefined) await this.revokeSessions(id);
      await this.audit?.record({ actorUserId: actor?.id, action: 'USER_UPDATED', entityType: 'User', entityId: id, requestId: actor?.requestId, metadata: { fields: Object.keys(dto) } });
      return this.safe(user);
    } catch (error) { if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') throw new ConflictException('A user with this email or employee link already exists'); throw error; }
  }
  async updateStatus(id: string, isActive: boolean, actor?: RequestUser) {
    const current = await this.assertExists(id);
    await this.assertNotRemovingLastAdmin(current.role, current.isActive, current.role, isActive);
    const user = await this.prisma.user.update({ where: { id }, data: { isActive }, include: { employee: true } });
    if (!isActive) await this.revokeSessions(id);
    await this.audit?.record({ actorUserId: actor?.id, action: isActive ? 'USER_ACTIVATED' : 'USER_DEACTIVATED', entityType: 'User', entityId: id, requestId: actor?.requestId });
    return this.safe(user);
  }
  async issuePasswordResetLink(id: string, actor: RequestUser) {
    if (!this.auth) throw new ConflictException('Password reset service is unavailable');
    await this.assertExists(id);
    return this.auth.issuePasswordResetLink(id, actor.requestId, actor.id);
  }
  async remove(id: string, actor?: RequestUser) {
    const current = await this.assertExists(id);
    await this.assertNotRemovingLastAdmin(current.role, current.isActive, current.role, false);
    await this.prisma.user.update({ where: { id }, data: { isActive: false } });
    await this.revokeSessions(id);
    await this.audit?.record({ actorUserId: actor?.id, action: 'USER_DEACTIVATED', entityType: 'User', entityId: id, requestId: actor?.requestId, metadata: { source: 'delete-endpoint' } });
    return { success: true };
  }
  private async revokeSessions(userId: string) { await this.prisma.authSession.updateMany({ where: { userId, revokedAt: null }, data: { revokedAt: new Date() } }); }
  private async assertNotRemovingLastAdmin(currentRole: UserRole, currentIsActive: boolean, nextRole: UserRole, nextIsActive: boolean) {
    const removesActiveAdmin = currentRole === UserRole.ADMIN && currentIsActive && (nextRole !== UserRole.ADMIN || !nextIsActive);
    if (!removesActiveAdmin) return;
    const activeAdmins = await this.prisma.user.count({ where: { role: UserRole.ADMIN, isActive: true } });
    if (activeAdmins <= 1) throw new ConflictException('The last active administrator cannot be removed or deactivated');
  }
  private async assertExists(id: string) { const user = await this.prisma.user.findUnique({ where: { id } }); if (!user) throw new NotFoundException('User not found'); return user; }
}
