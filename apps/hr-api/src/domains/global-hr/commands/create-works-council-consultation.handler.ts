import { Injectable } from '@nestjs/common';
import { CommandHandler } from '../../../platform/command-bus/command-handler.decorator.js';
import type { HrCommandEnvelope, CommandResult } from '@hcm/command-contracts';
import type { CommandHandler as ICommandHandler } from '../../../platform/command-bus/command-bus.js';
import { Uuid } from '@hcm/shared-kernel';
import { WorksCouncilConsultation } from '../aggregates/works-council-consultation.aggregate.js';
import { WorksCouncilConsultationRepository } from '../repositories/works-council-consultation.repository.js';
import { GlobalHrEventsPublisher } from '../events/global-hr-events.publisher.js';

export interface CreateWorksCouncilConsultationPayload {
  consultationId: string;
  countryCode: string;
  legalEntityId: string;
  actionType: string;
  consultationType: string;
  deadlineDate?: Date;
}

/**
 * Handler for the CreateWorksCouncilConsultation command.
 */
@Injectable()
@CommandHandler('CreateWorksCouncilConsultation')
export class CreateWorksCouncilConsultationHandler implements ICommandHandler {
  readonly commandName = 'CreateWorksCouncilConsultation';

  constructor(
    private readonly repo: WorksCouncilConsultationRepository,
    private readonly eventsPublisher: GlobalHrEventsPublisher,
  ) {}

  async handle(command: HrCommandEnvelope<unknown>): Promise<CommandResult<unknown>> {
    const payload = command.payload as CreateWorksCouncilConsultationPayload;

    const consultation = WorksCouncilConsultation.create(
      {
        id: new Uuid(payload.consultationId),
        tenantId: command.tenantId,
        countryCode: payload.countryCode,
        legalEntityId: new Uuid(payload.legalEntityId),
        actionType: payload.actionType,
        consultationType: payload.consultationType,
        deadlineDate: payload.deadlineDate,
      },
      command.correlationId,
    );

    await this.repo.save(consultation);
    await this.eventsPublisher.publishUncommitted(consultation, command.tenantId, command.correlationId);

    return {
      success: true,
      data: { consultationId: consultation.id.value, status: consultation.status },
      commandId: command.commandId,
      correlationId: command.correlationId,
      aggregateId: consultation.id,
      newState: consultation.status,
      newVersion: consultation.aggregateVersion,
      allowedNextActions: ['InitiateWorksCouncilConsultation'],
      fieldAccessDecisions: {},
      eventsEmitted: consultation.domainEvents.map((e) => e.eventName),
      auditRecordId: Uuid.generate(),
    };
  }
}
