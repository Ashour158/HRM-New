import { afterEach, describe, expect, it } from 'vitest';
import {
  decryptPiiField,
  decryptPiiObject,
  decryptPiiPayload,
  encryptPiiField,
  encryptPiiObject,
  encryptPiiPayload,
} from './pii-encryption.js';

const key = Buffer.from('fedcba9876543210fedcba9876543210').toString('base64');

describe('PII payload encryption', () => {
  const originalKey = process.env.PII_DATA_ENCRYPTION_KEY;
  const originalNodeEnv = process.env.NODE_ENV;

  afterEach(() => {
    if (originalKey === undefined) {
      delete process.env.PII_DATA_ENCRYPTION_KEY;
    } else {
      process.env.PII_DATA_ENCRYPTION_KEY = originalKey;
    }
    process.env.NODE_ENV = originalNodeEnv;
  });

  it('round-trips a payload without exposing plaintext in the ciphertext', () => {
    process.env.PII_DATA_ENCRYPTION_KEY = key;
    const payload = { ssn: '123-45-6789', condition: 'confidential-medical' };

    const ref = encryptPiiPayload(payload);

    expect(ref).not.toContain('123-45-6789');
    expect(ref).not.toContain('confidential-medical');
    expect(decryptPiiPayload(ref)).toEqual(payload);
  });

  it('produces a distinct ciphertext per call (random IV)', () => {
    process.env.PII_DATA_ENCRYPTION_KEY = key;
    const payload = { ssn: '123-45-6789' };

    expect(encryptPiiPayload(payload)).not.toBe(encryptPiiPayload(payload));
  });

  it('fails to decrypt a tampered token', () => {
    process.env.PII_DATA_ENCRYPTION_KEY = key;
    const ref = encryptPiiPayload({ ssn: '123-45-6789' });
    const tampered = `${ref.slice(0, -2)}xx`;

    expect(() => decryptPiiPayload(tampered)).toThrow();
  });

  it('fails fast in production when the key is missing', () => {
    process.env.NODE_ENV = 'production';
    delete process.env.PII_DATA_ENCRYPTION_KEY;

    expect(() => encryptPiiPayload({ ssn: '1' })).toThrow(/PII_DATA_ENCRYPTION_KEY/);
  });

  it('round-trips a single special-category field without exposing plaintext', () => {
    process.env.PII_DATA_ENCRYPTION_KEY = key;
    const notes = 'patient reports acute anxiety';

    const stored = encryptPiiField(notes);

    expect(stored).not.toContain('anxiety');
    expect(stored.startsWith('encpii:')).toBe(true);
    expect(decryptPiiField(stored)).toBe(notes);
  });

  it('returns legacy plaintext field values unchanged (backward compatibility)', () => {
    process.env.PII_DATA_ENCRYPTION_KEY = key;

    expect(decryptPiiField('legacy plaintext note')).toBe('legacy plaintext note');
  });

  it('does not mistake plaintext shaped like an encryption envelope for ciphertext', () => {
    process.env.PII_DATA_ENCRYPTION_KEY = key;
    // Legacy free-text that happens to look like the underlying token format.
    const lookalike = 'v1.2mg dosage.taper.review next visit';

    expect(decryptPiiField(lookalike)).toBe(lookalike);
  });

  it('recursively encrypts every string leaf while preserving object/array structure', () => {
    process.env.PII_DATA_ENCRYPTION_KEY = key;
    const payload = {
      bankAccount: { bankName: 'First Bank', iban: 'GB29NWBK60161331926819', routingNumber: '021000021' },
      salaryAmount: 125000,
      active: true,
      notes: null,
      taxIdentifiers: ['EIN-1234567', 'SIN-987654321'],
    };

    const encrypted = encryptPiiObject(payload);

    expect(encrypted.bankAccount).toEqual({
      bankName: expect.stringMatching(/^encpii:/),
      iban: expect.stringMatching(/^encpii:/),
      routingNumber: expect.stringMatching(/^encpii:/),
    });
    expect(JSON.stringify(encrypted)).not.toContain('GB29NWBK60161331926819');
    expect(JSON.stringify(encrypted)).not.toContain('First Bank');
    // Non-string leaves pass through untouched.
    expect(encrypted.salaryAmount).toBe(125000);
    expect(encrypted.active).toBe(true);
    expect(encrypted.notes).toBeNull();
    expect(encrypted.taxIdentifiers).toEqual([
      expect.stringMatching(/^encpii:/),
      expect.stringMatching(/^encpii:/),
    ]);

    expect(decryptPiiObject(encrypted)).toEqual(payload);
  });

  it('decryptPiiObject is safe against a payload that is only partially encrypted', () => {
    process.env.PII_DATA_ENCRYPTION_KEY = key;
    const payload = {
      bankAccount: { iban: encryptPiiField('GB29NWBK60161331926819'), bankName: 'Legacy Plaintext Bank' },
    };

    expect(decryptPiiObject(payload)).toEqual({
      bankAccount: { iban: 'GB29NWBK60161331926819', bankName: 'Legacy Plaintext Bank' },
    });
  });
});
