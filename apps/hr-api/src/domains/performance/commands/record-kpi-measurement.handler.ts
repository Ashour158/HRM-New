import { Injectable } from '@nestjs/common';
import { CommandHandler } from '../../../platform/command-bus/command-handler.decorator.js';
import type { HrCommandEnvelope, CommandResult } from '@hcm/command-contracts';
import { Uuid, ValidationError } from '@hcm/shared-kernel';
import { FsmFramework } from '../../../platform/workflow/fsm-framework.js';
import { KpiMeasurement } from '../aggregates/kpi-measurement.aggregate.js';
import { KpiMeasurementRepository } from '../repositories/kpi-measurement.repository.js';
import { KpiRepository } from '../repositories/kpi.repository.js';
import { PerformanceEventsPublisher } from '../events/performance-events.publisher.js';
import { KpiFormulaService } from '../services/kpi-formula.service.js';

function parseMeasurementPeriod(period: string): { periodStart: Date; periodEnd: Date } {
  const monthly = /^(\d{4})-(\d{2})$/.exec(period);
  if (monthly) {
    const year = Number(monthly[1]);
    const monthIndex = Number(monthly[2]) - 1;
    return {
      periodStart: new Date(Date.UTC(year, monthIndex, 1)),
      periodEnd: new Date(Date.UTC(year, monthIndex + 1, 0, 23, 59, 59, 999)),
    };
  }
  const date = new Date(period);
  return {
    periodStart: Number.isNaN(date.getTime()) ? new Date() : date,
    periodEnd: Number.isNaN(date.getTime()) ? new Date() : date,
  };
}

@CommandHandler('RecordKpiMeasurement')
@Injectable()
export class RecordKpiMeasurementHandler {
  constructor(
    private readonly repo: KpiMeasurementRepository,
    private readonly fsm: FsmFramework,
    private readonly publisher: PerformanceEventsPublisher,
    private readonly kpiRepo: KpiRepository,
    private readonly formulaService: KpiFormulaService,
  ) {}

  async handle(command: HrCommandEnvelope<unknown>): Promise<CommandResult<unknown>> {
    const payload = command.payload as {
      kpiId: string;
      period: string;
      measuredValue: number;
      targetValue?: number;
      notes?: string;
    };
    const kpi = await this.kpiRepo.findById(new Uuid(payload.kpiId));
    if (!kpi) {
      throw new ValidationError('KPI not found');
    }
    const targetValue = payload.targetValue ?? kpi.targetValue;
    const actualValue = this.formulaService.calculate({
      formula: kpi.formula,
      measuredValue: payload.measuredValue,
      targetValue,
      baselineValue: kpi.actualValue,
    });
    const variance = targetValue === undefined ? undefined : actualValue - targetValue;
    const variancePercentage = targetValue && targetValue !== 0 ? Math.round((variance as number / targetValue) * 10000) / 100 : undefined;
    const period = parseMeasurementPeriod(payload.period);
    const ar = KpiMeasurement.create(
      {
        id: Uuid.generate(),
        tenantId: command.tenantId,
        kpiId: new Uuid(payload.kpiId),
        periodStart: period.periodStart,
        periodEnd: period.periodEnd,
        actualValue,
        targetValue,
        variance,
        variancePercentage,
        notes: payload.notes,
      },
      command.correlationId,
    );
    await this.repo.save(ar);
    if (kpi.status === 'ACTIVE' || kpi.status === 'INACTIVE') {
      kpi.updateActual(actualValue, command.correlationId);
      await this.kpiRepo.save(kpi);
    }
    await this.publisher.publishFromAggregate(ar);
    return {
      success: true,
      data: { kpiMeasurementId: ar.id.value, status: ar.status },
      commandId: command.commandId,
      correlationId: command.correlationId,
      aggregateId: ar.id,
      newState: ar.status,
      newVersion: ar.aggregateVersion,
      allowedNextActions: this.fsm.getAllowedActionsFromState(ar.status, 'KpiMeasurement'),
      eventsEmitted: ar.domainEvents.map((e) => e.eventName),
      auditRecordId: command.commandId,
    } as CommandResult<unknown>;
  }
}
