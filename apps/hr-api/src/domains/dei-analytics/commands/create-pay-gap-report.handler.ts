import { Injectable } from '@nestjs/common';
import { CommandHandler } from '../../../platform/command-bus/command-handler.decorator.js';
import type { HrCommandEnvelope, CommandResult } from '@hcm/command-contracts';
import { Uuid } from '@hcm/shared-kernel';
import { FsmFramework } from '../../../platform/workflow/fsm-framework.js';
import { PayGapReport } from '../aggregates/pay-gap-report.aggregate.js';
import { PayGapReportRepository } from '../repositories/pay-gap-report.repository.js';
import { DeiAnalyticsEventsPublisher } from '../events/dei-analytics-events.publisher.js';

export interface CreatePayGapReportPayload {
  payGapReportId: string;
  reportType: 'GENDER_PAY_GAP' | 'ETHNICITY_PAY_GAP';
  reportingYear: number;
  countryCode: string;
}

@Injectable()
@CommandHandler('CreatePayGapReport')
export class CreatePayGapReportHandler {
  constructor(
    private readonly repo: PayGapReportRepository,
    private readonly fsm: FsmFramework,
    private readonly publisher: DeiAnalyticsEventsPublisher,
  ) {}

  async handle(command: HrCommandEnvelope<unknown>): Promise<CommandResult<unknown>> {
    const payload = command.payload as CreatePayGapReportPayload;
    const entity = PayGapReport.create({
      id: new Uuid(payload.payGapReportId),
      tenantId: command.tenantId,
      reportType: payload.reportType,
      reportingYear: payload.reportingYear,
      countryCode: payload.countryCode,
    }, command.correlationId);
    await this.repo.save(entity);
    await this.publisher.publishFromAggregate(entity);
    return {
      success: true,
      data: { payGapReportId: entity.id.value, status: entity.status },
      commandId: command.commandId,
      correlationId: command.correlationId,
      aggregateId: entity.id,
      newState: entity.status,
      newVersion: entity.aggregateVersion,
      allowedNextActions: this.fsm.getAllowedActionsFromState(entity.status, 'PayGapReport'),
      fieldAccessDecisions: {},
      eventsEmitted: entity.domainEvents.map((e) => e.eventName),
      auditRecordId: Uuid.generate(),
    };
  }
}
