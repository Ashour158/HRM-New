import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

const VERSION = 'v1';

/**
 * Envelope-style AES-256-GCM encryption shared by the secret and PII
 * encryption services. The output is a dotted token:
 *
 *   `v1.<iv>.<authTag>.<ciphertext>`  (each segment base64url-encoded)
 *
 * The 96-bit IV is randomly generated per call and the GCM auth tag is
 * verified on decrypt, so tampering or key mismatch fails closed.
 */
export function encryptWithKey(plaintext: string, key: Buffer): string {
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

export function decryptWithKey(encrypted: string, key: Buffer): string {
  const [version, ivRaw, authTagRaw, ciphertextRaw] = encrypted.split('.');
  if (version !== VERSION || !ivRaw || !authTagRaw || !ciphertextRaw) {
    throw new Error('Invalid encrypted value format');
  }
  const decipher = createDecipheriv('aes-256-gcm', key, Buffer.from(ivRaw, 'base64url'));
  decipher.setAuthTag(Buffer.from(authTagRaw, 'base64url'));
  const plaintext = Buffer.concat([
    decipher.update(Buffer.from(ciphertextRaw, 'base64url')),
    decipher.final(),
  ]);
  return plaintext.toString('utf8');
}

/**
 * Resolve a 32-byte AES key from a base64-encoded environment variable.
 *
 * The deterministic fallback is only ever safe to use when NODE_ENV is
 * explicitly 'development' or 'test'. Any other value -- including an
 * absent or misspelled NODE_ENV -- must throw rather than silently
 * encrypt real data with a public, seed-derived key.
 */
export function resolveKeyFromEnv(envVar: string, nonProductionSeed: string): Buffer {
  const configured = process.env[envVar];
  if (!configured) {
    const env = process.env.NODE_ENV;
    if (env === 'development' || env === 'test') {
      return Buffer.from(nonProductionSeed.padEnd(32, '!')).subarray(0, 32);
    }
    throw new Error(
      `${envVar} must be configured unless NODE_ENV is 'development' or 'test' (got ${JSON.stringify(env)})`,
    );
  }
  const key = Buffer.from(configured, 'base64');
  if (key.length !== 32) {
    throw new Error(`${envVar} must be a base64-encoded 32-byte key`);
  }
  return key;
}
