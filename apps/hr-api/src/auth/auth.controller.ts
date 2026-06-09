import { Body, Controller, Get, Post, Req, UnauthorizedException } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { Public } from '../decorators/public.decorator.js';
import { AuthService, type AuthUser } from './auth.service.js';

interface LoginDto {
  email: string;
  password: string;
}

interface RefreshDto {
  refreshToken: string;
}

interface MfaVerifyDto {
  code: string;
}

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  @Public()
  async login(@Body() dto: LoginDto) {
    const user = await this.authService.validateCredentials(dto.email, dto.password);
    const credentials = this.authService.createSession(user);

    return {
      user: this.toUserResponse(user),
      token: credentials.token,
      refreshToken: credentials.refreshToken,
      session: credentials.session,
    };
  }

  @Post('refresh')
  @Public()
  async refresh(@Body() dto: RefreshDto) {
    if (!dto.refreshToken) throw new UnauthorizedException('Missing refresh token');
    const credentials = this.authService.refreshSession(dto.refreshToken);
    return {
      token: credentials.token,
      refreshToken: credentials.refreshToken,
      session: credentials.session,
    };
  }

  @Get('me')
  async me(@Req() req: Request) {
    const actorId = req.actor?.actorId.value;
    if (!actorId) throw new UnauthorizedException('Authenticated actor missing');
    const user = this.authService.findById(actorId);
    if (!user) throw new UnauthorizedException('Authenticated user no longer exists');
    return this.toUserResponse(user);
  }

  @Post('logout')
  async logout(@Req() req: Request) {
    this.authService.revokeSession(req.actor?.sessionId);
    return { ok: true };
  }

  @Post('mfa/verify')
  async verifyMfa(@Req() req: Request, @Body() dto: MfaVerifyDto) {
    if (!req.actor) throw new UnauthorizedException('Authenticated actor missing');
    const credentials = this.authService.verifyMfa(req.actor, dto.code);
    return {
      token: credentials.token,
      refreshToken: credentials.refreshToken,
      session: credentials.session,
    };
  }

  @Get('providers')
  @Public()
  async providers() {
    return this.authService.authProviders();
  }

  private toUserResponse(user: AuthUser) {
    return {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      tenantId: user.tenantId,
      roles: user.roles.map((name) => ({ id: name, name })),
      permissions: user.permissions.map((p) => {
        const [resource, action] = p.split('_');
        return { id: p, resource: resource ?? p, action: action ?? 'MANAGE' };
      }),
    };
  }
}
