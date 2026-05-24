import { Injectable } from '@nestjs/common';
import { CommandHandler } from '../../../platform/command-bus/command-handler.decorator.js';
import type { HrCommandEnvelope, CommandResult } from '@hcm/command-contracts';
import { Uuid } from '@hcm/shared-kernel';
import { FsmFramework } from '../../../platform/workflow/fsm-framework.js';
import { ShiftSwapRequest } from '../aggregates/shift-swap-request.aggregate.js';
import { ShiftSwapRequestRepository } from '../repositories/shift-swap-request.repository.js';
import { WorkforceManagementEventsPublisher } from '../events/workforce-management-events.publisher.js';

@CommandHandler('CreateShiftSwapRequest')
@Injectable()
export class CreateShiftSwapRequestHandler {
  constructor(
    private readonly repo: ShiftSwapRequestRepository,
    private readonly fsm: FsmFramework,
    private readonly publisher: WorkforceManagementEventsPublisher,
  ) {}

  async handle(command: HrCommandEnvelope<unknown>): Promise<CommandResult<unknown>> {
    const payload = command.payload as {
      requesterWorkerId: Uuid;
      requestedWorkerId: Uuid;
      originalShiftId: Uuid;
      targetShiftId: Uuid;
      reason?: string;
    };
    const ar = ShiftSwapRequest.create(
      {
        id: Uuid.generate(),
        tenantId: command.tenantId,
        requesterWorkerId: payload.requesterWorkerId,
        requestedWorkerId: payload.requestedWorkerId,
        originalShiftId: payload.originalShiftId,
        targetShiftId: payload.targetShiftId,
        reason: payload.reason,
      },
      command.correlationId,
    );
    await this.repo.save(ar);
    await this.publisher.publishFromAggregate(ar);
    return {
      success: true,
      data: { shiftSwapRequestId: ar.id.value, status: ar.status },
      commandId: command.commandId,
      correlationId: command.correlationId,
      aggregateId: ar.id,
      newState: ar.status,
      newVersion: ar.aggregateVersion,
      allowedNextActions: this.fsm.getAllowedActionsFromState(ar.status, 'ShiftSwapRequest'),
      eventsEmitted: ar.domainEvents.map((e) => e.eventName),
      auditRecordId: command.commandId,
    } as CommandResult<unknown>;
  }
}
