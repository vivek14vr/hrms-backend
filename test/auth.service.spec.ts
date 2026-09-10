import { AuthService } from '../src/auth/auth.service';

describe('AuthService', () => {
  it('does not expose a password hash in the login response', async () => {
    const prisma = { user: { findUnique: jest.fn().mockResolvedValue({ id: 'u1', name: 'Demo User', email: 'demo@peopleos.demo', passwordHash: '$2a$12$invalid', role: 'EMPLOYEE', employeeId: 'e1', isActive: true, createdAt: new Date(), updatedAt: new Date(), employee: null }) } };
    const jwt = { signAsync: jest.fn().mockResolvedValue('token') };
    const auth = new AuthService(prisma as never, jwt as never);
    jest.spyOn(require('bcryptjs'), 'compare').mockResolvedValue(true);
    const result = await auth.login({ email: 'demo@peopleos.demo', password: 'Employee@123', portal: 'employee' });
    expect(result.user).not.toHaveProperty('passwordHash');
    expect(result.user.email).toBe('demo@peopleos.demo');
    expect(jwt.signAsync).toHaveBeenCalledTimes(2);
  });
});
