import { describe, expect, it } from 'vitest';
import { PayrollBankFileService } from './payroll-bank-file.service.js';
import type { PayrollPaymentBatchRecord } from './payroll-artifact.service.js';

const batch: PayrollPaymentBatchRecord = {
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
  payload: {
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
  },
  createdAt: new Date('2026-05-31T12:00:00.000Z'),
  updatedAt: new Date('2026-05-31T12:00:00.000Z'),
};

describe('PayrollBankFileService', () => {
  const service = new PayrollBankFileService();

  it('renders bank-ready payment rows in governed formats', () => {
    const csv = service.render(batch, 'CSV');
    expect(csv.content).toContain('employeeId,name,bankName,accountNumber,iban,netSalary,currency');
    expect(csv.content).toContain('EMP-001,Mona Hassan,CIB,123456789,EG380019000500000000263180002,8400,EGP');
    expect(csv.fileName).toBe('PAYMENT-2026-05.csv');

    const cbe = service.render(batch, 'CBE_EGYPT_CSV');
    expect(cbe.content).toContain('employerCode,paymentDate,employeeId,beneficiaryName,bankCode,accountNumber,amount,currency');
    expect(cbe.content).toContain('HCM,2026-05-31,EMP-001,Mona Hassan,CIBEEGCX,123456789,8400,EGP');

    const sepa = service.render(batch, 'SEPA_XML');
    expect(sepa.content).toContain('<Document>');
    expect(sepa.content).toContain('<EndToEndId>EMP-001</EndToEndId>');
    expect(sepa.content).toContain('<InstdAmt Ccy="EGP">8400.00</InstdAmt>');
  });
});
