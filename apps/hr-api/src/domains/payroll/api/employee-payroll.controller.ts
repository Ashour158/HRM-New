import { Controller, ForbiddenException, Get, Req, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { Uuid } from '@hcm/shared-kernel';
import { AuthGuard } from '../../../guards/auth.guard.js';
import { WorkerRepository } from '../../hr-core/repositories/worker.repository.js';
import { PersonalDataRecordRepository } from '../../hr-core/repositories/personal-data-record.repository.js';
import { PayrollCycleRepository } from '../repositories/payroll-cycle.repository.js';
import { PayrollResultLineRepository } from '../repositories/payroll-result-line.repository.js';
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
  ) {}

  @Get('payslips')
  async getOwnPayslips(@Req() req: Request) {
    const worker = await this.resolveSelfWorker(req);
    if (!worker) return [];

    const tenantId = new Uuid((req['tenantId'] as string | undefined) ?? '00000000-0000-0000-0000-000000000001');
    const records = await this.personalDataRepo.findByWorker(worker.id);
    const payloadByCategory = Object.fromEntries(records.map((record) => [record.dataCategory, record.payload ?? {}])) as Record<string, Record<string, unknown>>;
    const basic = payloadByCategory.BASIC ?? {};
    const compensation = payloadByCategory.COMPENSATION ?? {};
    const employee: PayrollCycleEmployeeInput = {
      workerId: worker.id.value,
      employeeId: worker.employeeNumber,
      name: `${worker.firstName} ${worker.lastName}`.trim(),
      email: String(basic.workEmail ?? basic.personalEmail ?? worker.email.toString()),
      grossSalary: Number(compensation.grossSalaryAmount ?? compensation.salaryAmount ?? 0),
      currency: String(compensation.salaryCurrency ?? 'EGP'),
    };

    const cycles = await this.payrollCycleRepo.findByTenant(tenantId);
    const cycleById = new Map(cycles.map((cycle) => [cycle.id.value, cycle]));
    const lockedLines = (await this.resultLineRepo.findByWorker(worker.id))
      .filter((line) => line.status === 'LOCKED');
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
      })
      .sort((left, right) => right.payDate.localeCompare(left.payDate));
  }

  private async resolveSelfWorker(req: Request) {
    const actorId = this.getActorId(req);
    try {
      const worker = await this.workerRepo.findById(new Uuid(actorId));
      if (worker) return worker;
    } catch {
      // Demo auth subjects may be user IDs instead of employee profile IDs.
    }

    const email = (req.actor as { email?: string } | undefined)?.email;
    if (email) {
      const worker = await this.workerRepo.findByEmail(email);
      if (worker) return worker;
    }

    return undefined;
  }

  private getActorId(req: Request): string {
    const actorId = req.actor?.actorId;
    if (actorId instanceof Uuid) return actorId.value;
    const actorIdLike = actorId as { value?: unknown } | undefined;
    if (typeof actorIdLike?.value === 'string') return actorIdLike.value;
    throw new ForbiddenException('Authenticated actor is required');
  }
}
