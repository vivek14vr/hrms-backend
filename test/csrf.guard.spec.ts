import { ForbiddenException } from '@nestjs/common';
import { CsrfGuard } from '../src/common/guards/csrf.guard';

function contextFor(request: { method: string; cookies?: { csrf_token?: string }; get: (name: string) => string | undefined }) {
  return { switchToHttp: () => ({ getRequest: () => request }) } as never;
}

describe('CsrfGuard', () => {
  const guard = new CsrfGuard();

  it('allows safe methods without a token', () => {
    expect(guard.canActivate(contextFor({ method: 'GET', get: () => undefined }))).toBe(true);
  });

  it('requires a matching cookie and request header for unsafe methods', () => {
    const request = { method: 'POST', cookies: { csrf_token: 'token-123' }, get: () => 'token-123' };
    expect(guard.canActivate(contextFor(request))).toBe(true);
    expect(() => guard.canActivate(contextFor({ ...request, get: () => 'wrong-token' }))).toThrow(ForbiddenException);
    expect(() => guard.canActivate(contextFor({ method: 'POST', get: () => undefined }))).toThrow(ForbiddenException);
  });
});
