import { Injectable } from '@nestjs/common';
import { CommandHandler } from '../../../platform/command-bus/command-handler.decorator.js';
import type { CommandHandler as ICommandHandler } from '../../../platform/command-bus/command-bus.js';
import type { HrCommandEnvelope, CommandResult } from '@hcm/command-contracts';
import { Uuid } from '@hcm/shared-kernel';
import { CompensationChangeRepository } from '../repositories/compensation-change.repository.js';
import { CompensationChangeFsm } from '../fsm/compensation-change.fsm.js';
import { CompensationEventsPublisher } from '../events/compensation-events.publisher.js';

/**
 * Command handler for approving a CompensationChange.
 * SoD: proposer (workerId) ≠ approver.
 */
@Injectable()
@CommandHandler('ApproveCompensationChange')
export class ApproveCompensationChangeHandler implements ICommandHandler {
  commandName = 'ApproveCompensationChange' as const;

  constructor(
    private readonly repo: CompensationChangeRepository,
    private readonly publisher: CompensationEventsPublisher,
    private readonly fsm: CompensationChangeFsm,
  ) {}

  async handle(command: HrCommandEnvelope<unknown>): Promise<CommandResult<unknown>> {
    const payload = command.payload as { changeId: Uuid; approvedBy: Uuid };
    const change = await this.repo.findById(payload.changeId);
    if (!change) throw new Error('CompensationChange not found');

    change.approve(payload.approvedBy, command.correlationId);
    await this.repo.save(change);
    const eventsEmitted = change.domainEvents.map((e) => e.eventName);
    await this.publisher.publishAll(change, command);

    return {
      success: true,
      data: { changeId: change.id.value, status: change.status, approvedBy: change.approvedBy?.value },
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
