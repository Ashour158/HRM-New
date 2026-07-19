import { Injectable } from '@nestjs/common';
import { CommandHandler } from '../../../platform/command-bus/command-handler.decorator.js';
import type { HrCommandEnvelope, CommandResult } from '@hcm/command-contracts';
import { Uuid } from '@hcm/shared-kernel';
import { FsmFramework } from '../../../platform/workflow/fsm-framework.js';
import { PayGapReportRepository } from '../repositories/pay-gap-report.repository.js';
import { DeiAnalyticsEventsPublisher } from '../events/dei-analytics-events.publisher.js';
import { PayGapCalculationService } from '../services/pay-gap-calculation.service.js';

/**
 * The caller only identifies WHICH report to calculate. `meanHourlyGap`,
 * `medianHourlyGap`, and `quartileDistribution` used to be caller-supplied
 * numbers with no underlying data trail; they are now computed by
 * {@link PayGapCalculationService} from real worker compensation and
 * self-identification records, scoped by the report's own tenant/country/
 * report-type (set when the report was created).
 */
export interface CalculatePayGapReportPayload {
  payGapReportId: string;
}

/**
 * Computes real mean/median hourly pay-gap statistics for a PayGapReport
 * from actual worker + compensation data (scoped by the report's own
 * reportType/reportingYear/countryCode), rather than trusting caller-supplied
 * numbers. The caller only identifies which report to calculate.
 */
@Injectable()
@CommandHandler('CalculatePayGapReport')
export class CalculatePayGapReportHandler {
  constructor(
    private readonly repo: PayGapReportRepository,
    private readonly fsm: FsmFramework,
    private readonly publisher: DeiAnalyticsEventsPublisher,
    private readonly calculationService: PayGapCalculationService,
  ) {}

  async handle(command: HrCommandEnvelope<unknown>): Promise<CommandResult<unknown>> {
    const payload = command.payload as CalculatePayGapReportPayload;
    const entity = await this.repo.findById(new Uuid(payload.payGapReportId));
    if (!entity) throw new Error('PayGapReport not found');
    const { meanHourlyGap, medianHourlyGap, quartileDistribution } = await this.calculationService.computeForReport(entity);
    entity.calculate(command.correlationId, meanHourlyGap, medianHourlyGap, quartileDistribution);
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
