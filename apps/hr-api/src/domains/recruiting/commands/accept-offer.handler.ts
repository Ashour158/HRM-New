import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { CommandHandler } from '../../../platform/command-bus/command-handler.decorator.js';
import type { CommandHandler as ICommandHandler } from '../../../platform/command-bus/command-bus.js';
import type { HrCommandEnvelope, CommandResult } from '@hcm/command-contracts';
import { Uuid } from '@hcm/shared-kernel';
import { FsmFramework } from '../../../platform/workflow/fsm-framework.js';
import { OfferRepository } from '../repositories/offer.repository.js';
import { CandidateRepository } from '../repositories/candidate.repository.js';
import { JobRequisitionRepository } from '../repositories/job-requisition.repository.js';
import { RecruitingEventsPublisher } from '../events/recruiting-events.publisher.js';

export interface AcceptOfferCommandPayload {
  offerId: Uuid;
  acceptedAt: Date;
}

/**
 * Handler for the AcceptOffer command.
 *
 * Transitions an offer from SENT to ACCEPTED and the candidate to HIRED.
 * Also fills the parent requisition.
 */
@Injectable()
@CommandHandler('AcceptOffer')
export class AcceptOfferHandler implements ICommandHandler {
  readonly commandName = 'AcceptOffer';

  constructor(
    private readonly offerRepo: OfferRepository,
    private readonly candidateRepo: CandidateRepository,
    private readonly requisitionRepo: JobRequisitionRepository,
    private readonly fsm: FsmFramework,
    private readonly eventPublisher: RecruitingEventsPublisher,
  ) {}

  async handle(command: HrCommandEnvelope<unknown>): Promise<CommandResult<unknown>> {
    const payload = command.payload as AcceptOfferCommandPayload;
    const offer = await this.offerRepo.findById(payload.offerId);
    if (!offer) {
      throw new NotFoundException('Offer not found');
    }

    if (offer.status !== 'SENT') {
      throw new BadRequestException('Offer must be in SENT state to be accepted');
    }

    offer.accept(command.correlationId);
    await this.offerRepo.save(offer);
    await this.eventPublisher.publishUncommitted(offer, command.tenantId, command.correlationId);

    const candidate = await this.candidateRepo.findById(offer.candidateId);
    if (candidate) {
      candidate.hire(command.correlationId);
      await this.candidateRepo.save(candidate);
      await this.eventPublisher.publishUncommitted(candidate, command.tenantId, command.correlationId);
    }

    const requisition = await this.requisitionRepo.findById(offer.requisitionId);
    if (requisition && requisition.status === 'OPEN') {
      requisition.fill(command.correlationId);
      await this.requisitionRepo.save(requisition);
      await this.eventPublisher.publishUncommitted(requisition, command.tenantId, command.correlationId);
    }

    return {
      success: true,
      data: { offerId: offer.id.value, status: offer.status },
      commandId: command.commandId,
      correlationId: command.correlationId,
      aggregateId: offer.id,
      newState: offer.status,
      newVersion: offer.aggregateVersion,
      allowedNextActions: this.fsm.getAllowedActionsFromState(offer.status, 'Offer'),
      fieldAccessDecisions: {},
      eventsEmitted: ['OfferAccepted', 'CandidateHired', 'JobRequisitionFilled'],
      auditRecordId: Uuid.generate(),
    };
  }
}
