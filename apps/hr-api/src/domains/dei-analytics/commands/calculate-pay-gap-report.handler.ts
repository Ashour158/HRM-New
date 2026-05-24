import { Injectable } from '@nestjs/common';
import { CommandHandler } from '../../../platform/command-bus/command-handler.decorator.js';
import type { HrCommandEnvelope, CommandResult } from '@hcm/command-contracts';
import { Uuid } from '@hcm/shared-kernel';
import { FsmFramework } from '../../../platform/workflow/fsm-framework.js';
import { PayGapReportRepository } from '../repositories/pay-gap-report.repository.js';
import { DeiAnalyticsEventsPublisher } from '../events/dei-analytics-events.publisher.js';

export interface CalculatePayGapReportPayload {
  payGapReportId: string;
  meanHourlyGap: number;
  medianHourlyGap: number;
  quartileDistribution: Record<string, unknown>;
}

@Injectable()
@CommandHandler('CalculatePayGapReport')
export class CalculatePayGapReportHandler {
  constructor(
    private readonly repo: PayGapReportRepository,
    private readonly fsm: FsmFramework,
    private readonly publisher: DeiAnalyticsEventsPublisher,
  ) {}

  async handle(command: HrCommandEnvelope<unknown>): Promise<CommandResult<unknown>> {
    const payload = command.payload as CalculatePayGapReportPayload;
    const entity = await this.repo.findById(new Uuid(payload.payGapReportId));
    if (!entity) throw new Error('PayGapReport not found');
    entity.calculate(command.correlationId, payload.meanHourlyGap, payload.medianHourlyGap, payload.quartileDistribution);
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
