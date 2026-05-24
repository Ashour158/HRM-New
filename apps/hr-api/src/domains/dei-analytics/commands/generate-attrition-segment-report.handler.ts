import { Injectable } from '@nestjs/common';
import { CommandHandler } from '../../../platform/command-bus/command-handler.decorator.js';
import type { HrCommandEnvelope, CommandResult } from '@hcm/command-contracts';
import { Uuid } from '@hcm/shared-kernel';
import { FsmFramework } from '../../../platform/workflow/fsm-framework.js';
import { AttritionSegmentReportRepository } from '../repositories/attrition-segment-report.repository.js';
import { DeiAnalyticsEventsPublisher } from '../events/dei-analytics-events.publisher.js';

export interface GenerateAttritionSegmentReportPayload {
  attritionSegmentReportId: string;
  segments: Record<string, unknown>;
}

@Injectable()
@CommandHandler('GenerateAttritionSegmentReport')
export class GenerateAttritionSegmentReportHandler {
  constructor(
    private readonly repo: AttritionSegmentReportRepository,
    private readonly fsm: FsmFramework,
    private readonly publisher: DeiAnalyticsEventsPublisher,
  ) {}

  async handle(command: HrCommandEnvelope<unknown>): Promise<CommandResult<unknown>> {
    const payload = command.payload as GenerateAttritionSegmentReportPayload;
    const entity = await this.repo.findById(new Uuid(payload.attritionSegmentReportId));
    if (!entity) throw new Error('AttritionSegmentReport not found');
    entity.generate(command.correlationId, payload.segments);
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
