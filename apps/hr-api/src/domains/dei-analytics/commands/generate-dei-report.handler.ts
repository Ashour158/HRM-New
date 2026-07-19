import { Injectable } from '@nestjs/common';
import { CommandHandler } from '../../../platform/command-bus/command-handler.decorator.js';
import type { HrCommandEnvelope, CommandResult } from '@hcm/command-contracts';
import { Uuid } from '@hcm/shared-kernel';
import { FsmFramework } from '../../../platform/workflow/fsm-framework.js';
import { DeiReportRepository } from '../repositories/dei-report.repository.js';
import { DeiAnalyticsEventsPublisher } from '../events/dei-analytics-events.publisher.js';
import { WorkforceDataService } from '../services/workforce-data.service.js';
import { computeWorkforceMetrics } from '../services/workforce-metrics-calculator.js';

export interface GenerateDeiReportPayload {
  deiReportId: string;
}

/**
 * Computes real workforce-composition metrics (headcount by gender,
 * department, employment type, and leadership representation) for a
 * DeiReport from the report's own legalEntityId, rather than trusting
 * caller-supplied metrics. The caller only identifies which report to
 * generate.
 */
@Injectable()
@CommandHandler('GenerateDeiReport')
export class GenerateDeiReportHandler {
  constructor(
    private readonly repo: DeiReportRepository,
    private readonly fsm: FsmFramework,
    private readonly publisher: DeiAnalyticsEventsPublisher,
    private readonly workforceData: WorkforceDataService,
  ) {}

  async handle(command: HrCommandEnvelope<unknown>): Promise<CommandResult<unknown>> {
    const payload = command.payload as GenerateDeiReportPayload;
    const entity = await this.repo.findById(new Uuid(payload.deiReportId));
    if (!entity) throw new Error('DeiReport not found');

    const workers = await this.workforceData.loadWorkforceSnapshot(command.tenantId, entity.legalEntityId);
    const metrics = computeWorkforceMetrics(workers);

    entity.generate(command.correlationId, metrics);
    await this.repo.save(entity);
    await this.publisher.publishFromAggregate(entity);
    return {
      success: true,
      data: { deiReportId: entity.id.value, status: entity.status },
      commandId: command.commandId,
      correlationId: command.correlationId,
      aggregateId: entity.id,
      newState: entity.status,
      newVersion: entity.aggregateVersion,
      allowedNextActions: this.fsm.getAllowedActionsFromState(entity.status, 'DeiReport'),
      fieldAccessDecisions: {},
      eventsEmitted: entity.domainEvents.map((e) => e.eventName),
      auditRecordId: Uuid.generate(),
    };
  }
}
