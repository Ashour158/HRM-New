import { afterEach, describe, expect, it } from 'vitest';
import { PayrollPaymentBatchRepository } from './payroll-payment-batch.repository.js';
import type { PayrollPaymentBatchRecord } from '../services/payroll-artifact.service.js';
import type { PayrollPaymentBatch } from '../services/payroll-input-orchestration.service.js';

const key = Buffer.from('fedcba9876543210fedcba9876543210').toString('base64');

const payload: PayrollPaymentBatch = {
  batchId: 'PAYMENT-2026-05',
  payrollCycleId: 'cycle-1',
  periodStart: '2026-05-01',
  periodEnd: '2026-05-31',
  payDate: '2026-05-31',
  ready: true,
  readyCount: 1,
  blockedCount: 0,
  totalNet: 8400,
  currency: 'EGP',
  rows: [{
    employeeId: 'EMP-001',
    workerId: 'worker-1',
    name: 'Mona Hassan',
    workEmail: 'mona@example.com',
    bankName: 'CIB',
    accountHolderName: 'Mona Hassan',
    accountNumber: '123456789',
    iban: 'EG380019000500000000263180002',
    routingNumber: 'CIBEEGCX',
    swiftCode: 'CIBEEGCX',
    netSalary: 8400,
    currency: 'EGP',
    bankReady: true,
    readinessReason: 'READY',
  }],
};

const record: PayrollPaymentBatchRecord = {
  id: 'batch-1',
  tenantId: 'tenant-1',
  payrollCycleId: 'cycle-1',
  batchNumber: 'PAYMENT-2026-05',
  status: 'APPROVED',
  periodStart: '2026-05-01',
  periodEnd: '2026-05-31',
  payDate: '2026-05-31',
  currency: 'EGP',
  readyCount: 1,
  blockedCount: 0,
  totalNet: 8400,
  fileHash: 'hash',
  payload,
  createdAt: new Date('2026-05-31T12:00:00.000Z'),
  updatedAt: new Date('2026-05-31T12:00:00.000Z'),
};

describe('PayrollPaymentBatchRepository bank-field encryption at rest', () => {
  const originalKey = process.env.PII_DATA_ENCRYPTION_KEY;
  const repo = Object.create(PayrollPaymentBatchRepository.prototype) as {
    toRow(entity: PayrollPaymentBatchRecord): { payload: string };
    toRecord(row: Record<string, unknown>): PayrollPaymentBatchRecord;
  };

  afterEach(() => {
    if (originalKey === undefined) {
      delete process.env.PII_DATA_ENCRYPTION_KEY;
    } else {
      process.env.PII_DATA_ENCRYPTION_KEY = originalKey;
    }
  });

  it('encrypts accountNumber/iban/routingNumber/swiftCode before writing the jsonb payload', () => {
    process.env.PII_DATA_ENCRYPTION_KEY = key;

    const row = repo.toRow(record);
    const storedPayload = JSON.parse(row.payload) as PayrollPaymentBatch;
    const storedRow = storedPayload.rows[0];

    // The raw DB row must never contain the plaintext bank credentials.
    expect(row.payload).not.toContain('123456789');
    expect(row.payload).not.toContain('EG380019000500000000263180002');
    expect(row.payload).not.toContain('CIBEEGCX');

    expect(storedRow.accountNumber).not.toBe('123456789');
    expect(storedRow.accountNumber.startsWith('encpii:')).toBe(true);
    expect(storedRow.iban.startsWith('encpii:')).toBe(true);
    expect(storedRow.routingNumber.startsWith('encpii:')).toBe(true);
    expect(storedRow.swiftCode.startsWith('encpii:')).toBe(true);

    // Non-bank-credential fields on the same row stay in plaintext.
    expect(storedRow.name).toBe('Mona Hassan');
    expect(storedRow.bankName).toBe('CIB');
    expect(storedRow.accountHolderName).toBe('Mona Hassan');
    expect(storedRow.netSalary).toBe(8400);
  });

  it('decrypts back to the original plaintext bank details on read (the path payroll-bank-file.service.ts relies on)', () => {
    process.env.PII_DATA_ENCRYPTION_KEY = key;

    // Simulate the real round trip: toRow() produces the DB row (snake_case
    // columns, encrypted payload string); node-postgres parses the jsonb
    // column back into an object before toRecord() ever sees it.
    const row = repo.toRow(record);
    const dbRow = { ...row, payload: JSON.parse(row.payload) };
    const rehydrated = repo.toRecord(dbRow as unknown as Record<string, unknown>);

    expect(rehydrated.payload.rows[0]).toEqual(payload.rows[0]);
  });

  it('is tolerant of legacy plaintext rows written before this fix', () => {
    process.env.PII_DATA_ENCRYPTION_KEY = key;

    // A row persisted before this fix shipped: same DB shape, but payload
    // still holds the original unencrypted bank details.
    const row = repo.toRow(record);
    const legacyRow = { ...row, payload };
    const rehydrated = repo.toRecord(legacyRow as unknown as Record<string, unknown>);

    expect(rehydrated.payload.rows[0]).toEqual(payload.rows[0]);
  });
});
