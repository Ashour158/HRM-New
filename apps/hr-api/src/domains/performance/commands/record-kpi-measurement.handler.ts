import { Injectable } from '@nestjs/common';
import { CommandHandler } from '../../../platform/command-bus/command-handler.decorator.js';
import type { HrCommandEnvelope, CommandResult } from '@hcm/command-contracts';
import { Uuid } from '@hcm/shared-kernel';
import { FsmFramework } from '../../../platform/workflow/fsm-framework.js';
import { KpiMeasurement } from '../aggregates/kpi-measurement.aggregate.js';
import { KpiMeasurementRepository } from '../repositories/kpi-measurement.repository.js';
import { PerformanceEventsPublisher } from '../events/performance-events.publisher.js';

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
  ) {}

  async handle(command: HrCommandEnvelope<unknown>): Promise<CommandResult<unknown>> {
    const payload = command.payload as {
      kpiId: string;
      period: string;
      measuredValue: number;
      targetValue?: number;
      notes?: string;
    };
    const period = parseMeasurementPeriod(payload.period);
    const ar = KpiMeasurement.create(
      {
        id: Uuid.generate(),
        tenantId: command.tenantId,
        kpiId: new Uuid(payload.kpiId),
        periodStart: period.periodStart,
        periodEnd: period.periodEnd,
        actualValue: payload.measuredValue,
        targetValue: payload.targetValue,
        notes: payload.notes,
      },
      command.correlationId,
    );
    await this.repo.save(ar);
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
