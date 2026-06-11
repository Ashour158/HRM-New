import { Injectable } from '@nestjs/common';
import { CommandHandler } from '../../../platform/command-bus/command-handler.decorator.js';
import type { HrCommandEnvelope, CommandResult } from '@hcm/command-contracts';
import { Uuid } from '@hcm/shared-kernel';
import { FsmFramework } from '../../../platform/workflow/fsm-framework.js';
import { ReportScheduleRepository } from '../repositories/report-schedule.repository.js';
import { ReportingEventsPublisher } from '../events/reporting-events.publisher.js';

export interface ActivateReportSchedulePayload {
  reportScheduleId: string;
}

@Injectable()
@CommandHandler('ActivateReportSchedule')
export class ActivateReportScheduleHandler {
  constructor(
    private readonly repo: ReportScheduleRepository,
    private readonly fsm: FsmFramework,
    private readonly publisher: ReportingEventsPublisher,
  ) {}

  async handle(command: HrCommandEnvelope<unknown>): Promise<CommandResult<unknown>> {
    const payload = command.payload as ActivateReportSchedulePayload;
    const entity = await this.repo.findByIdForTenant(new Uuid(payload.reportScheduleId), command.tenantId);
    if (!entity) throw new Error('ReportSchedule not found');
    entity.activate(command.correlationId);
    await this.repo.save(entity);
    await this.publisher.publishFromAggregate(entity);
    return {
      success: true,
      data: { reportScheduleId: entity.id.value, status: entity.status },
      commandId: command.commandId,
      correlationId: command.correlationId,
      aggregateId: entity.id,
      newState: entity.status,
      newVersion: entity.aggregateVersion,
      allowedNextActions: this.fsm.getAllowedActionsFromState(entity.status, 'ReportSchedule'),
      fieldAccessDecisions: {},
      eventsEmitted: entity.domainEvents.map((e) => e.eventName),
      auditRecordId: Uuid.generate(),
    };
  }
}
