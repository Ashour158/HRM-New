import { afterEach, describe, expect, it } from 'vitest';
import { resolveKeyFromEnv } from './aes-gcm.js';

describe('resolveKeyFromEnv', () => {
  const envVar = 'TEST_AES_GCM_KEY';
  const seed = 'development-test-seed-key-32byte';
  const originalValue = process.env[envVar];
  const originalNodeEnv = process.env.NODE_ENV;

  afterEach(() => {
    if (originalValue === undefined) {
      delete process.env[envVar];
    } else {
      process.env[envVar] = originalValue;
    }
    process.env.NODE_ENV = originalNodeEnv;
  });

  it('uses the deterministic fallback when NODE_ENV is development', () => {
    delete process.env[envVar];
    process.env.NODE_ENV = 'development';

    const key = resolveKeyFromEnv(envVar, seed);

    expect(key).toHaveLength(32);
    expect(key.toString()).toBe(seed.padEnd(32, '!').slice(0, 32));
  });

  it('uses the deterministic fallback when NODE_ENV is test', () => {
    delete process.env[envVar];
    process.env.NODE_ENV = 'test';

    expect(resolveKeyFromEnv(envVar, seed)).toHaveLength(32);
  });

  it('throws rather than falling back when NODE_ENV is production', () => {
    delete process.env[envVar];
    process.env.NODE_ENV = 'production';

    expect(() => resolveKeyFromEnv(envVar, seed)).toThrow(/TEST_AES_GCM_KEY/);
  });

  it('throws rather than falling back when NODE_ENV is staging', () => {
    delete process.env[envVar];
    process.env.NODE_ENV = 'staging';

    expect(() => resolveKeyFromEnv(envVar, seed)).toThrow(/TEST_AES_GCM_KEY/);
  });

  it('throws rather than falling back when NODE_ENV is unset', () => {
    delete process.env[envVar];
    delete process.env.NODE_ENV;

    expect(() => resolveKeyFromEnv(envVar, seed)).toThrow(/TEST_AES_GCM_KEY/);
  });

  it('throws rather than falling back when NODE_ENV is misspelled', () => {
    delete process.env[envVar];
    process.env.NODE_ENV = 'developmnet';

    expect(() => resolveKeyFromEnv(envVar, seed)).toThrow(/developmnet/);
  });

  it('uses the configured key when present, regardless of NODE_ENV', () => {
    process.env[envVar] = Buffer.from('a'.repeat(32)).toString('base64');
    process.env.NODE_ENV = 'production';

    expect(resolveKeyFromEnv(envVar, seed)).toHaveLength(32);
  });

  it('throws when the configured key is not a 32-byte value', () => {
    process.env[envVar] = Buffer.from('too-short').toString('base64');
    process.env.NODE_ENV = 'production';

    expect(() => resolveKeyFromEnv(envVar, seed)).toThrow(/32-byte/);
  });
});
