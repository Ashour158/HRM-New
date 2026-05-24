import { Injectable } from '@nestjs/common';
import { CommandHandler } from '../../../platform/command-bus/command-handler.decorator.js';
import type { HrCommandEnvelope, CommandResult } from '@hcm/command-contracts';
import type { CommandHandler as ICommandHandler } from '../../../platform/command-bus/command-bus.js';
import { Uuid } from '@hcm/shared-kernel';
import { StatutoryReport } from '../aggregates/statutory-report.aggregate.js';
import { StatutoryReportRepository } from '../repositories/statutory-report.repository.js';
import { ComplianceEventsPublisher } from '../events/compliance-events.publisher.js';

export interface SubmitStatutoryReportPayload {
  reportId: string;
  reportType: string;
  reportingPeriod: string;
  countryCode: string;
  legalEntityId: string;
  content: Record<string, unknown>;
}

/**
 * Handler for the SubmitStatutoryReport command.
 */
@Injectable()
@CommandHandler('SubmitStatutoryReport')
export class SubmitStatutoryReportHandler implements ICommandHandler {
  readonly commandName = 'SubmitStatutoryReport';

  constructor(
    private readonly repo: StatutoryReportRepository,
    private readonly eventsPublisher: ComplianceEventsPublisher,
  ) {}

  async handle(command: HrCommandEnvelope<unknown>): Promise<CommandResult<unknown>> {
    const payload = command.payload as SubmitStatutoryReportPayload;

    const report = StatutoryReport.create(
      {
        id: new Uuid(payload.reportId),
        tenantId: command.tenantId,
        reportType: payload.reportType,
        reportingPeriod: payload.reportingPeriod,
        countryCode: payload.countryCode,
        legalEntityId: new Uuid(payload.legalEntityId),
        content: payload.content,
      },
      command.correlationId,
    );

    await this.repo.save(report);
    await this.eventsPublisher.publishUncommitted(report, command.tenantId, command.correlationId);

    return {
      success: true,
      data: { reportId: report.id.value, status: report.status },
      commandId: command.commandId,
      correlationId: command.correlationId,
      aggregateId: report.id,
      newState: report.status,
      newVersion: report.aggregateVersion,
      allowedNextActions: ['ValidateStatutoryReport'],
      fieldAccessDecisions: {},
      eventsEmitted: report.domainEvents.map((e) => e.eventName),
      auditRecordId: Uuid.generate(),
    };
  }
}
