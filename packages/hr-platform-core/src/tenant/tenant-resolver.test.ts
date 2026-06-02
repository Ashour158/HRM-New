import { createHmac } from 'node:crypto';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  ChainTenantResolver,
  HeaderTenantResolver,
  JwtTenantResolver,
} from './tenant-resolver.js';

const jwtSecret = 'tenant-test-secret';
const devDefaultJwtSecret = 'change-me-in-production';
const tenantId = '00000000-0000-0000-0000-000000000001';
const otherTenantId = '00000000-0000-0000-0000-000000000002';
const originalEnv = process.env;

function base64Url(value: unknown): string {
  return Buffer.from(JSON.stringify(value)).toString('base64url');
}

function signJwt(payload: Record<string, unknown>, secret = jwtSecret): string {
  const header = base64Url({ alg: 'HS256', typ: 'JWT' });
  const body = base64Url(payload);
  const signature = createHmac('sha256', secret)
    .update(`${header}.${body}`)
    .digest('base64url');

  return `${header}.${body}.${signature}`;
}

describe('JwtTenantResolver', () => {
  it('resolves tenant_id only from a verified JWT signature', async () => {
    const resolver = new JwtTenantResolver(jwtSecret);
    const token = signJwt({ tenant_id: tenantId });

    const result = await resolver.resolve({
      headers: { authorization: `Bearer ${token}` },
    });

    expect(result.isOk()).toBe(true);
    expect(result.unwrap().value).toBe(tenantId);
  });

  it('rejects a token whose payload was tampered after signing', async () => {
    const resolver = new JwtTenantResolver(jwtSecret);
    const token = signJwt({ tenant_id: tenantId });
    const [header, , signature] = token.split('.');
    const tamperedToken = `${header}.${base64Url({ tenant_id: otherTenantId })}.${signature}`;

    const result = await resolver.resolve({
      headers: { authorization: `Bearer ${tamperedToken}` },
    });

    expect(result.isErr()).toBe(true);
    result.match(
      () => undefined,
      (error) => expect(error.message).toContain('Invalid JWT signature'),
    );
  });
});

describe('ChainTenantResolver', () => {
  it('uses the verified JWT tenant instead of a mismatched tenant header', async () => {
    const resolver = new ChainTenantResolver([
      new JwtTenantResolver(jwtSecret),
      new HeaderTenantResolver(),
    ]);
    const token = signJwt({ tenant_id: tenantId });

    const result = await resolver.resolve({
      headers: {
        authorization: `Bearer ${token}`,
        'x-tenant-id': otherTenantId,
      },
    });

    expect(result.isOk()).toBe(true);
    expect(result.unwrap().value).toBe(tenantId);
  });

  it('falls back to the tenant header when no bearer token is present', async () => {
    const resolver = new ChainTenantResolver([
      new JwtTenantResolver(jwtSecret),
      new HeaderTenantResolver(),
    ]);

    const result = await resolver.resolve({
      headers: { 'x-tenant-id': tenantId },
    });

    expect(result.isOk()).toBe(true);
    expect(result.unwrap().value).toBe(tenantId);
  });

  it('does not fall back to the tenant header for a tampered bearer token', async () => {
    const resolver = new ChainTenantResolver([
      new JwtTenantResolver(jwtSecret),
      new HeaderTenantResolver(),
    ]);
    const token = signJwt({ tenant_id: tenantId });
    const [header, , signature] = token.split('.');
    const tamperedToken = `${header}.${base64Url({ tenant_id: otherTenantId })}.${signature}`;

    const result = await resolver.resolve({
      headers: {
        authorization: `Bearer ${tamperedToken}`,
        'x-tenant-id': tenantId,
      },
    });

    expect(result.isErr()).toBe(true);
    result.match(
      () => undefined,
      (error) => expect(error.message).toContain('JWT tenant resolution failed'),
    );
  });
});

describe('tenantResolver singleton defaults', () => {
  afterEach(() => {
    process.env = originalEnv;
    vi.resetModules();
  });

  it('verifies dev JWTs signed with the app default when JWT_SECRET is unset', async () => {
    process.env = { ...originalEnv, NODE_ENV: 'development' };
    delete process.env.JWT_SECRET;
    vi.resetModules();
    const { tenantResolver } = await import('./tenant-resolver.js');
    const token = signJwt({ tenant_id: tenantId }, devDefaultJwtSecret);

    const result = await tenantResolver.resolve({
      headers: { authorization: `Bearer ${token}` },
    });

    expect(result.isOk()).toBe(true);
    expect(result.unwrap().value).toBe(tenantId);
  });

  it('does not accept the dev default JWT secret in production', async () => {
    process.env = { ...originalEnv, NODE_ENV: 'production' };
    delete process.env.JWT_SECRET;
    vi.resetModules();
    const { tenantResolver } = await import('./tenant-resolver.js');
    const token = signJwt({ tenant_id: tenantId }, devDefaultJwtSecret);

    const result = await tenantResolver.resolve({
      headers: { authorization: `Bearer ${token}` },
    });

    expect(result.isErr()).toBe(true);
  });
});
