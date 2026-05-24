import { Injectable } from '@nestjs/common';
import { CommandHandler } from '../../../platform/command-bus/command-handler.decorator.js';
import type { HrCommandEnvelope, CommandResult } from '@hcm/command-contracts';
import { Uuid } from '@hcm/shared-kernel';
import { FsmFramework } from '../../../platform/workflow/fsm-framework.js';
import { ReportExecution } from '../aggregates/report-execution.aggregate.js';
import { ReportExecutionRepository } from '../repositories/report-execution.repository.js';
import { ReportingEventsPublisher } from '../events/reporting-events.publisher.js';

export interface CreateReportExecutionPayload {
  reportExecutionId: string;
  reportDefinitionId: string;
  executedBy: string;
  parameters?: Record<string, unknown>;
}

@Injectable()
@CommandHandler('CreateReportExecution')
export class CreateReportExecutionHandler {
  constructor(
    private readonly repo: ReportExecutionRepository,
    private readonly fsm: FsmFramework,
    private readonly publisher: ReportingEventsPublisher,
  ) {}

  async handle(command: HrCommandEnvelope<unknown>): Promise<CommandResult<unknown>> {
    const payload = command.payload as CreateReportExecutionPayload;
    const entity = ReportExecution.create({
      id: new Uuid(payload.reportExecutionId),
      tenantId: command.tenantId,
      reportDefinitionId: new Uuid(payload.reportDefinitionId),
      executedBy: new Uuid(payload.executedBy),
      parameters: payload.parameters,
    }, command.correlationId);
    await this.repo.save(entity);
    await this.publisher.publishFromAggregate(entity);
    return {
      success: true,
      data: { reportExecutionId: entity.id.value, status: entity.status },
      commandId: command.commandId,
      correlationId: command.correlationId,
      aggregateId: entity.id,
      newState: entity.status,
      newVersion: entity.aggregateVersion,
      allowedNextActions: this.fsm.getAllowedActionsFromState(entity.status, 'ReportExecution'),
      fieldAccessDecisions: {},
      eventsEmitted: entity.domainEvents.map((e) => e.eventName),
      auditRecordId: Uuid.generate(),
    };
  }
}
