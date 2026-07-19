import { BadRequestException, Injectable } from '@nestjs/common';
import { Uuid, roundMoney } from '@hcm/shared-kernel';
import { resolveTenantCurrency } from '../../hcm-setup/hcm-setup-currency.js';
import { HcmSetupService } from '../../hcm-setup/hcm-setup.service.js';
import { PayrollCycleRepository } from '../repositories/payroll-cycle.repository.js';
import { PayrollResultLineRepository } from '../repositories/payroll-result-line.repository.js';
import { PayrollPaymentBatchRepository } from '../repositories/payroll-payment-batch.repository.js';
import { PayrollPayslipArtifactRepository } from '../repositories/payroll-payslip-artifact.repository.js';
import { PayrollGlPostingRepository } from '../repositories/payroll-gl-posting.repository.js';
import {
  PayrollCycleGovernanceService,
  type PayrollCloseGlPostingEvidence,
  type PayrollClosePaymentBatchEvidence,
  type PayrollClosePayslipArtifactEvidence,
  type PayrollCloseToPayReadiness,
} from './payroll-cycle-governance.service.js';
import type { PayrollBankTransferRow, PayrollCyclePreview, PayrollCycleRow } from './payroll-cycle-calculation.service.js';

function requirePayrollCurrency(currency: string | undefined, context: string): string {
  if (!currency) throw new BadRequestException(`${context} currency is required`);
  return currency;
}

/**
 * Rebuilds a payroll cycle preview and its close-to-pay readiness purely from persisted
 * state (locked result lines, payment batch, payslip artifacts, GL posting). Extracted from
 * PayrollController so both the synchronous cycle endpoints and the background close-to-pay
 * job (which runs after the originating HTTP request has already returned) can evaluate the
 * same readiness gate without depending on an Express Request.
 */
@Injectable()
export class PayrollPersistedCycleReadinessService {
  constructor(
    private readonly hcmSetupService: HcmSetupService,
    private readonly payrollCycleRepo: PayrollCycleRepository,
    private readonly resultLineRepo: PayrollResultLineRepository,
    private readonly paymentBatchRepo: PayrollPaymentBatchRepository,
    private readonly payslipArtifactRepo: PayrollPayslipArtifactRepository,
    private readonly glPostingRepo: PayrollGlPostingRepository,
    private readonly payrollGovernance: PayrollCycleGovernanceService,
  ) {}

  private persistedBankRowsFromPaymentBatch(
    paymentBatch: Awaited<ReturnType<PayrollPaymentBatchRepository['findByPayrollCycle']>>,
  ): PayrollBankTransferRow[] {
    return Array.isArray(paymentBatch?.payload?.rows) ? paymentBatch.payload.rows : [];
  }

