import { decryptWithKey, encryptWithKey, resolveKeyFromEnv } from './aes-gcm.js';

export function encryptSecret(plaintext: string): string {
  return encryptWithKey(plaintext, encryptionKey());
}

export function decryptSecret(encrypted: string): string {
  return decryptWithKey(encrypted, encryptionKey());
}

function encryptionKey(): Buffer {
  return resolveKeyFromEnv('SSO_SECRET_ENCRYPTION_KEY', 'development-sso-secret-key-32b!!');
}
