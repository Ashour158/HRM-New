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

/**
 * Marker prefix on application-encrypted field values. Using an explicit,
 * non-collidable marker (rather than inferring the envelope shape) means legacy
 * plaintext that happens to look like a token — e.g. a clinical note literally
 * starting with `v1.a.b.c` — is never mistaken for ciphertext.
 */
const PII_FIELD_PREFIX = 'encpii:';

/**
 * Encrypt a single SPECIAL_CATEGORY free-text field (e.g. clinical notes,
 * case reason) for storage at rest under the PII key. Use the matching
 * {@link decryptPiiField} on read.
 */
export function encryptPiiField(value: string): string {
  return PII_FIELD_PREFIX + encryptWithKey(value, piiKey());
}

/**
 * Decrypt a value produced by {@link encryptPiiField}. To remain backward
 * compatible with rows written before field encryption existed, values without
 * the {@link PII_FIELD_PREFIX} marker are returned unchanged (legacy plaintext).
 */
export function decryptPiiField(stored: string): string {
  if (!stored.startsWith(PII_FIELD_PREFIX)) {
    return stored;
  }
  return decryptWithKey(stored.slice(PII_FIELD_PREFIX.length), piiKey());
}

function piiKey(): Buffer {
  return resolveKeyFromEnv('PII_DATA_ENCRYPTION_KEY', 'development-pii-data-key-32bytes!');
}

function deepTransformStrings(value: unknown, transform: (input: string) => string): unknown {
  if (typeof value === 'string') return transform(value);
  if (Array.isArray(value)) return value.map((item) => deepTransformStrings(item, transform));
  if (value !== null && typeof value === 'object') {
    const result: Record<string, unknown> = {};
    for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
      result[key] = deepTransformStrings(child, transform);
    }
    return result;
  }
  return value;
}

/**
 * Recursively encrypt every string leaf of a payload (e.g. `bankAccount.iban`),
 * preserving object/array structure and non-string leaves (numbers, booleans,
 * null) as-is. Unlike {@link encryptPiiPayload}, the payload stays queryable
 * by key/shape -- only leaf values become ciphertext. Use for categories whose
 * payload must remain a structured JSON document (BANKING, TAX, COMPENSATION),
 * not an opaque blob.
 */
export function encryptPiiObject<T extends Record<string, unknown>>(payload: T): T {
  return deepTransformStrings(payload, encryptPiiField) as T;
}

/**
 * Inverse of {@link encryptPiiObject}. Safe to call on payloads that are only
 * partially encrypted or not encrypted at all -- {@link decryptPiiField}
 * passes through any string without the `encpii:` marker unchanged.
 */
export function decryptPiiObject<T extends Record<string, unknown>>(payload: T): T {
  return deepTransformStrings(payload, decryptPiiField) as T;
}
