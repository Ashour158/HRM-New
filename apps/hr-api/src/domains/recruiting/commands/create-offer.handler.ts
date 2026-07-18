import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { CommandHandler } from '../../../platform/command-bus/command-handler.decorator.js';
import type { CommandHandler as ICommandHandler } from '../../../platform/command-bus/command-bus.js';
import type { HrCommandEnvelope, CommandResult } from '@hcm/command-contracts';
import { Uuid } from '@hcm/shared-kernel';
import { FsmFramework } from '../../../platform/workflow/fsm-framework.js';
import { Offer } from '../aggregates/offer.aggregate.js';
import { OfferRepository } from '../repositories/offer.repository.js';
import { CandidateRepository } from '../repositories/candidate.repository.js';
import { RecruitingEventsPublisher } from '../events/recruiting-events.publisher.js';

export interface CreateOfferCommandPayload {
  offerId: Uuid;
  applicationId: Uuid;
  proposedSalary: number;
  currency: string;
  startDate: Date;
  benefitsPackage?: Record<string, unknown>;
}

/**
 * Handler for the CreateOffer command.
 *
 * Creates a new Offer in DRAFT state for a candidate.
 */
@Injectable()
@CommandHandler('CreateOffer')
export class CreateOfferHandler implements ICommandHandler {
  readonly commandName = 'CreateOffer';

  constructor(
    private readonly offerRepo: OfferRepository,
    private readonly candidateRepo: CandidateRepository,
    private readonly fsm: FsmFramework,
    private readonly eventPublisher: RecruitingEventsPublisher,
  ) {}

  async handle(command: HrCommandEnvelope<unknown>): Promise<CommandResult<unknown>> {
    const payload = command.payload as CreateOfferCommandPayload;
    const candidate = await this.candidateRepo.findById(payload.applicationId);
    if (!candidate) {
      throw new NotFoundException('Candidate not found');
    }

    if (candidate.status !== 'INTERVIEWING') {
      throw new BadRequestException('Candidate must be in INTERVIEWING state to create an offer');
    }

    const offer = Offer.create(
      {
        id: payload.offerId,
        tenantId: command.tenantId,
        candidateId: candidate.id,
        requisitionId: candidate.requisitionId,
        proposedSalary: payload.proposedSalary,
        currency: payload.currency,
        startDate: payload.startDate,
        benefitsPackage: payload.benefitsPackage,
      },
      command.correlationId,
    );

    await this.offerRepo.save(offer);
    await this.eventPublisher.publishUncommitted(offer, command.tenantId, command.correlationId);

    // Move the candidate to OFFER_PENDING alongside offer creation. Without
    // this transition the candidate remains stuck in INTERVIEWING and
    // AcceptOffer's later `candidate.hire()` call (which requires
    // OFFER_PENDING) can never succeed — mirrors the ScheduleInterview
    // handler's pattern of driving the parallel candidate transition.
    candidate.makeOfferPending(command.correlationId);
    await this.candidateRepo.save(candidate);
    await this.eventPublisher.publishUncommitted(candidate, command.tenantId, command.correlationId);

    return {
      success: true,
      data: { offerId: offer.id.value, status: offer.status, candidateId: candidate.id.value },
      commandId: command.commandId,
      correlationId: command.correlationId,
      aggregateId: offer.id,
      newState: offer.status,
      newVersion: offer.aggregateVersion,
      allowedNextActions: this.fsm.getAllowedActionsFromState(offer.status, 'Offer'),
      fieldAccessDecisions: {},
      eventsEmitted: ['OfferCreated', 'CandidateOfferPending'],
      auditRecordId: Uuid.generate(),
    };
  }
}
