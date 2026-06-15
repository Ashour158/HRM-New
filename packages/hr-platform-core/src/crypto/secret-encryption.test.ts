import { afterEach, describe, expect, it } from 'vitest';
import { decryptSecret, encryptSecret } from './secret-encryption.js';

const key = Buffer.from('0123456789abcdef0123456789abcdef').toString('base64');

describe('SSO secret encryption', () => {
  const originalKey = process.env.SSO_SECRET_ENCRYPTION_KEY;
  const originalNodeEnv = process.env.NODE_ENV;

  afterEach(() => {
    if (originalKey === undefined) {
      delete process.env.SSO_SECRET_ENCRYPTION_KEY;
    } else {
      process.env.SSO_SECRET_ENCRYPTION_KEY = originalKey;
    }
    process.env.NODE_ENV = originalNodeEnv;
  });

  it('encrypts and decrypts secrets without exposing plaintext in the ciphertext', () => {
    process.env.SSO_SECRET_ENCRYPTION_KEY = key;

    const encrypted = encryptSecret('super-secret-client-value');

    expect(encrypted).not.toContain('super-secret-client-value');
    expect(decryptSecret(encrypted)).toBe('super-secret-client-value');
  });

  it('fails fast in production when the encryption key is missing', () => {
    process.env.NODE_ENV = 'production';
    delete process.env.SSO_SECRET_ENCRYPTION_KEY;

    expect(() => encryptSecret('secret')).toThrow(/SSO_SECRET_ENCRYPTION_KEY/);
  });
});
