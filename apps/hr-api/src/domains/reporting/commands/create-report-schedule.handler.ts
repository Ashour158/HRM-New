import { Injectable } from '@nestjs/common';
import { CommandHandler } from '../../../platform/command-bus/command-handler.decorator.js';
import type { HrCommandEnvelope, CommandResult } from '@hcm/command-contracts';
import { Uuid } from '@hcm/shared-kernel';
import { FsmFramework } from '../../../platform/workflow/fsm-framework.js';
import { ReportSchedule } from '../aggregates/report-schedule.aggregate.js';
import { ReportScheduleRepository } from '../repositories/report-schedule.repository.js';
import { ReportingEventsPublisher } from '../events/reporting-events.publisher.js';

export interface CreateReportSchedulePayload {
  reportScheduleId: string;
  reportDefinitionId: string;
  frequency: string;
  recipients?: string[];
  nextRunAt?: Date;
}

@Injectable()
@CommandHandler('CreateReportSchedule')
export class CreateReportScheduleHandler {
  constructor(
    private readonly repo: ReportScheduleRepository,
    private readonly fsm: FsmFramework,
    private readonly publisher: ReportingEventsPublisher,
  ) {}

  async handle(command: HrCommandEnvelope<unknown>): Promise<CommandResult<unknown>> {
    const payload = command.payload as CreateReportSchedulePayload;
    const entity = ReportSchedule.create({
      id: new Uuid(payload.reportScheduleId),
      tenantId: command.tenantId,
      reportDefinitionId: new Uuid(payload.reportDefinitionId),
      frequency: payload.frequency,
      recipients: payload.recipients,
      nextRunAt: payload.nextRunAt,
    }, command.correlationId);
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
