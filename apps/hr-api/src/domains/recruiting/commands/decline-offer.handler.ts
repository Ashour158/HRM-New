import { Injectable, NotFoundException } from '@nestjs/common';
import { CommandHandler } from '../../../platform/command-bus/command-handler.decorator.js';
import type { CommandHandler as ICommandHandler } from '../../../platform/command-bus/command-bus.js';
import type { HrCommandEnvelope, CommandResult } from '@hcm/command-contracts';
import { Uuid } from '@hcm/shared-kernel';
import { FsmFramework } from '../../../platform/workflow/fsm-framework.js';
import { OfferRepository } from '../repositories/offer.repository.js';
import { RecruitingEventsPublisher } from '../events/recruiting-events.publisher.js';

export interface DeclineOfferCommandPayload {
  offerId: Uuid;
  reason: string;
}

/**
 * Handler for the DeclineOffer command.
 *
 * Transitions an offer from SENT to DECLINED (terminal). Candidate-facing
 * flows (e.g. moving the candidate application forward) are intentionally
 * out of scope here, matching the narrow, single-aggregate convention used
 * by ApproveOffer and SendOffer.
 */
@Injectable()
@CommandHandler('DeclineOffer')
export class DeclineOfferHandler implements ICommandHandler {
  readonly commandName = 'DeclineOffer';

  constructor(
    private readonly offerRepo: OfferRepository,
    private readonly fsm: FsmFramework,
    private readonly eventPublisher: RecruitingEventsPublisher,
  ) {}

  async handle(command: HrCommandEnvelope<unknown>): Promise<CommandResult<unknown>> {
    const payload = command.payload as DeclineOfferCommandPayload;
    const offer = await this.offerRepo.findById(payload.offerId);
    if (!offer) {
      throw new NotFoundException('Offer not found');
    }

    if (offer.status === 'DECLINED') {
      // Idempotent retry: the offer is already in the target terminal
      // state, so return the existing outcome instead of re-invoking
      // `decline()`, which would throw ConflictError on a retried command.
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
        eventsEmitted: [],
        auditRecordId: command.commandId,
      };
    }

    offer.decline(command.correlationId);
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
      eventsEmitted: ['OfferDeclined'],
      auditRecordId: command.commandId,
    };
  }
}
