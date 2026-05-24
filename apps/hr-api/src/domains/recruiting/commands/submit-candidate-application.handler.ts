import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { CommandHandler } from '../../../platform/command-bus/command-handler.decorator.js';
import type { CommandHandler as ICommandHandler } from '../../../platform/command-bus/command-bus.js';
import type { HrCommandEnvelope, CommandResult } from '@hcm/command-contracts';
import { Uuid, ValidationError } from '@hcm/shared-kernel';
import { FsmFramework } from '../../../platform/workflow/fsm-framework.js';
import { Candidate } from '../aggregates/candidate.aggregate.js';
import { CandidateRepository } from '../repositories/candidate.repository.js';
import { JobRequisitionRepository } from '../repositories/job-requisition.repository.js';
import { RecruitingEventsPublisher } from '../events/recruiting-events.publisher.js';

export interface SubmitCandidateApplicationCommandPayload {
  applicationId: Uuid;
  requisitionId: Uuid;
  candidateEmail: string;
  candidateName: string;
  firstName?: string;
  lastName?: string;
  phone?: string;
  resumeUrl?: string;
  source?: string;
}

/**
 * Handler for the SubmitCandidateApplication command.
 *
 * Creates a new Candidate against an OPEN requisition.
 */
@Injectable()
@CommandHandler('SubmitCandidateApplication')
export class SubmitCandidateApplicationHandler implements ICommandHandler {
  readonly commandName = 'SubmitCandidateApplication';

  constructor(
    private readonly candidateRepo: CandidateRepository,
    private readonly requisitionRepo: JobRequisitionRepository,
    private readonly fsm: FsmFramework,
    private readonly eventPublisher: RecruitingEventsPublisher,
  ) {}

  async handle(command: HrCommandEnvelope<unknown>): Promise<CommandResult<unknown>> {
    const payload = command.payload as SubmitCandidateApplicationCommandPayload;

    const requisition = await this.requisitionRepo.findById(payload.requisitionId);
    if (!requisition) {
      throw new NotFoundException('Job requisition not found');
    }
    if (requisition.status !== 'OPEN') {
      throw new BadRequestException('Requisition is not open for applications');
    }

    const existing = await this.candidateRepo.findByEmail(payload.candidateEmail);
    if (existing) {
      throw new ValidationError('Candidate with this email already exists');
    }

    const nameParts = payload.candidateName.split(' ');
    const firstName = payload.firstName ?? nameParts[0] ?? 'Unknown';
    const lastName = payload.lastName ?? nameParts.slice(1).join(' ') ?? 'Unknown';

    const candidate = Candidate.create(
      {
        id: payload.applicationId,
        tenantId: command.tenantId,
        firstName,
        lastName,
        email: payload.candidateEmail,
        phone: payload.phone,
        resumeUrl: payload.resumeUrl,
        source: payload.source ?? 'DIRECT',
        requisitionId: payload.requisitionId,
      },
      command.correlationId,
    );

    await this.candidateRepo.save(candidate);
    await this.eventPublisher.publishUncommitted(candidate, command.tenantId, command.correlationId);

    return {
      success: true,
      data: { candidateId: candidate.id.value, status: candidate.status },
      commandId: command.commandId,
      correlationId: command.correlationId,
      aggregateId: candidate.id,
      newState: candidate.status,
      newVersion: candidate.aggregateVersion,
      allowedNextActions: this.fsm.getAllowedActionsFromState(candidate.status, 'Candidate'),
      fieldAccessDecisions: {},
      eventsEmitted: ['CandidateCreated'],
      auditRecordId: Uuid.generate(),
    };
  }
}
