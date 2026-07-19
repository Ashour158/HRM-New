import { createHash } from 'node:crypto';

/**
 * Deterministic UUID v5 generator (RFC 4122 section 4.3: `SHA1(namespace || name)`
 * with the version/variant bits patched in), implemented locally with Node's
 * built-in `crypto` module rather than adding the `uuid` package as a new
 * dependency (not currently installed for `hr-api`).
 *
 * Used to derive stable, retry-safe aggregate ids from business-stable inputs
 * (e.g. a worker id) so a saga step that dispatches the same logical command
 * twice - because the first attempt's command succeeded but the saga
 * crashed/retried before recording that step as complete - produces the exact
 * same id both times instead of creating a duplicate aggregate.
 */
export function uuidV5(name: string, namespace: string): string {
  const namespaceBytes = parseUuid(namespace);
  const nameBytes = Buffer.from(name, 'utf8');
  const hash = createHash('sha1').update(Buffer.concat([namespaceBytes, nameBytes])).digest();
  const bytes = Buffer.from(hash.subarray(0, 16));
  bytes[6] = (bytes[6]! & 0x0f) | 0x50; // version 5
  bytes[8] = (bytes[8]! & 0x3f) | 0x80; // RFC 4122 variant
  return formatUuid(bytes);
}

function parseUuid(uuid: string): Buffer {
  const hex = uuid.replace(/-/g, '');
  return Buffer.from(hex, 'hex');
}

function formatUuid(bytes: Buffer): string {
  const hex = bytes.toString('hex');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
}
