import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { CommandHandler } from '../../../platform/command-bus/command-handler.decorator.js';
import type { CommandHandler as ICommandHandler } from '../../../platform/command-bus/command-bus.js';
import type { HrCommandEnvelope, CommandResult } from '@hcm/command-contracts';
import { Uuid } from '@hcm/shared-kernel';
import { FsmFramework } from '../../../platform/workflow/fsm-framework.js';
import { OfferRepository } from '../repositories/offer.repository.js';
import { OfferCompensationGateService } from '../services/offer-compensation-gate.service.js';
import { RecruitingEventsPublisher } from '../events/recruiting-events.publisher.js';

export interface ApproveOfferCommandPayload {
  offerId: Uuid;
}

/**
 * Handler for the ApproveOffer command.
 *
 * Transitions an offer from PENDING_APPROVAL to APPROVED.
 * SoD is enforced inside the aggregate (approver ≠ proposer).
 *
 * Before approving, the `offer-compensation` policy engine is re-run (via
 * {@link OfferCompensationGateService}) against the offer's current
 * proposed salary and the *current* compensation band for its position —
 * band data (min/mid/max) can change between offer creation and approval
 * (e.g. a band revision), so the gate is re-verified rather than trusting
 * the decision computed at creation time. A BLOCKING result (invalid/
 * missing band, currency mismatch) fails approval closed. A WARNING result
 * (out of band, pay-equity deviation — decisionCode CONDITIONAL) does not
 * block approval: the SoD-gated human approval performed here — a distinct
 * approver reviewing and accepting the offer — is itself the "requires
 * additional approval" step the engine calls for, so approval proceeds and
 * the decision is surfaced in the result for audit/UI visibility.
 */
@Injectable()
@CommandHandler('ApproveOffer')
export class ApproveOfferHandler implements ICommandHandler {
  readonly commandName = 'ApproveOffer';

  constructor(
    private readonly offerRepo: OfferRepository,
    private readonly compensationGate: OfferCompensationGateService,
    private readonly fsm: FsmFramework,
    private readonly eventPublisher: RecruitingEventsPublisher,
  ) {}

  async handle(command: HrCommandEnvelope<unknown>): Promise<CommandResult<unknown>> {
    const payload = command.payload as ApproveOfferCommandPayload;
    const offer = await this.offerRepo.findById(payload.offerId);
    if (!offer) {
      throw new NotFoundException('Offer not found');
    }

    const compensationDecision = await this.compensationGate.evaluate(
      offer.requisitionId,
      offer.proposedSalary,
      offer.currency,
    );

    if (compensationDecision.decisionCode === 'REJECTED') {
      throw new BadRequestException(
        `Cannot approve offer: ${compensationDecision.violations.map((v) => v.message).join(' ')}`,
      );
    }

    offer.approve(command.actor.actorId, command.correlationId);
    await this.offerRepo.save(offer);
    await this.eventPublisher.publishUncommitted(offer, command.tenantId, command.correlationId);

    return {
      success: true,
      data: { offerId: offer.id.value, status: offer.status, compensationDecision },
      commandId: command.commandId,
      correlationId: command.correlationId,
      aggregateId: offer.id,
      newState: offer.status,
      newVersion: offer.aggregateVersion,
      allowedNextActions: this.fsm.getAllowedActionsFromState(offer.status, 'Offer'),
      fieldAccessDecisions: {},
      eventsEmitted: ['OfferApproved'],
      auditRecordId: Uuid.generate(),
    };
  }
}
