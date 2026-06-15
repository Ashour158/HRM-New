import { Controller, ForbiddenException, Get, Req, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { Uuid } from '@hcm/shared-kernel';
import { AuditLedgerService } from '@hcm/platform-core';
import { AuthGuard } from '../../../guards/auth.guard.js';
import { resolveTenantCurrency } from '../../hcm-setup/hcm-setup-currency.js';
import { HcmSetupService } from '../../hcm-setup/hcm-setup.service.js';
import { WorkerRepository } from '../../hr-core/repositories/worker.repository.js';
import { PersonalDataRecordRepository } from '../../hr-core/repositories/personal-data-record.repository.js';
import { PayrollCycleRepository } from '../repositories/payroll-cycle.repository.js';
import { PayrollResultLineRepository } from '../repositories/payroll-result-line.repository.js';
import { PayrollPayslipArtifactRepository } from '../repositories/payroll-payslip-artifact.repository.js';
import type { PayrollPayslipArtifactRecord } from '../services/payroll-artifact.service.js';
import { PayrollCycleCalculationService, type PayrollCycleEmployeeInput, type PayrollPayslipLine } from '../services/payroll-cycle-calculation.service.js';

function datePart(date: Date): string {
  return date.toISOString().slice(0, 10);
}

@ApiTags('Employee Payroll')
@UseGuards(AuthGuard)
@Controller('employee')
export class EmployeePayrollController {
  constructor(
    private readonly workerRepo: WorkerRepository,
    private readonly personalDataRepo: PersonalDataRecordRepository,
    private readonly payrollCycleRepo: PayrollCycleRepository,
    private readonly resultLineRepo: PayrollResultLineRepository,
    private readonly payrollCalculation: PayrollCycleCalculationService,
    private readonly payslipArtifactRepo: PayrollPayslipArtifactRepository,
    private readonly auditLedger: AuditLedgerService,
    private readonly hcmSetupService: HcmSetupService,
  ) {}

  @Get('payslips')
  async getOwnPayslips(@Req() req: Request) {
    const tenantId = this.getTenantId(req);
    const worker = await this.resolveSelfWorker(req, tenantId);

    const cycles = await this.payrollCycleRepo.findByTenant(tenantId);
    const cycleById = new Map(cycles.map((cycle) => [cycle.id.value, cycle]));
    const artifactPayslips = [];
    const cyclesWithoutPublishedArtifact = [];

    for (const cycle of cycles) {
      const artifact = await this.payslipArtifactRepo.findByCycleAndWorker(tenantId, cycle.id, worker.id);
      if (artifact?.status === 'PUBLISHED') {
        artifactPayslips.push(this.toPublishedArtifactPayslip(artifact, cycle, `${worker.firstName} ${worker.lastName}`.trim()));
      } else {
        cyclesWithoutPublishedArtifact.push(cycle);
      }
    }

    const fallbackPayslips = cyclesWithoutPublishedArtifact.length > 0
      ? await this.buildPayslipsFromLockedLines(tenantId, worker, cycleById, new Set(artifactPayslips.map((payslip) => payslip.payrollCycleId)))
      : [];

    const payslips = [...artifactPayslips, ...fallbackPayslips]
      .sort((left, right) => right.payDate.localeCompare(left.payDate));

    if (payslips.length > 0) {
      await this.auditLedger.writeAuditOnAccess(
        req.actor!,
        tenantId,
        'Payslip',
        worker.id,
        ['grossPay', 'netPay', 'payPeriodStart', 'payPeriodEnd', 'payDate', 'lines'],
        'Employee payslip self-service view',
      );
    }

    return payslips;
  }

  private async buildPayslipsFromLockedLines(
    tenantId: Uuid,
    worker: {
      id: Uuid;
      employeeNumber: string;
      firstName: string;
      lastName: string;
      email: { toString(): string };
    },
    cycleById: Map<string, { id: Uuid; payPeriodStart: Date; payPeriodEnd: Date; payDate?: Date }>,
    excludedCycleIds: Set<string>,
  ) {
    const records = await this.personalDataRepo.findByWorker(worker.id);
    const payloadByCategory = Object.fromEntries(records.map((record) => [record.dataCategory, record.payload ?? {}])) as Record<string, Record<string, unknown>>;
    const basic = payloadByCategory.BASIC ?? {};
    const compensation = payloadByCategory.COMPENSATION ?? {};
    const salaryCurrency = typeof compensation.salaryCurrency === 'string' && compensation.salaryCurrency
      ? compensation.salaryCurrency
      : undefined;
    const currency = salaryCurrency
      ?? resolveTenantCurrency(await this.hcmSetupService.getSetup(tenantId));
    const employee: PayrollCycleEmployeeInput = {
      workerId: worker.id.value,
      employeeId: worker.employeeNumber,
      name: `${worker.firstName} ${worker.lastName}`.trim(),
      email: String(basic.workEmail ?? basic.personalEmail ?? worker.email.toString()),
      grossSalary: Number(compensation.grossSalaryAmount ?? compensation.salaryAmount ?? 0),
      currency: String(currency),
    };

    const lockedLines = (await this.resultLineRepo.findByWorker(worker.id))
      .filter((line) => line.status === 'LOCKED' && !excludedCycleIds.has(line.payrollCycleId.value));
    const linesByCycle = new Map<string, PayrollPayslipLine[]>();

    for (const line of lockedLines) {
      const cycleId = line.payrollCycleId.value;
      if (!cycleById.has(cycleId)) continue;
      linesByCycle.set(cycleId, [
        ...(linesByCycle.get(cycleId) ?? []),
        {
          id: line.id.value,
          workerId: line.workerId.value,
          lineType: line.lineType,
          description: line.description,
          amount: line.amount,
          currency: line.currency,
          ruleSetId: line.ruleSetId,
          explanation: line.explanation,
          status: line.status,
        },
      ]);
    }

    return [...linesByCycle.entries()]
      .flatMap(([cycleId, resultLines]) => {
        const cycle = cycleById.get(cycleId);
        if (!cycle) return [];
        return this.payrollCalculation.buildPayslipsFromResultLines({
          payrollCycle: {
            id: cycle.id.value,
            periodStart: datePart(cycle.payPeriodStart),
            periodEnd: datePart(cycle.payPeriodEnd),
            payDate: datePart(cycle.payDate ?? cycle.payPeriodEnd),
          },
          employees: [employee],
          resultLines,
        });
      });
  }

  private toPublishedArtifactPayslip(
    artifact: PayrollPayslipArtifactRecord,
    cycle: { id: Uuid; payPeriodStart: Date; payPeriodEnd: Date; payDate?: Date },
    employeeName: string,
  ) {
    const payload = artifact.payslipPayload;
    if (payload) {
      return {
        id: artifact.id,
        payrollCycleId: cycle.id.value,
        workerId: artifact.workerId,
        employeeId: payload.employeeId ?? artifact.employeeId,
        employeeName: payload.employeeName ?? employeeName,
        payPeriodStart: datePart(cycle.payPeriodStart),
        payPeriodEnd: datePart(cycle.payPeriodEnd),
        payDate: datePart(cycle.payDate ?? cycle.payPeriodEnd),
        grossPay: payload.grossPay,
        netPay: payload.netPay,
        deductions: payload.deductions,
        taxes: payload.taxes,
        currency: payload.currency,
        lines: payload.lines.map((line) => ({
          id: line.id,
          workerId: line.workerId,
          lineType: line.lineType,
          description: line.description,
          amount: line.amount,
          currency: line.currency,
          ruleSetId: line.ruleSetId,
          explanation: line.explanation,
          status: line.status,
        })),
        contentHash: artifact.contentHash,
        artifactStatus: artifact.status,
        dataClassification: artifact.dataClassification,
        generatedAt: artifact.createdAt,
        publishedAt: artifact.publishedAt,
      };
    }

    return {
      id: artifact.id,
      payrollCycleId: cycle.id.value,
      workerId: artifact.workerId,
      employeeId: artifact.employeeId,
      employeeName,
      payPeriodStart: datePart(cycle.payPeriodStart),
      payPeriodEnd: datePart(cycle.payPeriodEnd),
      payDate: datePart(cycle.payDate ?? cycle.payPeriodEnd),
      grossPay: artifact.grossPay,
      netPay: artifact.netPay,
      deductions: Math.max(0, artifact.grossPay - artifact.netPay),
      taxes: 0,
      currency: artifact.currency,
      lines: [],
      contentHash: artifact.contentHash,
      artifactStatus: artifact.status,
      dataClassification: artifact.dataClassification,
      generatedAt: artifact.createdAt,
      publishedAt: artifact.publishedAt,
    };
  }

  private async resolveSelfWorker(req: Request, tenantId: Uuid) {
    const actorId = this.getActorId(req);
    try {
      const worker = await this.workerRepo.findByIdForTenant(new Uuid(actorId), tenantId);
      if (worker) return this.assertActiveWorker(worker);
    } catch {
      // Demo auth subjects may be user IDs instead of employee profile IDs.
    }

    const email = (req.actor as { email?: string } | undefined)?.email;
    if (email) {
      const worker = await this.workerRepo.findByEmailForTenant(email, tenantId);
      if (worker) return this.assertActiveWorker(worker);
    }

    throw new ForbiddenException('No active employee profile is linked to the authenticated user');
  }

  private assertActiveWorker<TWorker extends { status?: string }>(worker: TWorker): TWorker {
    if (worker.status === 'ACTIVE') return worker;
    throw new ForbiddenException('Only active employees can access payslips');
  }

  private getTenantId(req: Request): Uuid {
    return new Uuid((req['tenantId'] as string | undefined) ?? '00000000-0000-0000-0000-000000000001');
  }

  private getActorId(req: Request): string {
    const actorId = req.actor?.actorId;
    if (actorId instanceof Uuid) return actorId.value;
    const actorIdLike = actorId as { value?: unknown } | undefined;
    if (typeof actorIdLike?.value === 'string') return actorIdLike.value;
    throw new ForbiddenException('Authenticated actor is required');
  }
}
