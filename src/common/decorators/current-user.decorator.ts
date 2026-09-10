import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { RequestUser } from '../types/request-user';

export const CurrentUser = createParamDecorator((_data: unknown, ctx: ExecutionContext): RequestUser => ctx.switchToHttp().getRequest().user);
