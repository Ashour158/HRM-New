import { Injectable } from '@nestjs/common';
import { roundMoney } from '@hcm/shared-kernel';
import type { PayrollCyclePreview, PayrollCycleRow, PayrollExplainabilityLine } from './payroll-cycle-calculation.service.js';

export interface PayrollApprovedInputRecord {
  workerId: string | { value: string };
  inputType: string;
  amount: number;
  currency: string;
  status: string;
  description?: string;
}

function workerIdOf(input: PayrollApprovedInputRecord): string {
  return typeof input.workerId === 'string' ? input.workerId : input.workerId.value;
}

function overrideLine(code: string, label: string, amount: number, formula: string): PayrollExplainabilityLine {
  return {
    code,
    label,
    amount: roundMoney(amount),
    source: 'POLICY',
    formula,
  };
}

function recalculateNet(row: PayrollCycleRow): PayrollCycleRow {
  const gross = row.grossSalary ?? 0;
  const tax = row.taxAmount ?? 0;
  const insurance = row.employeeInsuranceAmount ?? 0;
  const deductions = row.policyDeductionAmount ?? 0;
  return {
    ...row,
    netSalary: roundMoney(Math.max(gross - tax - insurance - deductions, 0)),
  };
}

function sumRows(rows: PayrollCycleRow[], selector: (row: PayrollCycleRow) => number | null): number {
  return roundMoney(rows.reduce((total, row) => total + (selector(row) ?? 0), 0));
}

@Injectable()
export class PayrollApprovedInputProjectionService {
  applyApprovedInputs(preview: PayrollCyclePreview, inputs: PayrollApprovedInputRecord[]): PayrollCyclePreview {
    const approvedByWorker = new Map<string, PayrollApprovedInputRecord[]>();
    for (const input of inputs) {
      if (input.status !== 'APPROVED') continue;
      const workerId = workerIdOf(input);
      approvedByWorker.set(workerId, [...(approvedByWorker.get(workerId) ?? []), input]);
    }

    const rows = preview.rows.map((row) => this.applyInputsToRow(row, approvedByWorker.get(row.workerId) ?? []));

    return {
      ...preview,
      rows,
      totalGross: sumRows(rows, (row) => row.grossSalary),
      totalTax: sumRows(rows, (row) => row.taxAmount),
      totalEmployeeInsurance: sumRows(rows, (row) => row.employeeInsuranceAmount),
      totalEmployerInsurance: sumRows(rows, (row) => row.employerInsuranceAmount),
      totalPolicyDeductions: sumRows(rows, (row) => row.policyDeductionAmount),
      totalNet: sumRows(rows, (row) => row.netSalary),
      currency: rows[0]?.currency ?? preview.currency,
    };
  }

  private applyInputsToRow(row: PayrollCycleRow, inputs: PayrollApprovedInputRecord[]): PayrollCycleRow {
    if (inputs.length === 0) return row;

    let projected: PayrollCycleRow = { ...row, explainability: [...row.explainability] };
    for (const input of inputs) {
      const amount = roundMoney(Number(input.amount));
      if (!Number.isFinite(amount)) continue;

      if (input.inputType === 'MASS_UPDATE_GROSS_PAY') {
        projected = {
          ...projected,
          baseGrossSalary: amount,
          grossSalary: amount,
          taxableEarningAmount: projected.taxableEarningAmount ?? 0,
          currency: input.currency || projected.currency,
          explainability: [
            ...projected.explainability,
            overrideLine('APPROVED_GROSS_PAY_INPUT', 'Approved gross pay input', amount, 'Approved payroll input overrides calculated gross pay'),
          ],
        };
      } else if (input.inputType === 'MASS_UPDATE_TAX_OVERRIDE') {
        projected = {
          ...projected,
          taxAmount: amount,
          explainability: [
            ...projected.explainability,
            overrideLine('APPROVED_TAX_OVERRIDE', 'Approved tax override', amount, 'Approved payroll input overrides calculated tax'),
          ],
        };
      } else if (input.inputType === 'MASS_UPDATE_INSURANCE_OVERRIDE') {
        projected = {
          ...projected,
          employeeInsuranceAmount: amount,
          explainability: [
            ...projected.explainability,
            overrideLine('APPROVED_INSURANCE_OVERRIDE', 'Approved insurance override', amount, 'Approved payroll input overrides calculated employee insurance'),
          ],
        };
      } else if (input.inputType.startsWith('MASS_UPDATE_DEDUCTION')) {
        projected = {
          ...projected,
          policyDeductionAmount: roundMoney((projected.policyDeductionAmount ?? 0) + amount),
          explainability: [
            ...projected.explainability,
            overrideLine(input.inputType, input.description ?? 'Approved deduction input', amount, 'Approved payroll input adds a governed deduction'),
          ],
        };
      } else if (input.inputType === 'OFF_CYCLE_EARNING' || input.inputType === 'RETRO_ADJUSTMENT') {
        projected = {
          ...projected,
          earningAmount: roundMoney((projected.earningAmount ?? 0) + amount),
          taxableEarningAmount: roundMoney((projected.taxableEarningAmount ?? 0) + amount),
          grossSalary: roundMoney((projected.grossSalary ?? 0) + amount),
          explainability: [
            ...projected.explainability,
            overrideLine(input.inputType, input.description ?? 'Approved off-cycle or retro input', amount, 'Approved payroll input adds taxable gross earnings'),
          ],
        };
      } else if (input.inputType === 'OFF_CYCLE_DEDUCTION' || input.inputType === 'RETRO_DEDUCTION') {
        projected = {
          ...projected,
          policyDeductionAmount: roundMoney((projected.policyDeductionAmount ?? 0) + amount),
          explainability: [
            ...projected.explainability,
            overrideLine(input.inputType, input.description ?? 'Approved off-cycle or retro deduction', amount, 'Approved payroll input adds a governed deduction'),
          ],
        };
      }
    }

    return recalculateNet(projected);
  }
}