  private buildPersistedCycleRows(input: {
    resultLines: Awaited<ReturnType<PayrollResultLineRepository['findByPayrollCycle']>>;
    paymentBatch: Awaited<ReturnType<PayrollPaymentBatchRepository['findByPayrollCycle']>>;
    payslipArtifacts: Awaited<ReturnType<PayrollPayslipArtifactRepository['findByPayrollCycle']>>;
  }): PayrollCycleRow[] {
    const lockedLines = input.resultLines.filter((line) => line.status === 'LOCKED');
    const linesByWorkerId = new Map<string, typeof lockedLines>();
    for (const line of lockedLines) {
      const workerId = line.workerId.value;
      linesByWorkerId.set(workerId, [...(linesByWorkerId.get(workerId) ?? []), line]);
    }

    const bankRowsByWorkerId = new Map(this.persistedBankRowsFromPaymentBatch(input.paymentBatch).map((row) => [row.workerId, row]));
    const artifactsByWorkerId = new Map(input.payslipArtifacts.map((artifact) => [artifact.workerId, artifact]));

    return [...linesByWorkerId.entries()].map(([workerId, lines]) => {
      const bankRow = bankRowsByWorkerId.get(workerId);
      const artifact = artifactsByWorkerId.get(workerId);
      const currency = requirePayrollCurrency(lines[0]?.currency ?? bankRow?.currency ?? artifact?.currency, 'Locked payroll row');
      const grossLines = lines.filter((line) => (
        line.lineType === 'GROSS'
        || line.ruleSetId === 'EARNING'
        || line.lineType === 'OFF_CYCLE_EARNING'
        || line.lineType === 'RETRO_ADJUSTMENT'
      ));
      const taxLines = lines.filter((line) => line.lineType === 'TAX' || line.ruleSetId === 'TAX' || (line.explanation ?? '').toLowerCase().includes('taxable base'));
      const employeeInsuranceLines = lines.filter((line) => line.lineType === 'EMPLOYEE_INSURANCE');
      const employerInsuranceLines = lines.filter((line) => line.lineType === 'EMPLOYER_INSURANCE');
      const netLines = lines.filter((line) => line.lineType === 'NET_PAY');
      const deductionLines = lines.filter((line) => (
        !grossLines.includes(line)
        && !taxLines.includes(line)
        && !employeeInsuranceLines.includes(line)
        && !employerInsuranceLines.includes(line)
        && !netLines.includes(line)
      ));
      const grossSalary = roundMoney(grossLines.reduce((total, line) => total + line.amount, 0));
      const taxAmount = roundMoney(taxLines.reduce((total, line) => total + line.amount, 0));
      const employeeInsuranceAmount = roundMoney(employeeInsuranceLines.reduce((total, line) => total + line.amount, 0));
      const employerInsuranceAmount = roundMoney(employerInsuranceLines.reduce((total, line) => total + line.amount, 0));
      const netSalary = roundMoney(
        netLines.length > 0
          ? netLines.reduce((total, line) => total + line.amount, 0)
          : artifact?.netPay ?? bankRow?.netSalary ?? Math.max(grossSalary - taxAmount - employeeInsuranceAmount, 0),
      );
      const policyDeductionAmount = roundMoney(deductionLines.length > 0
        ? deductionLines.reduce((total, line) => total + line.amount, 0)
        : Math.max(grossSalary - taxAmount - employeeInsuranceAmount - netSalary, 0));

      return {
        workerId,
        employeeId: bankRow?.employeeId ?? artifact?.employeeId ?? workerId,
        name: bankRow?.name ?? artifact?.payslipPayload?.employeeName ?? artifact?.employeeId ?? workerId,
        email: bankRow?.workEmail ?? '',
        baseGrossSalary: grossSalary,
        earningAmount: roundMoney(grossLines.filter((line) => line.lineType !== 'GROSS').reduce((total, line) => total + line.amount, 0)),
        taxableEarningAmount: null,
        nonTaxableEarningAmount: null,
        grossSalary,
        taxAmount,
        employeeInsuranceAmount,
        employerInsuranceAmount,
        policyDeductionAmount,
        netSalary,
        currency,
        explainability: lines
          .filter((line) => line.lineType !== 'NET_PAY')
          .map((line) => ({
            code: line.lineType,
            label: line.description,
            amount: line.amount,
            source: line.ruleSetId === 'EARNING' ? 'EARNING' : line.ruleSetId === 'ATTENDANCE' ? 'ATTENDANCE' : 'POLICY',
            formula: line.explanation ?? line.description,
          })),
      };
    });
  }

  async buildPersistedCyclePreview(tenantId: Uuid, payrollCycleId: string): Promise<PayrollCyclePreview> {
    const cycle = await this.payrollCycleRepo.findById(new Uuid(payrollCycleId));
    if (!cycle) throw new BadRequestException('Payroll cycle not found');
    const payrollCycleUuid = new Uuid(payrollCycleId);
    const [allResultLines, paymentBatch, payslipArtifacts, setup] = await Promise.all([
      this.resultLineRepo.findByPayrollCycle(payrollCycleUuid),
      this.paymentBatchRepo.findByPayrollCycle(tenantId, payrollCycleUuid),
      this.payslipArtifactRepo.findByPayrollCycle(tenantId, payrollCycleUuid),
      this.hcmSetupService.getSetup(tenantId),
    ]);
    const resultLines = allResultLines.filter((line) => line.status === 'LOCKED');
    const rows = this.buildPersistedCycleRows({ resultLines, paymentBatch, payslipArtifacts });
    const gross = roundMoney(rows.length > 0 ? rows.reduce((total, row) => total + (row.grossSalary ?? 0), 0) : resultLines
      .filter((line) => line.lineType === 'GROSS' || line.ruleSetId === 'EARNING' || line.lineType === 'OFF_CYCLE_EARNING' || line.lineType === 'RETRO_ADJUSTMENT')
      .reduce((total, line) => total + line.amount, 0));
    const tax = roundMoney(rows.length > 0 ? rows.reduce((total, row) => total + (row.taxAmount ?? 0), 0) : resultLines
      .filter((line) => line.lineType === 'TAX' || (line.explanation ?? '').toLowerCase().includes('taxable base'))
      .reduce((total, line) => total + line.amount, 0));
    const employeeInsurance = roundMoney(rows.length > 0 ? rows.reduce((total, row) => total + (row.employeeInsuranceAmount ?? 0), 0) : resultLines
      .filter((line) => line.lineType === 'EMPLOYEE_INSURANCE')
      .reduce((total, line) => total + line.amount, 0));
    const employerInsurance = roundMoney(rows.length > 0 ? rows.reduce((total, row) => total + (row.employerInsuranceAmount ?? 0), 0) : resultLines
      .filter((line) => line.lineType === 'EMPLOYER_INSURANCE')
      .reduce((total, line) => total + line.amount, 0));
    const net = roundMoney(rows.length > 0 ? rows.reduce((total, row) => total + (row.netSalary ?? 0), 0) : paymentBatch?.totalNet ?? resultLines
      .filter((line) => line.lineType === 'NET_PAY')
      .reduce((total, line) => total + line.amount, 0));
    const deductions = roundMoney(rows.length > 0 ? rows.reduce((total, row) => total + (row.policyDeductionAmount ?? 0), 0) : Math.max(gross - tax - employeeInsurance - net, 0));
    return {
      id: `${cycle.payPeriodStart.getUTCFullYear()}-${String(cycle.payPeriodStart.getUTCMonth() + 1).padStart(2, '0')}`,
      name: cycle.cycleName,
      year: cycle.payPeriodStart.getUTCFullYear(),
      month: cycle.payPeriodStart.getUTCMonth() + 1,
      calendarDays: cycle.payPeriodEnd.getUTCDate(),
      periodStart: cycle.payPeriodStart.toISOString().slice(0, 10),
      periodEnd: cycle.payPeriodEnd.toISOString().slice(0, 10),
      payDate: (cycle.payDate ?? cycle.payPeriodEnd).toISOString().slice(0, 10),
      employeeCount: rows.length > 0 ? rows.length : new Set(resultLines.map((line) => line.workerId.value)).size,
      totalGross: gross,
      totalTax: tax,
      totalEmployeeInsurance: employeeInsurance,
      totalEmployerInsurance: employerInsurance,
      totalPolicyDeductions: deductions,
      totalNet: net,
      currency: resultLines[0]?.currency ?? paymentBatch?.currency ?? resolveTenantCurrency(setup),
      rows,
    };
  }

