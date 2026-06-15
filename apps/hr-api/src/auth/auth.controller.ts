import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  Res,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { Request, Response } from 'express';
import { Public } from '../decorators/public.decorator.js';
import { Permissions } from '../decorators/permissions.decorator.js';
import { AuthService, type AuthUser } from './auth.service.js';
import { LoginRateLimitGuard } from './login-rate-limit.guard.js';
import { SsoConfigService, type SsoConfigInput } from './sso-config.service.js';
import { SsoOidcService } from './sso-oidc.service.js';

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
  constructor(
    private readonly authService: AuthService,
    private readonly ssoConfigService: SsoConfigService,
    private readonly ssoOidcService: SsoOidcService,
  ) {}

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
  async providers(@Req() req: Request, @Query('tenantId') tenantId?: string) {
    if (tenantId) {
      return this.ssoConfigService.discovery(tenantId);
    }
    const header = req.headers['x-tenant-id'];
    const headerTenantId = Array.isArray(header) ? header[0] : header;
    if (typeof headerTenantId === 'string') {
      return this.ssoConfigService.discovery(headerTenantId);
    }
    return this.authService.authProviders();
  }

  @Get('sso/config')
  @Permissions('SSO_MANAGE')
  async listSsoConfig(@Req() req: Request) {
    if (!req.actor) throw new UnauthorizedException('Authenticated actor missing');
    return this.ssoConfigService.list(req.actor, this.authenticatedTenantId(req));
  }

  @Post('sso/config')
  @Permissions('SSO_MANAGE')
  async createSsoConfig(@Req() req: Request, @Body() dto: SsoConfigInput) {
    if (!req.actor) throw new UnauthorizedException('Authenticated actor missing');
    return this.ssoConfigService.create(req.actor, this.authenticatedTenantId(req), dto);
  }

  @Patch('sso/config/:id')
  @Permissions('SSO_MANAGE')
  async updateSsoConfig(@Req() req: Request, @Param('id') id: string, @Body() dto: Partial<SsoConfigInput>) {
    if (!req.actor) throw new UnauthorizedException('Authenticated actor missing');
    return this.ssoConfigService.update(req.actor, this.authenticatedTenantId(req), id, dto);
  }

  @Delete('sso/config/:id')
  @Permissions('SSO_MANAGE')
  async deleteSsoConfig(@Req() req: Request, @Param('id') id: string) {
    if (!req.actor) throw new UnauthorizedException('Authenticated actor missing');
    return this.ssoConfigService.remove(req.actor, this.authenticatedTenantId(req), id);
  }

  @Get('sso/oidc/:tenantId/start')
  @Public()
  async startOidc(@Req() req: Request, @Param('tenantId') tenantId: string, @Res() res: Response) {
    const result = await this.ssoOidcService.start(tenantId, this.apiBaseUrl(req));
    res.redirect(302, result.redirectUrl);
  }

  @Get('sso/oidc/:tenantId/callback')
  @Public()
  async oidcCallback(@Req() req: Request, @Param('tenantId') tenantId: string, @Res() res: Response) {
    const credentials = await this.ssoOidcService.callback(tenantId, absoluteRequestUrl(req));
    res.redirect(302, webSsoCallbackUrl(req, credentials.token, credentials.refreshToken));
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

  private authenticatedTenantId(req: Request): string {
    const actorWithTenant = req.actor as (typeof req.actor & { tenantId?: { value?: string } }) | undefined;
    const actorTenantId = actorWithTenant?.tenantId?.value ?? (req as Request & { tenantId?: string }).tenantId;
    if (!actorTenantId) throw new UnauthorizedException('Authenticated tenant context missing');
    return actorTenantId;
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

  private apiBaseUrl(req: Request): string {
    return `${req.protocol}://${req.get('host')}`;
  }
}

function absoluteRequestUrl(req: Request): URL {
  return new URL(`${req.protocol}://${req.get('host')}${req.originalUrl || req.url}`);
}

function webSsoCallbackUrl(req: Request, token: string, refreshToken: string): string {
  const origin = req.get('x-web-callback-origin') || 'http://localhost:4173';
  const url = new URL('/auth/sso/callback', origin);
  url.searchParams.set('token', token);
  url.searchParams.set('refreshToken', refreshToken);
  return url.toString();
}
