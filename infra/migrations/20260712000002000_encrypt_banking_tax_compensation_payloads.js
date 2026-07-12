const crypto = require('crypto');

/**
 * One-time backfill: encrypt already-stored plaintext BANKING/TAX/COMPENSATION
 * `personal_data_records.payload` rows at rest.
 *
 * This is a self-contained copy of the AES-256-GCM envelope logic in
 * packages/hr-platform-core/src/crypto/aes-gcm.ts and pii-encryption.ts
 * (encryptPiiObject/decryptPiiObject), duplicated deliberately rather than
 * imported: migrations must stay deterministic forever, independent of future
 * refactors to application code, and hr-database (which runs migrations)
 * cannot depend on hr-platform-core without a circular package dependency
 * (hr-platform-core already depends on hr-database).
 *
 * Runs across all tenants uniformly -- PII_DATA_ENCRYPTION_KEY is a single
 * shared application-wide key, not per-tenant, so there is no tenant-scoped
 * branching here. Idempotent: already-encrypted string leaves (the `encpii:`
 * marker prefix) are left untouched, so re-running this migration is safe.
 */

const AES_VERSION = 'v1';
const PII_FIELD_PREFIX = 'encpii:';
const ENCRYPTED_CATEGORIES = ['BANKING', 'TAX', 'COMPENSATION'];

function resolveKey() {
  const configured = process.env.PII_DATA_ENCRYPTION_KEY;
  if (!configured) {
    const env = process.env.NODE_ENV;
    if (env === 'production' || env === 'staging') {
      throw new Error(`PII_DATA_ENCRYPTION_KEY must be configured in ${env}`);
    }
    return Buffer.from('development-pii-data-key-32bytes!'.padEnd(32, '!')).subarray(0, 32);
  }
  const key = Buffer.from(configured, 'base64');
  if (key.length !== 32) {
    throw new Error('PII_DATA_ENCRYPTION_KEY must be a base64-encoded 32-byte key');
  }
  return key;
}

function encryptWithKey(plaintext, key) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return [AES_VERSION, iv.toString('base64url'), authTag.toString('base64url'), ciphertext.toString('base64url')].join('.');
}

function decryptWithKey(encrypted, key) {
  const [version, ivRaw, authTagRaw, ciphertextRaw] = encrypted.split('.');
  if (version !== AES_VERSION || !ivRaw || !authTagRaw || !ciphertextRaw) {
    throw new Error('Invalid encrypted value format');
  }
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, Buffer.from(ivRaw, 'base64url'));
  decipher.setAuthTag(Buffer.from(authTagRaw, 'base64url'));
  const plaintext = Buffer.concat([decipher.update(Buffer.from(ciphertextRaw, 'base64url')), decipher.final()]);
  return plaintext.toString('utf8');
}

function encryptField(value, key) {
  if (typeof value !== 'string' || value.startsWith(PII_FIELD_PREFIX)) return value;
  return PII_FIELD_PREFIX + encryptWithKey(value, key);
}

function decryptField(value, key) {
  if (typeof value !== 'string' || !value.startsWith(PII_FIELD_PREFIX)) return value;
  return decryptWithKey(value.slice(PII_FIELD_PREFIX.length), key);
}

function deepTransform(value, key, transformField) {
  if (typeof value === 'string') return transformField(value, key);
  if (Array.isArray(value)) return value.map((item) => deepTransform(item, key, transformField));
  if (value !== null && typeof value === 'object') {
    const result = {};
    for (const [k, v] of Object.entries(value)) result[k] = deepTransform(v, key, transformField);
    return result;
  }
  return value;
}

async function transformRows(pgm, key, transformField) {
  const { rows } = await pgm.db.query(
    `SELECT id, payload FROM "hr_platform"."personal_data_records"
     WHERE data_category = ANY($1) AND payload IS NOT NULL`,
    [ENCRYPTED_CATEGORIES],
  );

  for (const row of rows) {
    const transformed = deepTransform(row.payload, key, transformField);
    await pgm.db.query(
      `UPDATE "hr_platform"."personal_data_records" SET payload = $1 WHERE id = $2`,
      [JSON.stringify(transformed), row.id],
    );
  }

  return rows.length;
}

exports.up = async (pgm) => {
  const key = resolveKey();
  const count = await transformRows(pgm, key, encryptField);
  pgm.sql(`-- Encrypted payload leaves for ${count} BANKING/TAX/COMPENSATION personal_data_records rows.`);
};

exports.down = async (pgm) => {
  const key = resolveKey();
  const count = await transformRows(pgm, key, decryptField);
  pgm.sql(`-- Decrypted payload leaves for ${count} BANKING/TAX/COMPENSATION personal_data_records rows.`);
};
