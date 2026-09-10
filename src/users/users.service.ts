import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import bcrypt from 'bcryptjs';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}
  private safe(user: any) { const { passwordHash: _passwordHash, ...safeUser } = user; return safeUser; }
  async findAll(search?: string, role?: string) {
    const users = await this.prisma.user.findMany({ where: { role: role as any || undefined, OR: search ? [{ name: { contains: search, mode: 'insensitive' } }, { email: { contains: search, mode: 'insensitive' } }] : undefined }, include: { employee: true }, orderBy: { createdAt: 'desc' } });
    return users.map((user) => this.safe(user));
  }
  async create(dto: CreateUserDto) {
    const exists = await this.prisma.user.findUnique({ where: { email: dto.email.toLowerCase() } });
    if (exists) throw new ConflictException('A user with this email already exists');
    const user = await this.prisma.user.create({ data: { name: dto.name, email: dto.email.toLowerCase(), passwordHash: await bcrypt.hash(dto.password, 12), role: dto.role, employeeId: dto.employeeId, isActive: dto.isActive ?? true }, include: { employee: true } });
    return this.safe(user);
  }
  async update(id: string, dto: UpdateUserDto) {
    await this.assertExists(id);
    const data: any = { ...dto };
    if (dto.password) { data.passwordHash = await bcrypt.hash(dto.password, 12); delete data.password; }
    if (dto.email) data.email = dto.email.toLowerCase();
    delete data.employeeId; // employee linking is deliberately explicit below
    const user = await this.prisma.user.update({ where: { id }, data, include: { employee: true } });
    if (dto.employeeId !== undefined) await this.prisma.user.update({ where: { id }, data: { employeeId: dto.employeeId || null } });
    return this.safe(user);
  }
  async updateStatus(id: string, isActive: boolean) { await this.assertExists(id); return this.safe(await this.prisma.user.update({ where: { id }, data: { isActive }, include: { employee: true } })); }
  async remove(id: string) { await this.assertExists(id); await this.prisma.user.delete({ where: { id } }); return { success: true }; }
  private async assertExists(id: string) { const user = await this.prisma.user.findUnique({ where: { id } }); if (!user) throw new NotFoundException('User not found'); return user; }
}
