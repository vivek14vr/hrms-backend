import { AuthService } from '../src/auth/auth.service';
import { createHash } from 'node:crypto';

describe('AuthService', () => {
  it('does not expose a password hash in the login response', async () => {
    const prisma = { user: { findUnique: jest.fn().mockResolvedValue({ id: 'u1', name: 'Demo User', email: 'demo@peopleos.demo', passwordHash: '$2a$12$invalid', role: 'EMPLOYEE', employeeId: 'e1', isActive: true, createdAt: new Date(), updatedAt: new Date(), employee: null }) }, authSession: { create: jest.fn().mockResolvedValue({}) } };
    const jwt = { signAsync: jest.fn().mockResolvedValue('token') };
    const config = { getOrThrow: jest.fn().mockReturnValue('test-refresh-secret-that-is-long-enough') };
    const auth = new AuthService(prisma as never, jwt as never, config as never);
    jest.spyOn(require('bcryptjs'), 'compare').mockResolvedValue(true);
    const result = await auth.login({ email: 'demo@peopleos.demo', password: 'Employee@123', portal: 'employee' });
    expect(result.user).not.toHaveProperty('passwordHash');
    expect(result.user.email).toBe('demo@peopleos.demo');
    expect(jwt.signAsync).toHaveBeenCalledTimes(2);
  });

  it('rotates a refresh token and persists only its hash', async () => {
    const currentToken = 'current-refresh-token';
    const prisma = {
      user: { findUnique: jest.fn().mockResolvedValue({ id: 'u1', name: 'Demo User', email: 'demo@peopleos.demo', role: 'EMPLOYEE', employeeId: 'e1', isActive: true, createdAt: new Date(), updatedAt: new Date(), employee: null }) },
      authSession: {
        findUnique: jest.fn().mockResolvedValue({ id: 'session-1', userId: 'u1', refreshTokenHash: createHash('sha256').update(currentToken).digest('hex'), expiresAt: new Date(Date.now() + 60_000), revokedAt: null }),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
    };
    const jwt = { verifyAsync: jest.fn().mockResolvedValue({ sub: 'u1', sid: 'session-1' }), signAsync: jest.fn().mockResolvedValueOnce('next-refresh-token').mockResolvedValueOnce('next-access-token') };
    const config = { getOrThrow: jest.fn().mockReturnValue('test-refresh-secret-that-is-long-enough') };
    const auth = new AuthService(prisma as never, jwt as never, config as never);

    const result = await auth.refresh(currentToken);

    expect(result.refreshToken).toBe('next-refresh-token');
    expect(result.accessToken).toBe('next-access-token');
    expect(prisma.authSession.updateMany).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ refreshTokenHash: createHash('sha256').update(currentToken).digest('hex') }), data: expect.objectContaining({ refreshTokenHash: expect.not.stringMatching(currentToken), lastUsedAt: expect.any(Date) }) }));
  });

  it('locks an account after the fifth failed password attempt', async () => {
    const update = jest.fn().mockResolvedValue({ failedLoginAttempts: 5 });
    const updateMany = jest.fn().mockResolvedValue({ count: 1 });
    const prisma = {
      user: { findUnique: jest.fn().mockResolvedValue({ id: 'u1', name: 'Demo User', email: 'demo@example.com', passwordHash: '$2a$12$invalid', role: 'EMPLOYEE', employeeId: 'e1', isActive: true, failedLoginAttempts: 4, lockedUntil: null, createdAt: new Date(), updatedAt: new Date(), employee: null }), update, updateMany },
    };
    const auth = new AuthService(prisma as never, {} as never, { getOrThrow: jest.fn() } as never);
    jest.spyOn(require('bcryptjs'), 'compare').mockResolvedValue(false);

    await expect(auth.login({ email: 'demo@example.com', password: 'WrongPassword!123', portal: 'employee' })).rejects.toThrow('Invalid email or password');
    expect(update).toHaveBeenCalledWith(expect.objectContaining({ data: { failedLoginAttempts: { increment: 1 } }, select: { failedLoginAttempts: true } }));
    expect(updateMany).toHaveBeenCalledWith(expect.objectContaining({ data: { lockedUntil: expect.any(Date) } }));
  });

  it('rejects a currently locked account before checking its password', async () => {
    const compare = (require('bcryptjs') as { compare: jest.Mock }).compare;
    compare.mockClear();
    const prisma = { user: { findUnique: jest.fn().mockResolvedValue({ id: 'u1', isActive: true, lockedUntil: new Date(Date.now() + 60_000) }) } };
    const auth = new AuthService(prisma as never, {} as never, { getOrThrow: jest.fn() } as never);

    await expect(auth.login({ email: 'demo@example.com', password: 'AnyPassword!123' })).rejects.toThrow('Invalid email or password');
    expect(compare).not.toHaveBeenCalled();
  });

  it('revokes the current session on logout', async () => {
    const prisma = { authSession: { updateMany: jest.fn().mockResolvedValue({ count: 1 }) } };
    const auth = new AuthService(prisma as never, {} as never, { getOrThrow: jest.fn() } as never);

    await auth.logout('refresh-token');

    expect(prisma.authSession.updateMany).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ revokedAt: null }), data: { revokedAt: expect.any(Date) } }));
  });

  it('lists only active sessions and marks the current device', async () => {
    const findMany = jest.fn().mockResolvedValue([{ id: 'session-1', userAgent: 'Mozilla/5.0', ipAddress: '127.0.0.1', createdAt: new Date(), lastUsedAt: new Date(), expiresAt: new Date(Date.now() + 60_000) }]);
    const auth = new AuthService({ authSession: { findMany } } as never, {} as never, { getOrThrow: jest.fn() } as never);

    await expect(auth.listSessions('u1', 'session-1')).resolves.toEqual([expect.objectContaining({ id: 'session-1', isCurrent: true })]);
    expect(findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { userId: 'u1', revokedAt: null, expiresAt: { gt: expect.any(Date) } } }));
  });

  it('revokes only an active session owned by the requesting user', async () => {
    const updateMany = jest.fn().mockResolvedValue({ count: 1 });
    const auth = new AuthService({ authSession: { updateMany } } as never, {} as never, { getOrThrow: jest.fn() } as never);

    await expect(auth.revokeSessionForUser('session-1', 'u1')).resolves.toEqual({ success: true });
    expect(updateMany).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 'session-1', userId: 'u1', revokedAt: null, expiresAt: { gt: expect.any(Date) } } }));
  });
});
