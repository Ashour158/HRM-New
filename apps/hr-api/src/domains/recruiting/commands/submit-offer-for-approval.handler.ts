import { Injectable, NotFoundException } from '@nestjs/common';
import { CommandHandler } from '../../../platform/command-bus/command-handler.decorator.js';
import type { CommandHandler as ICommandHandler } from '../../../platform/command-bus/command-bus.js';
import type { HrCommandEnvelope, CommandResult } from '@hcm/command-contracts';
import { Uuid } from '@hcm/shared-kernel';
import { FsmFramework } from '../../../platform/workflow/fsm-framework.js';
import { OfferRepository } from '../repositories/offer.repository.js';
import { RecruitingEventsPublisher } from '../events/recruiting-events.publisher.js';

export interface SubmitOfferForApprovalCommandPayload {
  offerId: Uuid;
}

/**
 * Handler for the SubmitOfferForApproval command.
 *
 * Transitions an offer from DRAFT to PENDING_APPROVAL and records the
 * proposer (used by Offer.approve()'s SoD check: approver cannot be the
 * proposer). Without this handler, ApproveOffer (which requires
 * PENDING_APPROVAL) could never succeed -- an offer created via
 * CreateOffer had no way to leave DRAFT (HCM-P0-7).
 */
@Injectable()
@CommandHandler('SubmitOfferForApproval')
export class SubmitOfferForApprovalHandler implements ICommandHandler {
  readonly commandName = 'SubmitOfferForApproval';

  constructor(
    private readonly offerRepo: OfferRepository,
    private readonly fsm: FsmFramework,
    private readonly eventPublisher: RecruitingEventsPublisher,
  ) {}

  async handle(command: HrCommandEnvelope<unknown>): Promise<CommandResult<unknown>> {
    const payload = command.payload as SubmitOfferForApprovalCommandPayload;
    const offer = await this.offerRepo.findById(payload.offerId);
    if (!offer) {
      throw new NotFoundException('Offer not found');
    }

    offer.submitForApproval(command.actor.actorId, command.correlationId);
    await this.offerRepo.save(offer);
    await this.eventPublisher.publishUncommitted(offer, command.tenantId, command.correlationId);

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
      eventsEmitted: ['OfferSubmitted'],
      auditRecordId: Uuid.generate(),
    };
  }
}
