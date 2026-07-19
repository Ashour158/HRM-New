import { Injectable, NotFoundException } from '@nestjs/common';
import { CommandHandler } from '../../../platform/command-bus/command-handler.decorator.js';
import type { CommandHandler as ICommandHandler } from '../../../platform/command-bus/command-bus.js';
import type { HrCommandEnvelope, CommandResult } from '@hcm/command-contracts';
import { Uuid } from '@hcm/shared-kernel';
import { FsmFramework } from '../../../platform/workflow/fsm-framework.js';
import { CandidateRepository } from '../repositories/candidate.repository.js';
import { RecruitingEventsPublisher } from '../events/recruiting-events.publisher.js';

export interface RejectCandidateCommandPayload {
  applicationId: Uuid;
  reason?: string;
}

/**
 * Handler for the RejectCandidate command.
 *
 * Moves a candidate to the REJECTED terminal state. Valid from NEW,
 * SCREENING, INTERVIEWING, or OFFER_PENDING (enforced by the aggregate).
 * No fixed `expectedState` is asserted here because the action is valid
 * from multiple states, matching the CloseJobRequisition convention.
 */
@Injectable()
@CommandHandler('RejectCandidate')
export class RejectCandidateHandler implements ICommandHandler {
  readonly commandName = 'RejectCandidate';

  constructor(
    private readonly candidateRepo: CandidateRepository,
    private readonly fsm: FsmFramework,
    private readonly eventPublisher: RecruitingEventsPublisher,
  ) {}

  async handle(command: HrCommandEnvelope<unknown>): Promise<CommandResult<unknown>> {
    const payload = command.payload as RejectCandidateCommandPayload;
    const candidate = await this.candidateRepo.findById(payload.applicationId);
    if (!candidate) {
      throw new NotFoundException('Candidate not found');
    }

    if (candidate.status === 'REJECTED') {
      // Idempotent retry: the candidate is already in the target terminal
      // state, so return the existing outcome instead of re-invoking
      // `reject()`, which would throw ConflictError on a retried command.
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
        eventsEmitted: [],
        auditRecordId: command.commandId,
      };
    }

    candidate.reject(command.correlationId);
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
      eventsEmitted: ['CandidateRejected'],
      auditRecordId: command.commandId,
    };
  }
}
