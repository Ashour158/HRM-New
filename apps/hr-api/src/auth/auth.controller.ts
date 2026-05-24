/**
 * Authentication controller for local development.
 * Provides login, profile, and logout endpoints.
 */

import {
  Controller,
  Post,
  Get,
  Body,
  Headers,
  UnauthorizedException,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { AuthService } from './auth.service.js';

interface LoginDto {
  email: string;
  password: string;
}

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  async login(@Body() dto: LoginDto) {
    const user = await this.authService.validateCredentials(
      dto.email,
      dto.password,
    );
    const token = this.authService.generateToken(user);

    return {
      user: {
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
      },
      token,
    };
  }

  @Get('me')
  async me(
    @Headers('authorization') authHeader: string | undefined,
  ) {
    if (!authHeader) {
      throw new UnauthorizedException('Missing Authorization header');
    }
    const token = authHeader.replace(/^Bearer\s+/i, '');
    const user = this.authService.verifyToken(token);
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

  @Post('logout')
  async logout() {
    // Stateless JWT — nothing to invalidate server-side for local dev.
    return { ok: true };
  }
}
