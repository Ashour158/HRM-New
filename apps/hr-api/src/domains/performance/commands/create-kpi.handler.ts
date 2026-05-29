import { Injectable } from '@nestjs/common';
import { CommandHandler } from '../../../platform/command-bus/command-handler.decorator.js';
import type { HrCommandEnvelope, CommandResult } from '@hcm/command-contracts';
import { Uuid } from '@hcm/shared-kernel';
import { FsmFramework } from '../../../platform/workflow/fsm-framework.js';
import { KeyPerformanceIndicator } from '../aggregates/kpi.aggregate.js';
import { KpiRepository } from '../repositories/kpi.repository.js';
import { PerformanceEventsPublisher } from '../events/performance-events.publisher.js';

@CommandHandler('CreateKpi')
@Injectable()
export class CreateKpiHandler {
  constructor(
    private readonly repo: KpiRepository,
    private readonly fsm: FsmFramework,
    private readonly publisher: PerformanceEventsPublisher,
  ) {}

  async handle(command: HrCommandEnvelope<unknown>): Promise<CommandResult<unknown>> {
    const payload = command.payload as {
      orgUnitId: string;
      name: string;
      description?: string;
      targetValue: number;
      unit?: string;
      frequency: string;
      ownerId: string;
      formula?: string;
      dataSource?: string;
      departmentCategory: string;
    };
    const ar = KeyPerformanceIndicator.create(
      {
        id: Uuid.generate(),
        tenantId: command.tenantId,
        orgUnitId: new Uuid(payload.orgUnitId),
        name: payload.name,
        description: payload.description,
        targetValue: payload.targetValue,
        unit: payload.unit,
        frequency: payload.frequency,
        ownerId: new Uuid(payload.ownerId),
        formula: payload.formula,
        dataSource: payload.dataSource,
        department: payload.departmentCategory,
      },
      command.correlationId,
    );
    await this.repo.save(ar);
    await this.publisher.publishFromAggregate(ar);
    return {
      success: true,
      data: { kpiId: ar.id.value, status: ar.status },
      commandId: command.commandId,
      correlationId: command.correlationId,
      aggregateId: ar.id,
      newState: ar.status,
      newVersion: ar.aggregateVersion,
      allowedNextActions: this.fsm.getAllowedActionsFromState(ar.status, 'KeyPerformanceIndicator'),
      eventsEmitted: ar.domainEvents.map((e) => e.eventName),
      auditRecordId: command.commandId,
    } as CommandResult<unknown>;
  }
}
