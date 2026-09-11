import { UnauthorizedException } from '@nestjs/common';
import { AuthService } from '../src/auth/auth.service';

describe('AuthService password reset', () => {
  it('completes a valid reset and revokes every active session', async () => {
    const updateMany = jest.fn().mockResolvedValue({ count: 1 });
    const userUpdate = jest.fn().mockResolvedValue({ id: 'user-1' });
    const transaction = {
      passwordResetToken: {
        findUnique: jest.fn().mockResolvedValue({ id: 'reset-1', userId: 'user-1', tokenHash: 'hash', expiresAt: new Date(Date.now() + 60_000), usedAt: null }),
        updateMany,
      },
      user: { findUnique: jest.fn().mockResolvedValue({ id: 'user-1', isActive: true }), update: userUpdate },
      authSession: { updateMany: jest.fn().mockResolvedValue({ count: 2 }) },
    };
    const prisma = { $transaction: jest.fn((callback: (db: typeof transaction) => unknown) => callback(transaction)) };
    const auth = new AuthService(prisma as never, {} as never, { getOrThrow: jest.fn() } as never);

    await expect(auth.completePasswordReset({ token: 'a'.repeat(32), password: 'NewPassword!123' })).resolves.toEqual({ success: true });
    expect(userUpdate).toHaveBeenCalledWith({ where: { id: 'user-1' }, data: { passwordHash: expect.any(String) } });
    expect(transaction.authSession.updateMany).toHaveBeenCalledWith({ where: { userId: 'user-1', revokedAt: null }, data: { revokedAt: expect.any(Date) } });
  });

  it('rejects an expired reset link without changing the password', async () => {
    const userUpdate = jest.fn();
    const transaction = { passwordResetToken: { findUnique: jest.fn().mockResolvedValue({ id: 'reset-1', userId: 'user-1', expiresAt: new Date(Date.now() - 60_000), usedAt: null }) }, user: { update: userUpdate }, authSession: { updateMany: jest.fn() } };
    const auth = new AuthService({ $transaction: jest.fn((callback: (db: typeof transaction) => unknown) => callback(transaction)) } as never, {} as never, { getOrThrow: jest.fn() } as never);

    await expect(auth.completePasswordReset({ token: 'a'.repeat(32), password: 'NewPassword!123' })).rejects.toThrow(UnauthorizedException);
    expect(userUpdate).not.toHaveBeenCalled();
  });
});
