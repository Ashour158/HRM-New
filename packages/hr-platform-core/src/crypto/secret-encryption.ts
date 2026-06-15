import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

const VERSION = 'v1';
const NON_PRODUCTION_FALLBACK_KEY = Buffer.from('development-sso-secret-key-32b!!').subarray(0, 32);

export function encryptSecret(plaintext: string): string {
  const key = encryptionKey();
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return [
    VERSION,
    iv.toString('base64url'),
    authTag.toString('base64url'),
    ciphertext.toString('base64url'),
  ].join('.');
}

export function decryptSecret(encrypted: string): string {
  const [version, ivRaw, authTagRaw, ciphertextRaw] = encrypted.split('.');
  if (version !== VERSION || !ivRaw || !authTagRaw || !ciphertextRaw) {
    throw new Error('Invalid encrypted secret format');
  }
  const decipher = createDecipheriv('aes-256-gcm', encryptionKey(), Buffer.from(ivRaw, 'base64url'));
  decipher.setAuthTag(Buffer.from(authTagRaw, 'base64url'));
  const plaintext = Buffer.concat([
    decipher.update(Buffer.from(ciphertextRaw, 'base64url')),
    decipher.final(),
  ]);
  return plaintext.toString('utf8');
}

function encryptionKey(): Buffer {
  const configured = process.env.SSO_SECRET_ENCRYPTION_KEY;
  if (!configured) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('SSO_SECRET_ENCRYPTION_KEY must be configured in production');
    }
    return NON_PRODUCTION_FALLBACK_KEY;
  }
  const key = Buffer.from(configured, 'base64');
  if (key.length !== 32) {
    throw new Error('SSO_SECRET_ENCRYPTION_KEY must be a base64-encoded 32-byte key');
  }
  return key;
}
