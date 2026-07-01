import { ExecutionContext } from '@nestjs/common';
import { afterEach, describe, expect, it } from 'vitest';
import { OptionalAuthGuard } from './optional-auth.guard.js';

function contextWithHeaders(headers: Record<string, string>): ExecutionContext {
  return {
    switchToHttp: () => ({
      getRequest: () => ({ headers }),
    }),
  } as unknown as ExecutionContext;
}

describe('OptionalAuthGuard', () => {
  const originalEnv = process.env;

  afterEach(() => {
    process.env = originalEnv;
  });

  it('proceeds without throwing when app config fails to load in production (missing strong secrets)', () => {
    process.env = {
      ...originalEnv,
      NODE_ENV: 'production',
    };
    delete process.env.JWT_SECRET;
    delete process.env.SYSTEM_API_KEY;
    delete process.env.INTEGRATION_API_KEY;

    expect(() =>
      new OptionalAuthGuard().canActivate(contextWithHeaders({})),
    ).not.toThrow();
    expect(new OptionalAuthGuard().canActivate(contextWithHeaders({}))).toBe(true);
  });

  it('proceeds without an actor when no Authorization header is present', () => {
    process.env = {
      ...originalEnv,
      NODE_ENV: 'test',
      JWT_SECRET: 'test-secret',
    };
    const request: { headers: Record<string, string>; actor?: unknown } = { headers: {} };
    const context = {
      switchToHttp: () => ({ getRequest: () => request }),
    } as unknown as ExecutionContext;

    expect(new OptionalAuthGuard().canActivate(context)).toBe(true);
    expect(request.actor).toBeUndefined();
  });
});
