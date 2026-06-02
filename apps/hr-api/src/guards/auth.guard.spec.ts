import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { afterEach, describe, expect, it } from 'vitest';
import { AuthGuard } from './auth.guard.js';

function contextWithHeaders(headers: Record<string, string>): ExecutionContext {
  return {
    switchToHttp: () => ({
      getRequest: () => ({ headers }),
    }),
  } as unknown as ExecutionContext;
}

describe('AuthGuard API key defaults', () => {
  const originalEnv = process.env;

  afterEach(() => {
    process.env = originalEnv;
  });

  it('does not accept static demo API keys in production', () => {
    process.env = {
      ...originalEnv,
      NODE_ENV: 'production',
      JWT_SECRET: 'production-secret-with-enough-entropy',
    };
    delete process.env.SYSTEM_API_KEY;
    delete process.env.INTEGRATION_API_KEY;

    expect(() =>
      new AuthGuard().canActivate(contextWithHeaders({ 'x-api-key': 'system-api-key' })),
    ).toThrow(ForbiddenException);
  });
});
