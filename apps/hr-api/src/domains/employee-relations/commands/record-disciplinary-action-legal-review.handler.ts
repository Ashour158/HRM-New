import { Injectable } from '@nestjs/common';
import { CommandHandler } from '../../../platform/command-bus/command-handler.decorator.js';
import type { HrCommandEnvelope, CommandResult } from '@hcm/command-contracts';
import { Uuid } from '@hcm/shared-kernel';
import { FsmFramework } from '../../../platform/workflow/fsm-framework.js';
import { DisciplinaryActionRepository } from '../repositories/disciplinary-action.repository.js';
import { EmployeeRelationsEventsPublisher } from '../events/employee-relations-events.publisher.js';

/**
 * Records the "LegalReviewCompleted"-style acknowledgement that satisfies the
 * severity-driven escalation gate on {@link DisciplinaryAction}. Required
 * before ExecuteDisciplinaryAction can finalize a HIGH-severity (or above the
 * configured threshold) action — see disciplinary-action.aggregate.ts#execute.
 */
@CommandHandler('RecordDisciplinaryActionLegalReview')
@Injectable()
export class RecordDisciplinaryActionLegalReviewHandler {
  constructor(
    private readonly repo: DisciplinaryActionRepository,
    private readonly fsm: FsmFramework,
    private readonly publisher: EmployeeRelationsEventsPublisher,
  ) {}

  async handle(command: HrCommandEnvelope<unknown>): Promise<CommandResult<unknown>> {
    const payload = command.payload as { disciplinaryActionId: Uuid; reviewedBy: Uuid };
    const ar = await this.repo.findById(payload.disciplinaryActionId);
    if (!ar) throw new Error('Disciplinary action not found');
    ar.recordLegalReview(payload.reviewedBy, command.correlationId);
    await this.repo.save(ar);
    await this.publisher.publishFromAggregate(ar);
    return {
      success: true,
      data: {
        disciplinaryActionId: ar.id.value,
        status: ar.status,
        requiresLegalReview: ar.requiresLegalReview,
        canFinalize: ar.canFinalize,
      },
      commandId: command.commandId,
      correlationId: command.correlationId,
      aggregateId: ar.id,
      newState: ar.status,
      newVersion: ar.aggregateVersion,
      allowedNextActions: this.fsm.getAllowedActionsFromState(ar.status, 'DisciplinaryAction'),
      eventsEmitted: ar.domainEvents.map((e) => e.eventName),
      auditRecordId: command.commandId,
    } as CommandResult<unknown>;
  }
}
