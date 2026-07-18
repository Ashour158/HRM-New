import { Injectable, NotFoundException } from '@nestjs/common';
import { CommandHandler } from '../../../platform/command-bus/command-handler.decorator.js';
import type { CommandHandler as ICommandHandler } from '../../../platform/command-bus/command-bus.js';
import type { HrCommandEnvelope, CommandResult } from '@hcm/command-contracts';
import { Uuid } from '@hcm/shared-kernel';
import { FsmFramework } from '../../../platform/workflow/fsm-framework.js';
import { OfferRepository } from '../repositories/offer.repository.js';
import { RecruitingEventsPublisher } from '../events/recruiting-events.publisher.js';

export interface WithdrawOfferCommandPayload {
  offerId: Uuid;
  reason?: string;
}

/**
 * Handler for the WithdrawOffer command.
 *
 * Moves an offer to the WITHDRAWN terminal state (employer-initiated
 * rescission). Valid from DRAFT, PENDING_APPROVAL, APPROVED, or SENT
 * (enforced by the aggregate). No fixed `expectedState` is asserted here
 * because the action is valid from multiple states, matching the
 * CloseJobRequisition convention.
 */
@Injectable()
@CommandHandler('WithdrawOffer')
export class WithdrawOfferHandler implements ICommandHandler {
  readonly commandName = 'WithdrawOffer';

  constructor(
    private readonly offerRepo: OfferRepository,
    private readonly fsm: FsmFramework,
    private readonly eventPublisher: RecruitingEventsPublisher,
  ) {}

  async handle(command: HrCommandEnvelope<unknown>): Promise<CommandResult<unknown>> {
    const payload = command.payload as WithdrawOfferCommandPayload;
    const offer = await this.offerRepo.findById(payload.offerId);
    if (!offer) {
      throw new NotFoundException('Offer not found');
    }

    offer.withdraw(command.correlationId);
    await this.offerRepo.save(offer);
    await this.eventPublisher.publishUncommitted(offer, command.tenantId, command.correlationId);

    return {
      success: true,
      data: { offerId: offer.id.value, status: offer.status, reason: payload.reason },
      commandId: command.commandId,
      correlationId: command.correlationId,
      aggregateId: offer.id,
      newState: offer.status,
      newVersion: offer.aggregateVersion,
      allowedNextActions: this.fsm.getAllowedActionsFromState(offer.status, 'Offer'),
      fieldAccessDecisions: {},
      eventsEmitted: ['OfferWithdrawn'],
      auditRecordId: Uuid.generate(),
    };
  }
}
