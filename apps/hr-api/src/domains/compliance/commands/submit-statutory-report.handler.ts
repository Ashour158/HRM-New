import { Injectable } from '@nestjs/common';
import { CommandHandler } from '../../../platform/command-bus/command-handler.decorator.js';
import type { HrCommandEnvelope, CommandResult } from '@hcm/command-contracts';
import type { CommandHandler as ICommandHandler } from '../../../platform/command-bus/command-bus.js';
import { Uuid, ValidationError } from '@hcm/shared-kernel';
import { HcmSetupService } from '../../hcm-setup/hcm-setup.service.js';
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
    private readonly hcmSetupService: HcmSetupService,
  ) {}

  async handle(command: HrCommandEnvelope<unknown>): Promise<CommandResult<unknown>> {
    const payload = command.payload as SubmitStatutoryReportPayload;
    const setup = await this.hcmSetupService.getSetup(command.tenantId);
    const runtime = (setup.compliancePolicyRuntime ?? {}) as {
      statutoryReportingEnabled?: boolean;
      allowedCountryCodes?: string[];
      allowedReportTypes?: string[];
      policyEvidenceRevisionId?: string;
    };
    if (runtime.statutoryReportingEnabled === false) {
      throw new ValidationError('Statutory reporting is disabled by the applied compliance policy');
    }
    if (runtime.allowedCountryCodes?.length && !runtime.allowedCountryCodes.includes(payload.countryCode)) {
      throw new ValidationError(`Country ${payload.countryCode} is not enabled by the applied compliance policy`);
    }
    if (runtime.allowedReportTypes?.length && !runtime.allowedReportTypes.includes(payload.reportType)) {
      throw new ValidationError(`Report type ${payload.reportType} is not enabled by the applied compliance policy`);
    }

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
      data: {
        reportId: report.id.value,
        status: report.status,
        policyEvidence: {
          engine: 'CompliancePolicyRuntimeGate',
          revisionId: runtime.policyEvidenceRevisionId,
          statutoryReportingEnabled: runtime.statutoryReportingEnabled ?? true,
          allowedCountryCodes: runtime.allowedCountryCodes,
          allowedReportTypes: runtime.allowedReportTypes,
        },
      },
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
