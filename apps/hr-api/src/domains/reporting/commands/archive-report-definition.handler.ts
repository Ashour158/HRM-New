import { Injectable } from '@nestjs/common';
import { CommandHandler } from '../../../platform/command-bus/command-handler.decorator.js';
import type { HrCommandEnvelope, CommandResult } from '@hcm/command-contracts';
import { Uuid } from '@hcm/shared-kernel';
import { FsmFramework } from '../../../platform/workflow/fsm-framework.js';
import { ReportDefinitionRepository } from '../repositories/report-definition.repository.js';
import { ReportingEventsPublisher } from '../events/reporting-events.publisher.js';

export interface ArchiveReportDefinitionPayload {
  reportDefinitionId: string;
}

@Injectable()
@CommandHandler('ArchiveReportDefinition')
export class ArchiveReportDefinitionHandler {
  constructor(
    private readonly repo: ReportDefinitionRepository,
    private readonly fsm: FsmFramework,
    private readonly publisher: ReportingEventsPublisher,
  ) {}

  async handle(command: HrCommandEnvelope<unknown>): Promise<CommandResult<unknown>> {
    const payload = command.payload as ArchiveReportDefinitionPayload;
    const entity = await this.repo.findById(new Uuid(payload.reportDefinitionId));
    if (!entity) throw new Error('ReportDefinition not found');
    entity.archive(command.correlationId);
    await this.repo.save(entity);
    await this.publisher.publishFromAggregate(entity);
    return {
      success: true,
      data: { reportDefinitionId: entity.id.value, status: entity.status },
      commandId: command.commandId,
      correlationId: command.correlationId,
      aggregateId: entity.id,
      newState: entity.status,
      newVersion: entity.aggregateVersion,
      allowedNextActions: this.fsm.getAllowedActionsFromState(entity.status, 'ReportDefinition'),
      fieldAccessDecisions: {},
      eventsEmitted: entity.domainEvents.map((e) => e.eventName),
      auditRecordId: Uuid.generate(),
    };
  }
}
