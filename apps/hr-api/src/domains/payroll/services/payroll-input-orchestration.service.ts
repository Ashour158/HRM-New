import { Injectable } from '@nestjs/common';
import type {
  PayrollBankTransferRow,
  PayrollCyclePreview,
  PayrollCycleRow,
  PayrollPayslip,
} from './payroll-cycle-calculation.service.js';

export interface PayrollInputDraft {
  workerId: string;
  payrollCycleId: string;
  inputType: string;
  amount: number;
  currency: string;
  description: string;
}

export interface PayrollPaymentBatch {
  batchId: string;
  payrollCycleId: string;
  periodStart: string;
  periodEnd: string;
  payDate: string;
  ready: boolean;
  readyCount: number;
  blockedCount: number;
  totalNet: number;
  currency: string;
  rows: PayrollBankTransferRow[];
}

function round(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function escapeHtml(value: string | number | null | undefined): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function pushMoneyDraft(
  drafts: PayrollInputDraft[],
  row: PayrollCycleRow,
  payrollCycleId: string,
  inputType: string,
  amount: number | null | undefined,
  label: string,
): void {
  if (amount === null || amount === undefined || amount <= 0) return;
  drafts.push({
    workerId: row.workerId,
    payrollCycleId,
    inputType,
    amount: round(amount),
    currency: row.currency,
    description: `${row.employeeId} ${row.name} ${label}`,
  });
}

function pushHourDraft(
  drafts: PayrollInputDraft[],
  row: PayrollCycleRow,
  payrollCycleId: string,
  inputType: string,
  minutes: number | null | undefined,
  label: string,
): void {
  if (minutes === null || minutes === undefined || minutes <= 0) return;
  drafts.push({
    workerId: row.workerId,
    payrollCycleId,
    inputType,
    amount: round(minutes / 60),
    currency: row.currency,
    description: `${row.employeeId} ${row.name} ${label}`,
  });
}

@Injectable()
export class PayrollInputOrchestrationService {
  buildInputDrafts(row: PayrollCycleRow, ids: { payrollCycleId: string }): PayrollInputDraft[] {
    const drafts: PayrollInputDraft[] = [];

    pushMoneyDraft(drafts, row, ids.payrollCycleId, 'BASE_GROSS_PAY', row.baseGrossSalary, 'base gross pay');
    pushMoneyDraft(drafts, row, ids.payrollCycleId, 'EARNING_TOTAL', row.earningAmount, 'earning total');
    pushMoneyDraft(drafts, row, ids.payrollCycleId, 'TAXABLE_EARNINGS', row.taxableEarningAmount, 'taxable earnings');
    pushMoneyDraft(drafts, row, ids.payrollCycleId, 'NON_TAXABLE_EARNINGS', row.nonTaxableEarningAmount, 'non-taxable earnings');
    pushMoneyDraft(drafts, row, ids.payrollCycleId, 'EMPLOYEE_TAX', row.taxAmount, 'employee tax');
    pushMoneyDraft(drafts, row, ids.payrollCycleId, 'EMPLOYEE_INSURANCE', row.employeeInsuranceAmount, 'employee insurance');
    pushMoneyDraft(drafts, row, ids.payrollCycleId, 'EMPLOYER_INSURANCE', row.employerInsuranceAmount, 'employer insurance');
    pushMoneyDraft(drafts, row, ids.payrollCycleId, 'POLICY_DEDUCTION', row.policyDeductionAmount, 'policy deductions');

    pushHourDraft(drafts, row, ids.payrollCycleId, 'ATTENDANCE_PAYABLE_HOURS', row.attendanceSummary?.payableMinutes, 'payable attendance hours');
    pushHourDraft(drafts, row, ids.payrollCycleId, 'ATTENDANCE_OVERTIME_HOURS', row.attendanceSummary?.overtimeMinutes, 'overtime attendance hours');

    pushMoneyDraft(drafts, row, ids.payrollCycleId, 'NET_PAY', row.netSalary, 'net pay');

    return drafts;
  }

  buildPaymentBatch(preview: PayrollCyclePreview, rows: PayrollBankTransferRow[]): PayrollPaymentBatch {
    const readyCount = rows.filter((row) => row.bankReady).length;
    const blockedCount = rows.length - readyCount;
    return {
      batchId: `PAYMENT-${preview.id}`,
      payrollCycleId: preview.id,
      periodStart: preview.periodStart,
      periodEnd: preview.periodEnd,
      payDate: preview.payDate,
      ready: rows.length > 0 && blockedCount === 0,
      readyCount,
      blockedCount,
      totalNet: round(rows.reduce((total, row) => total + (row.netSalary ?? 0), 0)),
      currency: preview.currency,
      rows,
    };
  }

  renderPayslipHtml(payslip: PayrollPayslip): string {
    const lines = payslip.lines.map((line) => `
        <tr>
          <td>${escapeHtml(line.lineType)}</td>
          <td>${escapeHtml(line.description)}</td>
          <td>${escapeHtml(line.explanation)}</td>
          <td class="amount">${escapeHtml(round(line.amount))}</td>
        </tr>
      `).join('');

    return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>Payslip ${escapeHtml(payslip.employeeId)}</title>
    <style>
      body { font-family: Arial, sans-serif; color: #172033; margin: 32px; }
      header { border-bottom: 3px solid #0b7cff; margin-bottom: 24px; padding-bottom: 16px; }
      h1 { font-size: 24px; margin: 0 0 8px; }
      .muted { color: #52606d; }
      .grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin: 20px 0; }
      .tile { border: 1px solid #d8e0ea; border-radius: 6px; padding: 12px; }
      .label { color: #52606d; font-size: 12px; text-transform: uppercase; }
      .value { font-size: 18px; font-weight: 700; margin-top: 4px; }
      table { border-collapse: collapse; width: 100%; }
      th, td { border-bottom: 1px solid #e4e9f0; padding: 10px; text-align: left; vertical-align: top; }
      th { background: #f5f8fb; font-size: 12px; text-transform: uppercase; }
      .amount { text-align: right; white-space: nowrap; }
      footer { margin-top: 24px; color: #52606d; font-size: 12px; }
    </style>
  </head>
  <body>
    <header>
      <h1>Payslip</h1>
      <div class="muted">${escapeHtml(payslip.payPeriodStart)} to ${escapeHtml(payslip.payPeriodEnd)} · Pay date ${escapeHtml(payslip.payDate)}</div>
      <div>${escapeHtml(payslip.employeeName)} · ${escapeHtml(payslip.employeeId)}</div>
    </header>
    <section class="grid">
      <div class="tile"><div class="label">Gross</div><div class="value">${escapeHtml(payslip.grossPay)} ${escapeHtml(payslip.currency)}</div></div>
      <div class="tile"><div class="label">Taxes</div><div class="value">${escapeHtml(payslip.taxes)} ${escapeHtml(payslip.currency)}</div></div>
      <div class="tile"><div class="label">Deductions</div><div class="value">${escapeHtml(payslip.deductions)} ${escapeHtml(payslip.currency)}</div></div>
      <div class="tile"><div class="label">Net Pay</div><div class="value">${escapeHtml(payslip.netPay)} ${escapeHtml(payslip.currency)}</div></div>
    </section>
    <table>
      <thead>
        <tr><th>Type</th><th>Description</th><th>Explanation</th><th class="amount">Amount</th></tr>
      </thead>
      <tbody>${lines}</tbody>
    </table>
    <footer>Generated from locked payroll result lines. Classification: HIGH_SENSITIVITY.</footer>
  </body>
</html>`;
  }
}
