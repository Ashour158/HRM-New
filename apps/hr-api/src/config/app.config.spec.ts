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
    delete process.env.CORS_ORIGINS;
    delete process.env.PII_DATA_ENCRYPTION_KEY;
    delete process.env.WEB_APP_URL;
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

  it('rejects a low-entropy/dev-marked JWT secret in production (not just the exact placeholder)', () => {
    process.env.NODE_ENV = 'production';
    process.env.JWT_SECRET = 'dev-secret-change-me'; // passed the old guard, weak
    expect(() => loadAppConfig()).toThrow('JWT_SECRET');
  });

  it('rejects a too-short JWT secret in production', () => {
    process.env.NODE_ENV = 'production';
    process.env.JWT_SECRET = 'Xk9$pQ2!'; // strong chars but < 32
    expect(() => loadAppConfig()).toThrow(/at least 32/);
  });

  it('rejects a JWT secret with too little entropy in production', () => {
    process.env.NODE_ENV = 'production';
    process.env.JWT_SECRET = 'a'.repeat(40); // long but 1 distinct char
    expect(() => loadAppConfig()).toThrow(/entropy/);
  });

  it('accepts strong production secrets', () => {
    process.env.NODE_ENV = 'production';
    process.env.JWT_SECRET = 'h8Q$2vNzR7pK!wL4mXbY9cF6tG1sD0jUaE5oI3w';
    process.env.SYSTEM_API_KEY = 'Zr7Z!q9Pk2Lm4Xv8Bn1';
    process.env.INTEGRATION_API_KEY = 'Wq3!Yt8Pn5Lk2Rm9Xb4';
    process.env.PII_DATA_ENCRYPTION_KEY = 'MDEyMzQ1Njc4OWFiY2RlZjAxMjM0NTY3ODlhYmNkZWY=';
    expect(() => loadAppConfig()).not.toThrow();
  });

  it('rejects a missing PII_DATA_ENCRYPTION_KEY in production', () => {
    process.env.NODE_ENV = 'production';
    process.env.JWT_SECRET = 'h8Q$2vNzR7pK!wL4mXbY9cF6tG1sD0jUaE5oI3w';
    process.env.SYSTEM_API_KEY = 'Zr7Z!q9Pk2Lm4Xv8Bn1';
    process.env.INTEGRATION_API_KEY = 'Wq3!Yt8Pn5Lk2Rm9Xb4';
    expect(() => loadAppConfig()).toThrow(/PII_DATA_ENCRYPTION_KEY/);
  });

  const setStrongSecrets = (): void => {
    process.env.JWT_SECRET = 'h8Q$2vNzR7pK!wL4mXbY9cF6tG1sD0jUaE5oI3w';
    process.env.SYSTEM_API_KEY = 'Zr7Z!q9Pk2Lm4Xv8Bn1';
    process.env.INTEGRATION_API_KEY = 'Wq3!Yt8Pn5Lk2Rm9Xb4';
    process.env.PII_DATA_ENCRYPTION_KEY = 'MDEyMzQ1Njc4OWFiY2RlZjAxMjM0NTY3ODlhYmNkZWY=';
  };

  it('rejects a wildcard CORS origin in production (SEC-7)', () => {
    process.env.NODE_ENV = 'production';
    setStrongSecrets();
    process.env.CORS_ORIGINS = 'https://app.example.com,*';
    expect(() => loadAppConfig()).toThrow(/CORS_ORIGINS/);
  });

  it('rejects an empty CORS allow-list in production', () => {
    process.env.NODE_ENV = 'production';
    setStrongSecrets();
    process.env.CORS_ORIGINS = '  ,  ';
    expect(() => loadAppConfig()).toThrow(/CORS_ORIGINS/);
  });

  it('accepts an explicit CORS allow-list in production', () => {
    process.env.NODE_ENV = 'production';
    setStrongSecrets();
    process.env.CORS_ORIGINS = 'https://app.example.com,https://admin.example.com';
    expect(() => loadAppConfig()).not.toThrow();
    expect(loadAppConfig().corsOrigins).toEqual([
      'https://app.example.com',
      'https://admin.example.com',
    ]);
  });

  it('allows a wildcard CORS origin in development (degrades, does not throw)', () => {
    process.env.NODE_ENV = 'development';
    process.env.CORS_ORIGINS = '*';
    expect(() => loadAppConfig()).not.toThrow();
  });

  it('defaults webAppUrl to the first CORS origin when WEB_APP_URL is unset (HCM-P0-3)', () => {
    process.env.CORS_ORIGINS = 'https://app.example.com,https://admin.example.com';
    expect(loadAppConfig().webAppUrl).toBe('https://app.example.com');
  });

  it('falls back to the first default CORS origin when neither WEB_APP_URL nor CORS_ORIGINS is set', () => {
    expect(loadAppConfig().webAppUrl).toBe('http://localhost:5173');
  });

  it('falls back to the hardcoded dev default when CORS_ORIGINS is explicitly empty', () => {
    process.env.CORS_ORIGINS = '  ,  ';
    expect(loadAppConfig().webAppUrl).toBe('http://localhost:4173');
  });

  it('prefers an explicit WEB_APP_URL over the CORS origin default', () => {
    process.env.WEB_APP_URL = 'https://hcm.example.com';
    process.env.CORS_ORIGINS = 'https://app.example.com';
    expect(loadAppConfig().webAppUrl).toBe('https://hcm.example.com');
  });
});
