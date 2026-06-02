import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { loadAppConfig } from './app.config.js';

const originalEnv = process.env;

describe('loadAppConfig security defaults', () => {
  beforeEach(() => {
    process.env = { ...originalEnv };
    delete process.env.PORT;
    delete process.env.JWT_SECRET;
    delete process.env.SYSTEM_API_KEY;
    delete process.env.INTEGRATION_API_KEY;
    process.env.NODE_ENV = 'development';
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('defaults the API port to 3001 for local frontend and smoke tests', () => {
    expect(loadAppConfig().port).toBe(3001);
  });

  it('rejects the placeholder JWT secret in production', () => {
    process.env.NODE_ENV = 'production';
    process.env.JWT_SECRET = 'change-me-in-production';

    expect(() => loadAppConfig()).toThrow('JWT_SECRET');
  });

  it('rejects demo API keys when explicitly configured in production', () => {
    process.env.NODE_ENV = 'production';
    process.env.JWT_SECRET = 'production-secret-with-enough-entropy';
    process.env.SYSTEM_API_KEY = 'system-api-key';

    expect(() => loadAppConfig()).toThrow('SYSTEM_API_KEY');
  });
});
