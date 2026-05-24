/**
 * Cryptographic hash utilities for the HR/HCM platform.
 */

import { createHash, randomUUID } from 'crypto';
import { Uuid } from '@hcm/shared-kernel';

/**
 * Computes a SHA-256 hash of the given data.
 * @param data - The string or Buffer to hash.
 * @returns The hexadecimal digest.
 */
export function computeSha256(data: string | Buffer): string {
  return createHash('sha256').update(data).digest('hex');
}

/**
 * Computes a deterministic SHA-256 hash of a JSON-serialized payload.
 * Keys are sorted to ensure consistency across equivalent objects.
 * @param payload - The payload to hash.
 * @returns The hexadecimal digest.
 */
export function computeRequestHash(payload: unknown): string {
  const normalized = JSON.stringify(payload, Object.keys(payload as object).sort());
  return computeSha256(normalized);
}

/**
 * Generates a new random correlation ID.
 * @returns A new UUID.
 */
export function generateCorrelationId(): Uuid {
  return new Uuid(randomUUID());
}

/**
 * Generates a new random causation ID.
 * @returns A new UUID.
 */
export function generateCausationId(): Uuid {
  return new Uuid(randomUUID());
}
