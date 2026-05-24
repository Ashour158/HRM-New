import { Injectable } from '@nestjs/common';
import { CommandHandler } from '../../../platform/command-bus/command-handler.decorator.js';
import type { HrCommandEnvelope, CommandResult } from '@hcm/command-contracts';
import { Uuid } from '@hcm/shared-kernel';
import { FsmFramework } from '../../../platform/workflow/fsm-framework.js';
import { DeiReport } from '../aggregates/dei-report.aggregate.js';
import { DeiReportRepository } from '../repositories/dei-report.repository.js';
import { DeiAnalyticsEventsPublisher } from '../events/dei-analytics-events.publisher.js';

export interface CreateDeiReportPayload {
  deiReportId: string;
  reportType: string;
  reportingPeriod: string;
  countryCode: string;
  legalEntityId: string;
}

@Injectable()
@CommandHandler('CreateDeiReport')
export class CreateDeiReportHandler {
  constructor(
    private readonly repo: DeiReportRepository,
    private readonly fsm: FsmFramework,
    private readonly publisher: DeiAnalyticsEventsPublisher,
  ) {}

  async handle(command: HrCommandEnvelope<unknown>): Promise<CommandResult<unknown>> {
    const payload = command.payload as CreateDeiReportPayload;
    const entity = DeiReport.create({
      id: new Uuid(payload.deiReportId),
      tenantId: command.tenantId,
      reportType: payload.reportType,
      reportingPeriod: payload.reportingPeriod,
      countryCode: payload.countryCode,
      legalEntityId: new Uuid(payload.legalEntityId),
    }, command.correlationId);
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
