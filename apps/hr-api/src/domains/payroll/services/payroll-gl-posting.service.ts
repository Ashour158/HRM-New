import { Injectable } from '@nestjs/common';
import { createHash, randomUUID } from 'crypto';
import { roundMoney } from '@hcm/shared-kernel';
import type { PayrollCyclePreview } from './payroll-cycle-calculation.service.js';

export interface PayrollGlPostingLine {
  accountCode: string;
  description: string;
  debit: number;
  credit: number;
  currency: string;
}

export interface PayrollGlPostingRecord {
  id: string;
  tenantId: string;
  payrollCycleId: string;
  postingNumber: string;
  status: 'DRAFT' | 'APPROVED' | 'POSTED';
  totalDebits: number;
  totalCredits: number;
  currency: string;
  lines: PayrollGlPostingLine[];
  sourceHash: string;
  createdBy?: string;
  approvedBy?: string;
  postedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

function hash(value: unknown): string {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex');
}

@Injectable()
export class PayrollGlPostingService {
  buildPosting(input: {
    tenantId: string;
    payrollCycleId: string;
    preview: PayrollCyclePreview;
    createdBy?: string;
    accountMapping?: {
      salaryExpenseAccount?: string;
      employerInsuranceExpenseAccount?: string;
      taxPayableAccount?: string;
      insurancePayableAccount?: string;
      deductionPayableAccount?: string;
      bankClearingAccount?: string;
    };
  }): PayrollGlPostingRecord {
    const mapping = input.accountMapping ?? {};
    const currency = input.preview.currency;
    const lines = [
      {
        accountCode: mapping.salaryExpenseAccount ?? '6000',
        description: 'Payroll salary expense',
        debit: roundMoney(input.preview.totalGross),
        credit: 0,
        currency,
      },
      {
        accountCode: mapping.employerInsuranceExpenseAccount ?? '6010',
        description: 'Employer insurance expense',
        debit: roundMoney(input.preview.totalEmployerInsurance),
        credit: 0,
        currency,
      },
      {
        accountCode: mapping.taxPayableAccount ?? '2100',
        description: 'Payroll tax payable',
        debit: 0,
        credit: roundMoney(input.preview.totalTax),
        currency,
      },
      {
        accountCode: mapping.insurancePayableAccount ?? '2110',
        description: 'Insurance payable',
        debit: 0,
        credit: roundMoney(input.preview.totalEmployeeInsurance + input.preview.totalEmployerInsurance),
        currency,
      },
      {
        accountCode: mapping.deductionPayableAccount ?? '2200',
        description: 'Policy deductions payable',
        debit: 0,
        credit: roundMoney(input.preview.totalPolicyDeductions),
        currency,
      },
      {
        accountCode: mapping.bankClearingAccount ?? '1000',
        description: 'Bank clearing net payroll',
        debit: 0,
        credit: roundMoney(input.preview.totalNet),
        currency,
      },
    ].filter((line) => line.debit > 0 || line.credit > 0);
    const totalDebits = roundMoney(lines.reduce((total, line) => total + line.debit, 0));
    const totalCredits = roundMoney(lines.reduce((total, line) => total + line.credit, 0));
    const now = new Date();
    return {
      id: randomUUID(),
      tenantId: input.tenantId,
      payrollCycleId: input.payrollCycleId,
      postingNumber: `GL-${input.preview.id}`,
      status: 'DRAFT',
      totalDebits,
      totalCredits,
      currency,
      lines,
      sourceHash: hash({ preview: input.preview, lines }),
      createdBy: input.createdBy,
      createdAt: now,
      updatedAt: now,
    };
  }
}
