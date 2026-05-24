import { Injectable } from '@nestjs/common';
import { CommandHandler } from '../../../platform/command-bus/command-handler.decorator.js';
import type { HrCommandEnvelope, CommandResult } from '@hcm/command-contracts';
import { Uuid } from '@hcm/shared-kernel';
import { FsmFramework } from '../../../platform/workflow/fsm-framework.js';
import { AttritionSegmentReport } from '../aggregates/attrition-segment-report.aggregate.js';
import { AttritionSegmentReportRepository } from '../repositories/attrition-segment-report.repository.js';
import { DeiAnalyticsEventsPublisher } from '../events/dei-analytics-events.publisher.js';

export interface CreateAttritionSegmentReportPayload {
  attritionSegmentReportId: string;
  reportPeriod: string;
  segmentType: string;
}

@Injectable()
@CommandHandler('CreateAttritionSegmentReport')
export class CreateAttritionSegmentReportHandler {
  constructor(
    private readonly repo: AttritionSegmentReportRepository,
    private readonly fsm: FsmFramework,
    private readonly publisher: DeiAnalyticsEventsPublisher,
  ) {}

  async handle(command: HrCommandEnvelope<unknown>): Promise<CommandResult<unknown>> {
    const payload = command.payload as CreateAttritionSegmentReportPayload;
    const entity = AttritionSegmentReport.create({
      id: new Uuid(payload.attritionSegmentReportId),
      tenantId: command.tenantId,
      reportPeriod: payload.reportPeriod,
      segmentType: payload.segmentType,
    }, command.correlationId);
    await this.repo.save(entity);
    await this.publisher.publishFromAggregate(entity);
    return {
      success: true,
      data: { attritionSegmentReportId: entity.id.value, status: entity.status },
      commandId: command.commandId,
      correlationId: command.correlationId,
      aggregateId: entity.id,
      newState: entity.status,
      newVersion: entity.aggregateVersion,
      allowedNextActions: this.fsm.getAllowedActionsFromState(entity.status, 'AttritionSegmentReport'),
      fieldAccessDecisions: {},
      eventsEmitted: entity.domainEvents.map((e) => e.eventName),
      auditRecordId: Uuid.generate(),
    };
  }
}
