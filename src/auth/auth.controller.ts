import { Body, Controller, Delete, Get, Param, Post, Req, Res, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Request, Response } from 'express';
import { AuthService, SessionMetadata } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RequestUser } from '../common/types/request-user';
import { randomBytes } from 'node:crypto';
import { CompletePasswordResetDto } from './dto/complete-password-reset.dto';

const cookieOptions = (maxAge: number) => { const isProduction = process.env.NODE_ENV === 'production'; return { httpOnly: true, secure: isProduction, sameSite: isProduction ? ('none' as const) : ('lax' as const), maxAge, path: '/' }; };
const csrfCookieOptions = (maxAge: number) => { const isProduction = process.env.NODE_ENV === 'production'; return { httpOnly: false, secure: isProduction, sameSite: isProduction ? ('none' as const) : ('lax' as const), maxAge, path: '/' }; };

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}
  @Post('login')
  async login(@Body() dto: LoginDto, @Req() request: Request & { requestId?: string }, @Res({ passthrough: true }) response: Response) {
    const result = await this.auth.login(dto, request.requestId, requestMetadata(request));
    response.cookie('access_token', result.accessToken, cookieOptions(15 * 60 * 1000));
    response.cookie('refresh_token', result.refreshToken, cookieOptions(7 * 24 * 60 * 60 * 1000));
    return { user: result.user, employee: result.employee };
  }
  @Post('logout')
  async logout(@Req() request: Request & { requestId?: string }, @Res({ passthrough: true }) response: Response) { await this.auth.logout(request.cookies?.refresh_token, request.requestId); response.clearCookie('access_token', { path: '/' }); response.clearCookie('refresh_token', { path: '/' }); return { success: true }; }
  @UseGuards(JwtAuthGuard)
  @Get('me')
  me(@CurrentUser() user: RequestUser) { return this.auth.me(user.id); }
  @UseGuards(JwtAuthGuard)
  @Get('sessions')
  sessions(@CurrentUser() user: RequestUser) { return this.auth.listSessions(user.id, user.sessionId); }
  @UseGuards(JwtAuthGuard)
  @Delete('sessions/:id')
  revokeSession(@Param('id') id: string, @CurrentUser() user: RequestUser) { return this.auth.revokeSessionForUser(id, user.id, user.requestId); }
  @Post('refresh')
  async refresh(@Req() request: Request & { requestId?: string }, @Res({ passthrough: true }) response: Response) {
    const result = await this.auth.refresh(request.cookies?.refresh_token, request.requestId, requestMetadata(request));
    response.cookie('access_token', result.accessToken, cookieOptions(15 * 60 * 1000));
    response.cookie('refresh_token', result.refreshToken, cookieOptions(7 * 24 * 60 * 60 * 1000));
    return { user: result.user, employee: result.employee };
  }
  @Post('password-reset/complete')
  completePasswordReset(@Body() dto: CompletePasswordResetDto, @Req() request: Request & { requestId?: string }) { return this.auth.completePasswordReset(dto, request.requestId); }
  @Get('csrf')
  csrf(@Req() request: Request, @Res({ passthrough: true }) response: Response) {
    const token = request.cookies?.csrf_token ?? randomBytes(32).toString('hex');
    response.cookie('csrf_token', token, csrfCookieOptions(7 * 24 * 60 * 60 * 1000));
    return { csrfToken: token };
  }
}

function requestMetadata(request: Request): SessionMetadata {
  return { userAgent: request.get('user-agent') ?? undefined, ipAddress: request.ip || undefined };
}
