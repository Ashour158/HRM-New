import { Injectable } from '@nestjs/common';
import type { PayrollPaymentBatchRecord } from './payroll-artifact.service.js';

export type PayrollBankFileFormat = 'CSV' | 'CBE_EGYPT_CSV' | 'SEPA_XML' | 'NACHA';

export interface PayrollBankFile {
  fileName: string;
  contentType: string;
  content: string;
  rowCount: number;
}

function csvEscape(value: string | number | null | undefined): string {
  const text = value === null || value === undefined ? '' : String(value);
  if (/[",\n]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
  return text;
}

function toCsv(rows: Array<Record<string, string | number | null | undefined>>): string {
  const headers = Object.keys(rows[0] ?? {});
  return [headers.join(','), ...rows.map((row) => headers.map((header) => csvEscape(row[header])).join(','))].join('\n');
}

function xmlEscape(value: string | number | null | undefined): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

@Injectable()
export class PayrollBankFileService {
  render(batch: PayrollPaymentBatchRecord, format: PayrollBankFileFormat): PayrollBankFile {
    const rows = batch.payload.rows.filter((row) => row.bankReady);
    if (format === 'SEPA_XML') return this.renderSepa(batch, rows);
    if (format === 'NACHA') return this.renderNacha(batch, rows);
    if (format === 'CBE_EGYPT_CSV') return this.renderCbeEgypt(batch, rows);
    return this.renderCsv(batch, rows);
  }

  private renderCsv(batch: PayrollPaymentBatchRecord, rows: PayrollPaymentBatchRecord['payload']['rows']): PayrollBankFile {
    const content = toCsv(rows.map((row) => ({
      employeeId: row.employeeId,
      name: row.name,
      bankName: row.bankName,
      accountNumber: row.accountNumber,
      iban: row.iban,
      netSalary: row.netSalary ?? 0,
      currency: row.currency,
    })));
    return {
      fileName: `${batch.batchNumber}.csv`,
      contentType: 'text/csv; charset=utf-8',
      content,
      rowCount: rows.length,
    };
  }

  private renderCbeEgypt(batch: PayrollPaymentBatchRecord, rows: PayrollPaymentBatchRecord['payload']['rows']): PayrollBankFile {
    const content = toCsv(rows.map((row) => ({
      employerCode: 'HCM',
      paymentDate: batch.payDate,
      employeeId: row.employeeId,
      beneficiaryName: row.accountHolderName || row.name,
      bankCode: row.routingNumber || row.swiftCode || row.bankName,
      accountNumber: row.accountNumber || row.iban,
      amount: row.netSalary ?? 0,
      currency: row.currency,
    })));
    return {
      fileName: `${batch.batchNumber}-cbe-egypt.csv`,
      contentType: 'text/csv; charset=utf-8',
      content,
      rowCount: rows.length,
    };
  }

  private renderSepa(batch: PayrollPaymentBatchRecord, rows: PayrollPaymentBatchRecord['payload']['rows']): PayrollBankFile {
    const transactions = rows.map((row) => `
      <CdtTrfTxInf>
        <PmtId><EndToEndId>${xmlEscape(row.employeeId)}</EndToEndId></PmtId>
        <Amt><InstdAmt Ccy="${xmlEscape(row.currency)}">${Number(row.netSalary ?? 0).toFixed(2)}</InstdAmt></Amt>
        <CdtrAgt><FinInstnId><BIC>${xmlEscape(row.swiftCode || row.routingNumber)}</BIC></FinInstnId></CdtrAgt>
        <Cdtr><Nm>${xmlEscape(row.accountHolderName || row.name)}</Nm></Cdtr>
        <CdtrAcct><Id><IBAN>${xmlEscape(row.iban || row.accountNumber)}</IBAN></Id></CdtrAcct>
      </CdtTrfTxInf>`).join('');
    return {
      fileName: `${batch.batchNumber}.xml`,
      contentType: 'application/xml; charset=utf-8',
      content: `<Document><CstmrCdtTrfInitn><GrpHdr><MsgId>${xmlEscape(batch.batchNumber)}</MsgId><NbOfTxs>${rows.length}</NbOfTxs></GrpHdr><PmtInf>${transactions}</PmtInf></CstmrCdtTrfInitn></Document>`,
      rowCount: rows.length,
    };
  }

  private renderNacha(batch: PayrollPaymentBatchRecord, rows: PayrollPaymentBatchRecord['payload']['rows']): PayrollBankFile {
    const header = `101 HCM PAYROLL ${batch.payDate.replace(/-/g, '')}`;
    const details = rows.map((row) => `627${String(row.routingNumber || '').padEnd(9, '0')}${String(row.accountNumber || row.iban || '').padEnd(17)}${Math.round(Number(row.netSalary ?? 0) * 100).toString().padStart(10, '0')}${row.employeeId}`).join('\n');
    return {
      fileName: `${batch.batchNumber}.ach`,
      contentType: 'text/plain; charset=utf-8',
      content: `${header}\n${details}\n900${rows.length.toString().padStart(6, '0')}`,
      rowCount: rows.length,
    };
  }
}
