import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { MODULE_METADATA } from '@nestjs/common/constants';
import { APP_GUARD, Reflector } from '@nestjs/core';
import { describe, expect, it } from 'vitest';
import { AppController } from '../app.controller.js';
import { AppModule } from '../app.module.js';
import { AuthController } from './auth.controller.js';
import { AuthGuard } from '../guards/auth.guard.js';
import { PermissionGuard } from '../guards/permission.guard.js';
import { RolesGuard } from '../guards/roles.guard.js';
import { Public, PUBLIC_ROUTE_KEY } from '../decorators/public.decorator.js';
import { Permissions } from '../decorators/permissions.decorator.js';

function contextFor(handler: () => void, actor?: { permissions?: string[] }): ExecutionContext {
  return {
    getHandler: () => handler,
    getClass: () => TestController,
    switchToHttp: () => ({
      getRequest: () => ({
        headers: {},
        actor,
      }),
    }),
  } as unknown as ExecutionContext;
}

class TestController {
  @Public()
  publicRoute(): void {}

  @Permissions('PAYROLL_MANAGE')
  payrollRoute(): void {}
}

describe('auth hardening', () => {
  it('registers auth, roles, and permission guards globally', () => {
    const providers = Reflect.getMetadata(MODULE_METADATA.PROVIDERS, AppModule) as Array<Record<string, unknown>>;

    expect(providers).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ provide: APP_GUARD, useClass: AuthGuard }),
        expect.objectContaining({ provide: APP_GUARD, useClass: RolesGuard }),
        expect.objectContaining({ provide: APP_GUARD, useClass: PermissionGuard }),
      ]),
    );
  });

  it('marks only true public endpoints as public', () => {
    expect(Reflect.getMetadata(PUBLIC_ROUTE_KEY, AppController.prototype.getHealth)).toBe(true);
    expect(Reflect.getMetadata(PUBLIC_ROUTE_KEY, AppController.prototype.getReadiness)).toBe(true);
    expect(Reflect.getMetadata(PUBLIC_ROUTE_KEY, AppController.prototype.getLiveness)).toBe(true);
    expect(Reflect.getMetadata(PUBLIC_ROUTE_KEY, AuthController.prototype.login)).toBe(true);
    expect(Reflect.getMetadata(PUBLIC_ROUTE_KEY, AuthController.prototype.refresh)).toBe(true);
    expect(Reflect.getMetadata(PUBLIC_ROUTE_KEY, AuthController.prototype.register)).toBe(true);
    expect(Reflect.getMetadata(PUBLIC_ROUTE_KEY, AuthController.prototype.requestPasswordReset)).toBe(true);
    expect(Reflect.getMetadata(PUBLIC_ROUTE_KEY, AuthController.prototype.confirmPasswordReset)).toBe(true);
    expect(Reflect.getMetadata(PUBLIC_ROUTE_KEY, AuthController.prototype.providers)).toBe(true);
    expect(Reflect.getMetadata(PUBLIC_ROUTE_KEY, AuthController.prototype.startOidc)).toBe(true);
    expect(Reflect.getMetadata(PUBLIC_ROUTE_KEY, AuthController.prototype.oidcCallback)).toBe(true);
    expect(Reflect.getMetadata(PUBLIC_ROUTE_KEY, AuthController.prototype.me)).toBeUndefined();
    expect(Reflect.getMetadata(PUBLIC_ROUTE_KEY, AuthController.prototype.invite)).toBeUndefined();
    expect(Reflect.getMetadata(PUBLIC_ROUTE_KEY, AuthController.prototype.createSsoConfig)).toBeUndefined();
    expect(Reflect.getMetadata(PUBLIC_ROUTE_KEY, AuthController.prototype.setupMfa)).toBeUndefined();
  });

  it('auth guard skips explicit public endpoints', () => {
    const guard = new AuthGuard(new Reflector());

    expect(guard.canActivate(contextFor(TestController.prototype.publicRoute))).toBe(true);
  });

  it('permission guard rejects authenticated actors without required permission', () => {
    const guard = new PermissionGuard(new Reflector());

    expect(() =>
      guard.canActivate(contextFor(TestController.prototype.payrollRoute, { permissions: ['SELF_READ'] })),
    ).toThrow(ForbiddenException);
  });

  it('permission guard accepts authenticated actors with required permission', () => {
    const guard = new PermissionGuard(new Reflector());

    expect(
      guard.canActivate(contextFor(TestController.prototype.payrollRoute, { permissions: ['PAYROLL_MANAGE'] })),
    ).toBe(true);
  });
});
