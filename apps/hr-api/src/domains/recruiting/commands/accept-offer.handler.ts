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
 *
 * Three aggregates (Offer, Candidate, JobRequisition) are saved in one
 * handler. `OfferRepository`, `CandidateRepository`, and
 * `JobRequisitionRepository` all join the ambient command-bus transaction
 * via `resolveTransactionAwareExecutor` (see the `executor` getter on each),
 * so a failure partway through rolls back every write already performed in
 * this handler instead of leaving a partially-completed workflow.
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

    // Track which of the two downstream transitions actually happened, so
    // `eventsEmitted` below (which becomes the outbox payload's event list —
    // see the NOTE further down) never claims a CandidateHired or
    // JobRequisitionFilled event that didn't really occur. Before this fix,
    // both were unconditionally included even when the candidate lookup
    // missed or the requisition wasn't OPEN, which would falsely notify the
    // offer-to-hire saga's JobRequisitionFilled consumer (bulk-reject) for a
    // requisition that was never actually filled.
    const eventsEmitted = ['OfferAccepted'];

    const candidate = await this.candidateRepo.findById(offer.candidateId);
    if (candidate) {
      candidate.hire(command.correlationId);
      await this.candidateRepo.save(candidate);
      await this.eventPublisher.publishUncommitted(candidate, command.tenantId, command.correlationId);
      eventsEmitted.push('CandidateHired');
    }

    const requisition = await this.requisitionRepo.findById(offer.requisitionId);
    if (requisition && requisition.status === 'OPEN') {
      requisition.fill(command.correlationId);
      await this.requisitionRepo.save(requisition);
      await this.eventPublisher.publishUncommitted(requisition, command.tenantId, command.correlationId);
      eventsEmitted.push('JobRequisitionFilled');
    }

    return {
      success: true,
      // NOTE: this single `data` object becomes the outbox payload for every
      // event name listed in `eventsEmitted` below (see
      // CommandBus.stepWriteOutbox). The offer-to-hire saga's
      // `isOfferAcceptedEvent` guard requires `offerId` + `acceptedBy` to be
      // present here — without `acceptedBy` the guard fails validation and
      // the saga silently never fires, even though an `OfferAccepted` row is
      // written. `requisitionId` is included so a JobRequisitionFilled
      // consumer (see offer-to-hire.saga.ts's onJobRequisitionFilled) can
      // resolve which requisition's remaining candidates to bulk-reject.
      data: {
        offerId: offer.id.value,
        status: offer.status,
        acceptedBy: command.actor.actorId.value,
        candidateId: offer.candidateId.value,
        requisitionId: offer.requisitionId.value,
      },
      commandId: command.commandId,
      correlationId: command.correlationId,
      aggregateId: offer.id,
      newState: offer.status,
      newVersion: offer.aggregateVersion,
      allowedNextActions: this.fsm.getAllowedActionsFromState(offer.status, 'Offer'),
      fieldAccessDecisions: {},
      eventsEmitted,
      auditRecordId: command.commandId,
    };
  }
}
