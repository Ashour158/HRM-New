import { Injectable } from '@nestjs/common';
import { CommandHandler } from '../../../platform/command-bus/command-handler.decorator.js';
import type { CommandHandler as ICommandHandler } from '../../../platform/command-bus/command-bus.js';
import type { HrCommandEnvelope, CommandResult } from '@hcm/command-contracts';
import { Uuid } from '@hcm/shared-kernel';
import { CompensationChangeRepository } from '../repositories/compensation-change.repository.js';
import { CompensationChangeFsm } from '../fsm/compensation-change.fsm.js';
import { CompensationEventsPublisher } from '../events/compensation-events.publisher.js';

/**
 * Command handler for submitting a CompensationChange for approval.
 *
 * Drives the aggregate through its DRAFT -> SUBMITTED -> PENDING_APPROVAL
 * transitions via the aggregate's own {@link CompensationChange.submit} and
 * {@link CompensationChange.sendForApproval} guards. Without this handler a
 * freshly created compensation change was permanently stuck in DRAFT, so
 * ApproveCompensationChange (which requires PENDING_APPROVAL) could never
 * legally fire.
 */
@Injectable()
@CommandHandler('SubmitCompensationChange')
export class SubmitCompensationChangeHandler implements ICommandHandler {
  commandName = 'SubmitCompensationChange' as const;

  constructor(
    private readonly repo: CompensationChangeRepository,
    private readonly publisher: CompensationEventsPublisher,
    private readonly fsm: CompensationChangeFsm,
  ) {}

  async handle(command: HrCommandEnvelope<unknown>): Promise<CommandResult<unknown>> {
    const payload = command.payload as { changeId: Uuid };
    const change = await this.repo.findById(payload.changeId);
    if (!change) throw new Error('CompensationChange not found');

    change.submit(command.correlationId);
    change.sendForApproval(command.correlationId);

    await this.repo.save(change);
    const eventsEmitted = change.domainEvents.map((e) => e.eventName);
    await this.publisher.publishAll(change, command);

    return {
      success: true,
      data: { changeId: change.id.value, status: change.status },
      commandId: command.commandId,
      correlationId: command.correlationId,
      aggregateId: change.id,
      newState: change.status,
      newVersion: change.aggregateVersion,
      allowedNextActions: this.fsm.getAllowedActions(change.status),
      fieldAccessDecisions: {},
      eventsEmitted,
      auditRecordId: command.commandId,
    };
  }
}
