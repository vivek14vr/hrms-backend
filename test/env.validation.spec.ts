import { validateEnvironment } from '../src/config/env.validation';

describe('validateEnvironment', () => {
  it('rejects missing or short JWT secrets', () => {
    expect(() => validateEnvironment({ JWT_SECRET: 'missing' })).toThrow('JWT_SECRET');
    expect(() => validateEnvironment({ JWT_SECRET: 'a'.repeat(32), JWT_REFRESH_SECRET: 'short' })).toThrow('JWT_REFRESH_SECRET');
    expect(() => validateEnvironment({ JWT_SECRET: 'replace-with-a-long-random-secret', JWT_REFRESH_SECRET: 'b'.repeat(32) })).toThrow('JWT_SECRET');
  });

  it('accepts explicitly configured secrets', () => {
    const config = { JWT_SECRET: 'a'.repeat(32), JWT_REFRESH_SECRET: 'b'.repeat(32), NODE_ENV: 'test' };
    expect(validateEnvironment(config)).toBe(config);
  });
});
