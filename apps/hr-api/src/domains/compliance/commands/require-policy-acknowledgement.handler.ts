import { Injectable } from '@nestjs/common';
import { CommandHandler } from '../../../platform/command-bus/command-handler.decorator.js';
import type { HrCommandEnvelope, CommandResult } from '@hcm/command-contracts';
import type { CommandHandler as ICommandHandler } from '../../../platform/command-bus/command-bus.js';
import { Uuid, ValidationError } from '@hcm/shared-kernel';
import { HcmSetupService } from '../../hcm-setup/hcm-setup.service.js';
import { PolicyAcknowledgement } from '../aggregates/policy-acknowledgement.aggregate.js';
import { PolicyAcknowledgementRepository } from '../repositories/policy-acknowledgement.repository.js';
import { ComplianceEventsPublisher } from '../events/compliance-events.publisher.js';

export interface RequirePolicyAcknowledgementPayload {
  requirementId: string;
  workerId: string;
  policyDocumentId: string;
  dueDate: Date;
}

/**
 * Handler for the RequirePolicyAcknowledgement command.
 */
@Injectable()
@CommandHandler('RequirePolicyAcknowledgement')
export class RequirePolicyAcknowledgementHandler implements ICommandHandler {
  readonly commandName = 'RequirePolicyAcknowledgement';

  constructor(
    private readonly repo: PolicyAcknowledgementRepository,
    private readonly eventsPublisher: ComplianceEventsPublisher,
    private readonly hcmSetupService: HcmSetupService,
  ) {}

  async handle(command: HrCommandEnvelope<unknown>): Promise<CommandResult<unknown>> {
    const payload = command.payload as RequirePolicyAcknowledgementPayload;
    const dueDate = payload.dueDate instanceof Date ? payload.dueDate : new Date(payload.dueDate);
    const setup = await this.hcmSetupService.getSetup(command.tenantId);
    const runtime = (setup.compliancePolicyRuntime ?? {}) as {
      acknowledgementWorkflowEnabled?: boolean;
      minimumAcknowledgementDays?: number;
      policyEvidenceRevisionId?: string;
    };
    if (runtime.acknowledgementWorkflowEnabled === false) {
      throw new ValidationError('Policy acknowledgements are disabled by the applied compliance policy');
    }
    const minimumDays = runtime.minimumAcknowledgementDays;
    if (typeof minimumDays === 'number' && minimumDays > 0) {
      const earliestDueDate = new Date(Date.now() + minimumDays * 86400000);
      if (dueDate.getTime() < earliestDueDate.getTime()) {
        throw new ValidationError(`Acknowledgement due date is earlier than the applied compliance policy minimum of ${minimumDays} days`);
      }
    }

    const ack = PolicyAcknowledgement.create(
      {
        id: new Uuid(payload.requirementId),
        tenantId: command.tenantId,
        workerId: new Uuid(payload.workerId),
        policyDocumentId: new Uuid(payload.policyDocumentId),
        dueDate,
      },
      command.correlationId,
    );

    await this.repo.save(ack);
    await this.eventsPublisher.publishUncommitted(ack, command.tenantId, command.correlationId);

    return {
      success: true,
      data: {
        requirementId: ack.id.value,
        status: ack.status,
        policyEvidence: {
          engine: 'CompliancePolicyRuntimeGate',
          revisionId: runtime.policyEvidenceRevisionId,
          acknowledgementWorkflowEnabled: runtime.acknowledgementWorkflowEnabled ?? true,
          minimumAcknowledgementDays: runtime.minimumAcknowledgementDays,
        },
      },
      commandId: command.commandId,
      correlationId: command.correlationId,
      aggregateId: ack.id,
      newState: ack.status,
      newVersion: ack.aggregateVersion,
      allowedNextActions: ['RecordPolicyAcknowledgement', 'MarkOverdue'],
      fieldAccessDecisions: {},
      eventsEmitted: ack.domainEvents.map((e) => e.eventName),
      auditRecordId: Uuid.generate(),
    };
  }
}
