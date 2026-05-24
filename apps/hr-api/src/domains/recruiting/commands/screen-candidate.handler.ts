import { Injectable, NotFoundException } from '@nestjs/common';
import { CommandHandler } from '../../../platform/command-bus/command-handler.decorator.js';
import type { CommandHandler as ICommandHandler } from '../../../platform/command-bus/command-bus.js';
import type { HrCommandEnvelope, CommandResult } from '@hcm/command-contracts';
import { Uuid } from '@hcm/shared-kernel';
import { FsmFramework } from '../../../platform/workflow/fsm-framework.js';
import { CandidateRepository } from '../repositories/candidate.repository.js';
import { RecruitingEventsPublisher } from '../events/recruiting-events.publisher.js';

export interface ScreenCandidateCommandPayload {
  applicationId: Uuid;
  screenedByWorkerId: Uuid;
  outcome: string;
}

/**
 * Handler for the ScreenCandidate command.
 *
 * Transitions a candidate from NEW to SCREENING.
 */
@Injectable()
@CommandHandler('ScreenCandidate')
export class ScreenCandidateHandler implements ICommandHandler {
  readonly commandName = 'ScreenCandidate';

  constructor(
    private readonly candidateRepo: CandidateRepository,
    private readonly fsm: FsmFramework,
    private readonly eventPublisher: RecruitingEventsPublisher,
  ) {}

  async handle(command: HrCommandEnvelope<unknown>): Promise<CommandResult<unknown>> {
    const payload = command.payload as ScreenCandidateCommandPayload;
    const candidate = await this.candidateRepo.findById(payload.applicationId);
    if (!candidate) {
      throw new NotFoundException('Candidate not found');
    }

    candidate.screen(command.correlationId);
    await this.candidateRepo.save(candidate);
    await this.eventPublisher.publishUncommitted(candidate, command.tenantId, command.correlationId);

    return {
      success: true,
      data: { candidateId: candidate.id.value, status: candidate.status, outcome: payload.outcome },
      commandId: command.commandId,
      correlationId: command.correlationId,
      aggregateId: candidate.id,
      newState: candidate.status,
      newVersion: candidate.aggregateVersion,
      allowedNextActions: this.fsm.getAllowedActionsFromState(candidate.status, 'Candidate'),
      fieldAccessDecisions: {},
      eventsEmitted: ['CandidateScreened'],
      auditRecordId: Uuid.generate(),
    };
  }
}
