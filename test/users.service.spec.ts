import { ConflictException } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { UsersService } from '../src/users/users.service';

const admin = { id: 'admin-1', name: 'Admin', email: 'admin@example.com', role: UserRole.ADMIN, employeeId: null };

describe('UsersService', () => {
  it('protects the last active administrator', async () => {
    const prisma = {
      user: { findUnique: jest.fn().mockResolvedValue({ id: 'admin-1', role: UserRole.ADMIN, isActive: true }), count: jest.fn().mockResolvedValue(1) },
    };
    const service = new UsersService(prisma as never);

    await expect(service.updateStatus('admin-1', false, admin)).rejects.toThrow(ConflictException);
  });

  it('deactivates instead of deleting accounts so audit references remain valid', async () => {
    const update = jest.fn().mockResolvedValue({ id: 'user-2', isActive: false });
    const prisma = {
      user: { findUnique: jest.fn().mockResolvedValue({ id: 'user-2', role: UserRole.EMPLOYEE, isActive: true }), update },
      authSession: { updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
    };
    const service = new UsersService(prisma as never);

    await expect(service.remove('user-2', admin)).resolves.toEqual({ success: true });
    expect(update).toHaveBeenCalledWith({ where: { id: 'user-2' }, data: { isActive: false } });
    expect(prisma.authSession.updateMany).toHaveBeenCalled();
  });
});
