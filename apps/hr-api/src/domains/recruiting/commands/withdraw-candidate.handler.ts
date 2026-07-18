import { Injectable, NotFoundException } from '@nestjs/common';
import { CommandHandler } from '../../../platform/command-bus/command-handler.decorator.js';
import type { CommandHandler as ICommandHandler } from '../../../platform/command-bus/command-bus.js';
import type { HrCommandEnvelope, CommandResult } from '@hcm/command-contracts';
import { Uuid } from '@hcm/shared-kernel';
import { FsmFramework } from '../../../platform/workflow/fsm-framework.js';
import { CandidateRepository } from '../repositories/candidate.repository.js';
import { RecruitingEventsPublisher } from '../events/recruiting-events.publisher.js';

export interface WithdrawCandidateCommandPayload {
  candidateId: Uuid;
  reason?: string;
}

/**
 * Handler for the WithdrawCandidate command.
 *
 * Moves a candidate to the WITHDRAWN terminal state (candidate-initiated
 * withdrawal). Valid from any non-terminal state (enforced by the
 * aggregate). No fixed `expectedState` is asserted here, matching the
 * CloseJobRequisition convention for multi-state terminal transitions.
 */
@Injectable()
@CommandHandler('WithdrawCandidate')
export class WithdrawCandidateHandler implements ICommandHandler {
  readonly commandName = 'WithdrawCandidate';

  constructor(
    private readonly candidateRepo: CandidateRepository,
    private readonly fsm: FsmFramework,
    private readonly eventPublisher: RecruitingEventsPublisher,
  ) {}

  async handle(command: HrCommandEnvelope<unknown>): Promise<CommandResult<unknown>> {
    const payload = command.payload as WithdrawCandidateCommandPayload;
    const candidate = await this.candidateRepo.findById(payload.candidateId);
    if (!candidate) {
      throw new NotFoundException('Candidate not found');
    }

    candidate.withdraw(command.correlationId);
    await this.candidateRepo.save(candidate);
    await this.eventPublisher.publishUncommitted(candidate, command.tenantId, command.correlationId);

    return {
      success: true,
      data: { candidateId: candidate.id.value, status: candidate.status, reason: payload.reason },
      commandId: command.commandId,
      correlationId: command.correlationId,
      aggregateId: candidate.id,
      newState: candidate.status,
      newVersion: candidate.aggregateVersion,
      allowedNextActions: this.fsm.getAllowedActionsFromState(candidate.status, 'Candidate'),
      fieldAccessDecisions: {},
      eventsEmitted: ['CandidateWithdrew'],
      auditRecordId: Uuid.generate(),
    };
  }
}
