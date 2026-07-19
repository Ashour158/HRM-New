import { describe, expect, it, vi } from 'vitest';
import type { ExecutionContext, CallHandler } from '@nestjs/common';
import type { Reflector } from '@nestjs/core';
import { lastValueFrom, of } from 'rxjs';
import { Uuid } from '@hcm/shared-kernel';
import { AuditInterceptor } from './audit.interceptor.js';

const tenantId = '00000000-0000-0000-0000-000000000001';
const actorId = new Uuid('00000000-0000-0000-0000-000000000002');
const correlationId = '00000000-0000-0000-0000-000000000003';
const resourceId = '00000000-0000-0000-0000-000000000004';
const commandAuditRecordId = new Uuid('00000000-0000-0000-0000-000000000005');

function contextFor(request: Record<string, unknown>, response: { setHeader: ReturnType<typeof vi.fn> }): ExecutionContext {
  return {
    switchToHttp: () => ({
      getRequest: () => request,
      getResponse: () => response,
    }),
    getClass: () => class WorkersController {},
    getHandler: () => function updateWorker() {},
  } as unknown as ExecutionContext;
}

function handler(result: unknown): CallHandler {
  return { handle: () => of(result) };
}

function reflector(isPublic = false): Pick<Reflector, 'getAllAndOverride'> {
  return {
    getAllAndOverride: vi.fn(() => isPublic),
  };
}

describe('AuditInterceptor', () => {
  it('does not write a second HTTP audit row when a command result already has authoritative audit evidence', async () => {
    const auditLedger = { write: vi.fn() };
    const response = { setHeader: vi.fn() };
    const interceptor = new AuditInterceptor(auditLedger as never, reflector() as never);

    const result = await lastValueFrom(interceptor.intercept(
      contextFor({
        method: 'POST',
        tenantId,
        correlationId,
        actor: { actorType: 'USER', actorId },
        route: { path: '/workers' },
        path: '/workers',
        body: {},
        params: {},
      }, response),
      handler({
        success: true,
        auditRecordId: commandAuditRecordId,
      }),
    ));

    expect(result).toMatchObject({ success: true, auditRecordId: commandAuditRecordId });
    expect(auditLedger.write).not.toHaveBeenCalled();
    expect(response.setHeader).toHaveBeenCalledWith('X-Audit-Record-Id', commandAuditRecordId.value);
  });

  it('writes fallback HTTP mutation audit with real tenant, correlation, actor, and resource evidence', async () => {
    const auditLedger = { write: vi.fn(async () => undefined) };
    const response = { setHeader: vi.fn() };
    const interceptor = new AuditInterceptor(auditLedger as never, reflector() as never);

    await lastValueFrom(interceptor.intercept(
      contextFor({
        method: 'PATCH',
        tenantId,
        correlationId,
        actor: { actorType: 'USER', actorId },
        route: { path: '/workers/:id' },
        path: `/workers/${resourceId}`,
        body: {
          nationalId: '123456789',
          profile: { passportNumber: 'P123456' },
        },
        params: { id: resourceId },
      }, response),
      handler({ id: resourceId, status: 'ACTIVE' }),
    ));

    expect(auditLedger.write).toHaveBeenCalledTimes(1);
    expect(auditLedger.write).toHaveBeenCalledWith(expect.objectContaining({
      tenantId: expect.objectContaining({ value: tenantId }),
      actorType: 'USER',
      actorId,
      action: 'PATCH /workers/:id',
      resourceType: 'WorkersController',
      resourceId: expect.objectContaining({ value: resourceId }),
      correlationId: expect.objectContaining({ value: correlationId }),
      payload: {
        body: {
          nationalId: '***REDACTED***',
          profile: { passportNumber: '***REDACTED***' },
        },
        resourceIdSource: 'route.params.id',
      },
    }));
    expect(response.setHeader).toHaveBeenCalledWith('X-Audit-Record-Id', expect.any(String));
  });

  it('redacts auth-secret and password-change field variants in fallback HTTP mutation audit', async () => {
    const auditLedger = { write: vi.fn(async () => undefined) };
    const response = { setHeader: vi.fn() };
    const interceptor = new AuditInterceptor(auditLedger as never, reflector() as never);

    await lastValueFrom(interceptor.intercept(
      contextFor({
        method: 'POST',
        tenantId,
        correlationId,
        actor: { actorType: 'USER', actorId },
        route: { path: '/auth/change-password' },
        path: '/auth/change-password',
        body: {
          currentPassword: 'OldPassword123!',
          newPassword: 'NewPassword123!',
          confirmPassword: 'NewPassword123!',
          accessToken: 'access-token-value',
          sessionToken: 'session-token-value',
        },
        params: {},
      }, response),
      handler({ ok: true }),
    ));

    expect(auditLedger.write).toHaveBeenCalledWith(expect.objectContaining({
      payload: {
        body: {
          currentPassword: '***REDACTED***',
          newPassword: '***REDACTED***',
          confirmPassword: '***REDACTED***',
          accessToken: '***REDACTED***',
          sessionToken: '***REDACTED***',
        },
        resourceIdSource: 'tenant',
      },
    }));
  });

  it('propagates fallback audit write failures for non-command mutations', async () => {
    const auditLedger = { write: vi.fn(async () => { throw new Error('audit store unavailable'); }) };
    const response = { setHeader: vi.fn() };
    const interceptor = new AuditInterceptor(auditLedger as never, reflector() as never);

    await expect(lastValueFrom(interceptor.intercept(
      contextFor({
        method: 'DELETE',
        tenantId,
        correlationId,
        actor: { actorType: 'USER', actorId },
        route: { path: '/workers/:id' },
        path: `/workers/${resourceId}`,
        body: {},
        params: { id: resourceId },
      }, response),
      handler({ ok: true }),
    ))).rejects.toThrow('audit store unavailable');
  });

  it('skips public mutation routes that do not have tenant or actor audit context yet', async () => {
    const auditLedger = { write: vi.fn() };
    const response = { setHeader: vi.fn() };
    const interceptor = new AuditInterceptor(auditLedger as never, reflector(true) as never);

    await expect(lastValueFrom(interceptor.intercept(
      contextFor({
        method: 'POST',
        route: { path: '/auth/login' },
        path: '/auth/login',
        body: { email: 'employee@example.com', password: 'Password123!' },
        params: {},
      }, response),
      handler({ token: 'token' }),
    ))).resolves.toEqual({ token: 'token' });

    expect(auditLedger.write).not.toHaveBeenCalled();
    expect(response.setHeader).not.toHaveBeenCalled();
  });
});
