import { createHash } from 'node:crypto';
import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AuthGuard } from './auth.guard.js';

function contextWithHeaders(headers: Record<string, string>): ExecutionContext {
  return {
    switchToHttp: () => ({
      getRequest: () => ({ headers }),
    }),
  } as unknown as ExecutionContext;
}

function contextWithRequest(request: Record<string, unknown>): ExecutionContext {
  return {
    switchToHttp: () => ({
      getRequest: () => request,
    }),
  } as unknown as ExecutionContext;
}

/**
 * A minimal fluent stub matching the exact Kysely chain AuthGuard's
 * resolveServiceAccountActor calls: selectFrom().innerJoin().select()
 * .where().where().executeTakeFirst(). Resolves to `row` regardless of the
 * filters, since these tests only need to control the final result.
 */
function fakeDb(row: Record<string, unknown> | undefined) {
  const query: Record<string, unknown> = {};
  query.selectFrom = vi.fn(() => query);
  query.innerJoin = vi.fn(() => query);
  query.select = vi.fn(() => query);
  query.where = vi.fn(() => query);
  query.executeTakeFirst = vi.fn(async () => row);
  return query;
}

describe('AuthGuard API key defaults', () => {
  const originalEnv = process.env;

  afterEach(() => {
    process.env = originalEnv;
  });

  it('does not accept static demo API keys in production', async () => {
    process.env = {
      ...originalEnv,
      NODE_ENV: 'production',
      JWT_SECRET: 'production-secret-with-enough-entropy',
    };
    delete process.env.SYSTEM_API_KEY;
    delete process.env.INTEGRATION_API_KEY;

    const guard = new AuthGuard(undefined, fakeDb(undefined) as never);

    await expect(
      guard.canActivate(contextWithHeaders({ 'x-api-key': 'system-api-key' })),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });
});

describe('AuthGuard service-account credentials (HCM-P0-4)', () => {
  const originalEnv = process.env;
  const tenantId = '00000000-0000-0000-0000-0000000000a1';
  const serviceAccountId = '00000000-0000-0000-0000-0000000000a2';
  const rawKey = 'hcm_sa_test-credential-value';

  afterEach(() => {
    process.env = originalEnv;
  });

  it('binds the actor to the credential\'s own tenant, ignoring any X-Tenant-ID header', async () => {
    process.env = { ...originalEnv, NODE_ENV: 'development' };
    const row = {
      serviceAccountId,
      tenantId,
      accountStatus: 'ACTIVE',
      scopes: ['payroll:export'],
      expiresAt: null,
    };
    const guard = new AuthGuard(undefined, fakeDb(row) as never);
    const request: Record<string, unknown> = {
      headers: { 'x-api-key': rawKey, 'x-tenant-id': '00000000-0000-0000-0000-0000000000ff' },
    };

    const allowed = await guard.canActivate(contextWithRequest(request));

    expect(allowed).toBe(true);
    expect(request.actor).toMatchObject({
      actorType: 'SERVICE_ACCOUNT',
      roles: ['SERVICE_ACCOUNT'],
      permissions: ['payroll:export'],
      tenantId,
    });
    expect((request.actor as { actorId: { value: string } }).actorId.value).toBe(serviceAccountId);
  });

  it('rejects a credential whose service account has been disabled', async () => {
    process.env = { ...originalEnv, NODE_ENV: 'development' };
    const row = {
      serviceAccountId,
      tenantId,
      accountStatus: 'DISABLED',
      scopes: [],
      expiresAt: null,
    };
    const guard = new AuthGuard(undefined, fakeDb(row) as never);
    const request: Record<string, unknown> = { headers: { 'x-api-key': rawKey } };

    await expect(guard.canActivate(contextWithRequest(request))).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('rejects an expired credential', async () => {
    process.env = { ...originalEnv, NODE_ENV: 'development' };
    const row = {
      serviceAccountId,
      tenantId,
      accountStatus: 'ACTIVE',
      scopes: [],
      expiresAt: new Date(Date.now() - 60_000),
    };
    const guard = new AuthGuard(undefined, fakeDb(row) as never);
    const request: Record<string, unknown> = { headers: { 'x-api-key': rawKey } };

    await expect(guard.canActivate(contextWithRequest(request))).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('falls back to the legacy static SYSTEM_API_KEY when no credential matches, with no tenant bound', async () => {
    process.env = { ...originalEnv, NODE_ENV: 'development', SYSTEM_API_KEY: 'legacy-system-key' };
    const guard = new AuthGuard(undefined, fakeDb(undefined) as never);
    const request: Record<string, unknown> = { headers: { 'x-api-key': 'legacy-system-key' } };

    const allowed = await guard.canActivate(contextWithRequest(request));

    expect(allowed).toBe(true);
    expect(request.actor).toMatchObject({ actorType: 'SYSTEM' });
    expect((request.actor as { tenantId?: string }).tenantId).toBeUndefined();
  });
});
