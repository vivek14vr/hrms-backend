import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { RequestUser } from '../types/request-user';

export const CurrentUser = createParamDecorator((_data: unknown, ctx: ExecutionContext): RequestUser => { const request = ctx.switchToHttp().getRequest<{ user: RequestUser; requestId?: string }>(); return { ...request.user, requestId: request.requestId }; });
