import { Body, Controller, Get, Post, Req, Res, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Request, Response } from 'express';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RequestUser } from '../common/types/request-user';

const isProduction = process.env.NODE_ENV === 'production';
const cookieOptions = (maxAge: number) => ({ httpOnly: true, secure: isProduction, sameSite: isProduction ? ('none' as const) : ('lax' as const), maxAge, path: '/' });

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}
  @Post('login')
  async login(@Body() dto: LoginDto, @Res({ passthrough: true }) response: Response) {
    const result = await this.auth.login(dto);
    response.cookie('access_token', result.accessToken, cookieOptions(15 * 60 * 1000));
    response.cookie('refresh_token', result.refreshToken, cookieOptions(7 * 24 * 60 * 60 * 1000));
    return { user: result.user, employee: result.employee };
  }
  @Post('logout')
  logout(@Res({ passthrough: true }) response: Response) { response.clearCookie('access_token', { path: '/' }); response.clearCookie('refresh_token', { path: '/' }); return { success: true }; }
  @UseGuards(JwtAuthGuard)
  @Get('me')
  me(@CurrentUser() user: RequestUser) { return this.auth.me(user.id); }
  @Post('refresh')
  async refresh(@Req() request: Request, @Res({ passthrough: true }) response: Response) {
    const result = await this.auth.refresh(request.cookies?.refresh_token);
    response.cookie('access_token', result.accessToken, cookieOptions(15 * 60 * 1000));
    return { user: result.user, employee: result.employee };
  }
}