  private toGlPostingEvidence(posting: Awaited<ReturnType<PayrollGlPostingRepository['findByPayrollCycle']>>): PayrollCloseGlPostingEvidence | undefined {
    if (!posting) return undefined;
    return {
      status: posting.status,
      totalDebits: posting.totalDebits,
      totalCredits: posting.totalCredits,
      lineCount: posting.lines.length,
    };
  }

  private toPaymentBatchEvidence(batch: Awaited<ReturnType<PayrollPaymentBatchRepository['findByPayrollCycle']>>): PayrollClosePaymentBatchEvidence | undefined {
    if (!batch) return undefined;
    return {
      status: batch.status,
      readyCount: batch.readyCount,
      blockedCount: batch.blockedCount,
      totalNet: batch.totalNet,
      exceptionCount: Number(batch.reconciliationSummary?.exceptionCount ?? 0),
    };
  }

  private toPayslipArtifactEvidence(
    artifacts: Awaited<ReturnType<PayrollPayslipArtifactRepository['findByPayrollCycle']>>,
  ): PayrollClosePayslipArtifactEvidence[] {
    return artifacts.map((artifact) => ({
      workerId: artifact.workerId,
      employeeId: artifact.employeeId,
      status: artifact.status,
      contentHash: artifact.contentHash,
      htmlReady: artifact.htmlContent.trim().length > 0,
    }));
  }

  async buildPersistedCycleCloseReadiness(tenantId: Uuid, payrollCycleId: string): Promise<PayrollCloseToPayReadiness> {
    const payrollCycleUuid = new Uuid(payrollCycleId);
    const [preview, setup, resultLines, glPosting, paymentBatch, payslipArtifacts] = await Promise.all([
      this.buildPersistedCyclePreview(tenantId, payrollCycleId),
      this.hcmSetupService.getSetup(tenantId),
      this.resultLineRepo.findByPayrollCycle(payrollCycleUuid),
      this.glPostingRepo.findByPayrollCycle(tenantId, payrollCycleUuid),
      this.paymentBatchRepo.findByPayrollCycle(tenantId, payrollCycleUuid),
      this.payslipArtifactRepo.findByPayrollCycle(tenantId, payrollCycleUuid),
    ]);
    const expectedPayslipWorkerIds = [...new Set(resultLines
      .filter((line) => line.status === 'LOCKED')
      .map((line) => line.workerId.value))];

    return this.payrollGovernance.evaluateCloseToPayReadiness({
      preview,
      bankRows: this.persistedBankRowsFromPaymentBatch(paymentBatch),
      existingCycles: [],
      setup,
      closeEvidence: {
        requireEnterpriseEvidence: true,
        glPosting: this.toGlPostingEvidence(glPosting),
        paymentBatch: this.toPaymentBatchEvidence(paymentBatch),
        payslipArtifacts: this.toPayslipArtifactEvidence(payslipArtifacts),
        expectedPayslipWorkerIds,
      },
    });
  }

  async assertPersistedCycleCanClose(tenantId: Uuid, payrollCycleId: string): Promise<void> {
    const readiness = await this.buildPersistedCycleCloseReadiness(tenantId, payrollCycleId);
    if (readiness.canClose) return;
    throw new BadRequestException({
      message: 'Payroll cycle has blocking readiness issues',
      readiness,
    });
  }
}
