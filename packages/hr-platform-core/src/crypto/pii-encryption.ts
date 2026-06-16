import { decryptWithKey, encryptWithKey, resolveKeyFromEnv } from './aes-gcm.js';

/**
 * Encryption-at-rest for personal data (PII) payloads.
 *
 * SPECIAL_CATEGORY personal data records never store a raw `payload`; instead
 * the JSON payload is serialized and encrypted into an opaque `encryptedPayloadRef`
 * token using AES-256-GCM under a dedicated key (`PII_DATA_ENCRYPTION_KEY`),
 * separate from the SSO secret key so the two can be rotated independently.
 */
export function encryptPiiPayload(payload: Record<string, unknown>): string {
  return encryptWithKey(JSON.stringify(payload), piiKey());
}

export function decryptPiiPayload(encryptedPayloadRef: string): Record<string, unknown> {
  const json = decryptWithKey(encryptedPayloadRef, piiKey());
  return JSON.parse(json) as Record<string, unknown>;
}

function piiKey(): Buffer {
  return resolveKeyFromEnv('PII_DATA_ENCRYPTION_KEY', 'development-pii-data-key-32bytes!');
}
