const crypto = require('crypto');

/**
 * One-time backfill: encrypt already-stored plaintext bank routing details in
 * `hr_payroll.payroll_payment_batches.payload.rows[]` (accountNumber, iban,
 * routingNumber, swiftCode). That payload denormalizes the real bank-transfer
 * details captured at payroll-close time so `PayrollBankFileService` can
 * render NACHA/SEPA/CSV bank files without a further DB round-trip -- those
 * four fields are the actual credentials a bank needs and sat unencrypted at
 * rest. Every other field on `payload` and on `payload.rows[]` (employeeId,
 * name, bankName, accountHolderName, netSalary, currency, ...) is left
 * untouched, matching the narrow, per-field (not whole-object) encryption
 * applied by PayrollPaymentBatchRepository.
 *
 * This is a self-contained copy of the AES-256-GCM envelope logic in
 * packages/hr-platform-core/src/crypto/aes-gcm.ts and pii-encryption.ts
 * (encryptPiiField/decryptPiiField), duplicated deliberately rather than
 * imported: migrations must stay deterministic forever, independent of future
 * refactors to application code, and hr-database (which runs migrations)
 * cannot depend on hr-platform-core without a circular package dependency
 * (hr-platform-core already depends on hr-database). Mirrors the pattern
 * established by 20260712000002000_encrypt_banking_tax_compensation_payloads.js
 * for personal_data_records.
 *
 * Runs across all tenants uniformly -- PII_DATA_ENCRYPTION_KEY is a single
 * shared application-wide key, not per-tenant. Idempotent: already-encrypted
 * string values (the `encpii:` marker prefix) are left untouched, so
 * re-running this migration is safe.
 */

const AES_VERSION = 'v1';
const PII_FIELD_PREFIX = 'encpii:';
const BANK_ROUTING_FIELDS = ['accountNumber', 'iban', 'routingNumber', 'swiftCode'];

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
  if (typeof value !== 'string' || value === '' || value.startsWith(PII_FIELD_PREFIX)) return value;
  return PII_FIELD_PREFIX + encryptWithKey(value, key);
}

function decryptField(value, key) {
  if (typeof value !== 'string' || !value.startsWith(PII_FIELD_PREFIX)) return value;
  return decryptWithKey(value.slice(PII_FIELD_PREFIX.length), key);
}

function transformPayload(payload, key, transformField) {
  if (!payload || !Array.isArray(payload.rows)) return payload;
  return {
    ...payload,
    rows: payload.rows.map((row) => {
      const next = { ...row };
      for (const field of BANK_ROUTING_FIELDS) {
        if (field in next) next[field] = transformField(next[field], key);
      }
      return next;
    }),
  };
}

async function transformRows(pgm, key, transformField) {
  const { rows } = await pgm.db.query(
    `SELECT id, payload FROM "hr_payroll"."payroll_payment_batches" WHERE payload IS NOT NULL`,
  );

  for (const row of rows) {
    const transformed = transformPayload(row.payload, key, transformField);
    await pgm.db.query(
      `UPDATE "hr_payroll"."payroll_payment_batches" SET payload = $1 WHERE id = $2`,
      [JSON.stringify(transformed), row.id],
    );
  }

  return rows.length;
}

exports.up = async (pgm) => {
  const key = resolveKey();
  const count = await transformRows(pgm, key, encryptField);
  pgm.sql(`-- Encrypted bank routing fields for ${count} payroll_payment_batches rows.`);
};

exports.down = async (pgm) => {
  const key = resolveKey();
  const count = await transformRows(pgm, key, decryptField);
  pgm.sql(`-- Decrypted bank routing fields for ${count} payroll_payment_batches rows.`);
};
