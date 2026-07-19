import { Injectable } from '@nestjs/common';
import { CommandHandler } from '../../../platform/command-bus/command-handler.decorator.js';
import type { HrCommandEnvelope, CommandResult } from '@hcm/command-contracts';
import { Uuid } from '@hcm/shared-kernel';
import { FsmFramework } from '../../../platform/workflow/fsm-framework.js';
import { AttritionSegmentReportRepository } from '../repositories/attrition-segment-report.repository.js';
import { DeiAnalyticsEventsPublisher } from '../events/dei-analytics-events.publisher.js';
import { WorkforceDataService } from '../services/workforce-data.service.js';
import { calculateAttritionSegments, parseReportPeriod } from '../services/attrition-calculator.js';

export interface GenerateAttritionSegmentReportPayload {
  attritionSegmentReportId: string;
}

/**
 * Computes real termination-rate-by-segment statistics for an
 * AttritionSegmentReport from actual worker/termination data over the
 * report's own reportPeriod time window, rather than trusting
 * caller-supplied segments. The caller only identifies which report to
 * generate.
 */
@Injectable()
@CommandHandler('GenerateAttritionSegmentReport')
export class GenerateAttritionSegmentReportHandler {
  constructor(
    private readonly repo: AttritionSegmentReportRepository,
    private readonly fsm: FsmFramework,
    private readonly publisher: DeiAnalyticsEventsPublisher,
    private readonly workforceData: WorkforceDataService,
  ) {}

  async handle(command: HrCommandEnvelope<unknown>): Promise<CommandResult<unknown>> {
    const payload = command.payload as GenerateAttritionSegmentReportPayload;
    const entity = await this.repo.findById(new Uuid(payload.attritionSegmentReportId));
    if (!entity) throw new Error('AttritionSegmentReport not found');

    const window = parseReportPeriod(entity.reportPeriod);
    const workers = await this.workforceData.loadAttritionWorkerRecords(command.tenantId, entity.segmentType);
    const segments = calculateAttritionSegments(workers, window);

    entity.generate(command.correlationId, segments);
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
