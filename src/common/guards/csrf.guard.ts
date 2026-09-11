import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Request } from 'express';
import { timingSafeEqual } from 'node:crypto';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

@Injectable()
export class CsrfGuard implements CanActivate {
  canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest<Request>();
    if (SAFE_METHODS.has(request.method)) return true;

    const cookieToken = request.cookies?.csrf_token;
    const headerToken = request.get('x-csrf-token');
    if (typeof cookieToken !== 'string' || typeof headerToken !== 'string' || cookieToken.length !== headerToken.length) throw new ForbiddenException('A valid CSRF token is required');

    const cookieBytes = Buffer.from(cookieToken);
    const headerBytes = Buffer.from(headerToken);
    if (cookieBytes.length !== headerBytes.length || !timingSafeEqual(cookieBytes, headerBytes)) throw new ForbiddenException('A valid CSRF token is required');
    return true;
  }
}
