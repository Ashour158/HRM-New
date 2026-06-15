import { BadRequestException, Body, Controller, Get, Post, Req, UnauthorizedException, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { Public } from '../decorators/public.decorator.js';
import { AuthService, type AuthUser } from './auth.service.js';
import { LoginRateLimitGuard } from './login-rate-limit.guard.js';

interface LoginDto {
  email: string;
  password: string;
  tenantId?: string;
}

interface RefreshDto {
  refreshToken: string;
}

interface MfaVerifyDto {
  code: string;
}

interface RegisterDto {
  tenantId?: string;
  email: string;
  password: string;
  firstName?: string;
  lastName?: string;
}

interface InviteDto {
  tenantId?: string;
  email: string;
  firstName?: string;
  lastName?: string;
}

interface PasswordResetRequestDto {
  tenantId?: string;
  email: string;
}

interface PasswordResetConfirmDto {
  token: string;
  password: string;
}

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  @Public()
  @UseGuards(LoginRateLimitGuard)
  async login(@Req() req: Request, @Body() dto: LoginDto) {
    const tenantId = this.resolveTenantId(req, dto.tenantId);
    const user = await this.authService.validateCredentials(dto.email, dto.password, tenantId);
    const credentials = await this.authService.createSession(user);

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
    const credentials = await this.authService.refreshSession(dto.refreshToken);
    return {
      token: credentials.token,
      refreshToken: credentials.refreshToken,
      session: credentials.session,
    };
  }

  @Post('register')
  @Public()
  async register(@Req() req: Request, @Body() dto: RegisterDto) {
    const user = await this.authService.register({
      tenantId: this.resolveTenantId(req, dto.tenantId),
      email: dto.email,
      password: dto.password,
      firstName: dto.firstName,
      lastName: dto.lastName,
    });
    const credentials = await this.authService.createSession(user);
    return {
      user: this.toUserResponse(user),
      token: credentials.token,
      refreshToken: credentials.refreshToken,
      session: credentials.session,
    };
  }

  @Post('invite')
  async invite(@Req() req: Request, @Body() dto: InviteDto) {
    if (!req.actor) throw new UnauthorizedException('Authenticated actor missing');
    // Privileged action: bind the target tenant to the authenticated request context
    // only. Never trust a DTO/header tenant for invite, which would allow cross-tenant
    // user creation.
    const actorTenantId = (req as Request & { tenantId?: string }).tenantId;
    if (!actorTenantId) throw new UnauthorizedException('Authenticated tenant context missing');
    const result = await this.authService.invite(req.actor, {
      tenantId: actorTenantId,
      email: dto.email,
      firstName: dto.firstName,
      lastName: dto.lastName,
    });
    return {
      user: this.toUserResponse(result.user),
      setPasswordToken: result.setPasswordToken,
      expiresAt: result.expiresAt,
    };
  }

  @Post('password-reset/request')
  @Public()
  async requestPasswordReset(@Req() req: Request, @Body() dto: PasswordResetRequestDto) {
    return this.authService.requestPasswordReset(this.resolveTenantId(req, dto.tenantId), dto.email);
  }

  @Post('password-reset/confirm')
  @Public()
  async confirmPasswordReset(@Body() dto: PasswordResetConfirmDto) {
    return this.authService.confirmPasswordReset(dto.token, dto.password);
  }

  @Get('me')
  async me(@Req() req: Request) {
    const actorId = req.actor?.actorId.value;
    if (!actorId) throw new UnauthorizedException('Authenticated actor missing');
    const user = await this.authService.findById(actorId);
    if (!user) throw new UnauthorizedException('Authenticated user no longer exists');
    return this.toUserResponse(user);
  }

  @Post('logout')
  async logout(@Req() req: Request) {
    await this.authService.revokeSession(req.actor?.sessionId);
    return { ok: true };
  }

  @Post('mfa/setup')
  async setupMfa(@Req() req: Request) {
    if (!req.actor) throw new UnauthorizedException('Authenticated actor missing');
    return this.authService.setupMfa(req.actor);
  }

  @Post('mfa/verify')
  async verifyMfa(@Req() req: Request, @Body() dto: MfaVerifyDto) {
    if (!req.actor) throw new UnauthorizedException('Authenticated actor missing');
    const credentials = await this.authService.verifyMfa(req.actor, dto.code);
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

  private resolveTenantId(req: Request, tenantId?: string): string {
    const header = req.headers['x-tenant-id'];
    const headerTenantId = Array.isArray(header) ? header[0] : header;
    const requestTenantId = (req as Request & { tenantId?: string }).tenantId;
    const resolved = tenantId || requestTenantId || headerTenantId;
    if (!resolved || typeof resolved !== 'string') {
      throw new BadRequestException('Tenant ID is required');
    }
    return resolved;
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
