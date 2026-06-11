import { Injectable } from '@nestjs/common';
import { CommandHandler } from '../../../platform/command-bus/command-handler.decorator.js';
import type { HrCommandEnvelope, CommandResult } from '@hcm/command-contracts';
import { Uuid } from '@hcm/shared-kernel';
import { FsmFramework } from '../../../platform/workflow/fsm-framework.js';
import { ReportExecutionRepository } from '../repositories/report-execution.repository.js';
import { ReportingEventsPublisher } from '../events/reporting-events.publisher.js';

export interface FailReportExecutionPayload {
  reportExecutionId: string;
  reason: string;
}

@Injectable()
@CommandHandler('FailReportExecution')
export class FailReportExecutionHandler {
  constructor(
    private readonly repo: ReportExecutionRepository,
    private readonly fsm: FsmFramework,
    private readonly publisher: ReportingEventsPublisher,
  ) {}

  async handle(command: HrCommandEnvelope<unknown>): Promise<CommandResult<unknown>> {
    const payload = command.payload as FailReportExecutionPayload;
    const entity = await this.repo.findByIdForTenant(new Uuid(payload.reportExecutionId), command.tenantId);
    if (!entity) throw new Error('ReportExecution not found');
    entity.fail(command.correlationId, payload.reason);
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
