import { Injectable } from '@nestjs/common';
import { CommandHandler } from '../../../platform/command-bus/command-handler.decorator.js';
import type { HrCommandEnvelope, CommandResult } from '@hcm/command-contracts';
import { Uuid } from '@hcm/shared-kernel';
import { FsmFramework } from '../../../platform/workflow/fsm-framework.js';
import { Certification } from '../aggregates/certification.aggregate.js';
import { CertificationRepository } from '../repositories/certification.repository.js';
import { LearningEventsPublisher } from '../events/learning-events.publisher.js';

@CommandHandler('CreateCertification')
@Injectable()
export class CreateCertificationHandler {
  constructor(
    private readonly repo: CertificationRepository,
    private readonly fsm: FsmFramework,
    private readonly publisher: LearningEventsPublisher,
  ) {}

  async handle(command: HrCommandEnvelope<unknown>): Promise<CommandResult<unknown>> {
    const payload = command.payload as {
      workerId: Uuid;
      certificationName: string;
      issuingBody?: string;
      issueDate?: Date;
      expiryDate?: Date;
      credentialId?: string;
    };
    const ar = Certification.create(
      {
        id: Uuid.generate(),
        tenantId: command.tenantId,
        workerId: payload.workerId,
        certificationName: payload.certificationName,
        issuingBody: payload.issuingBody,
        issueDate: payload.issueDate,
        expiryDate: payload.expiryDate,
        credentialId: payload.credentialId,
      },
      command.correlationId,
    );
    await this.repo.save(ar);
    await this.publisher.publishFromAggregate(ar);
    return {
      success: true,
      data: { certificationId: ar.id.value, status: ar.status },
      commandId: command.commandId,
      correlationId: command.correlationId,
      aggregateId: ar.id,
      newState: ar.status,
      newVersion: ar.aggregateVersion,
      allowedNextActions: this.fsm.getAllowedActionsFromState(ar.status, 'Certification'),
      eventsEmitted: ar.domainEvents.map((e) => e.eventName),
      auditRecordId: command.commandId,
    } as CommandResult<unknown>;
  }
}
