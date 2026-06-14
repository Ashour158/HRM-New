import { Injectable } from '@nestjs/common';
import { CommandHandler } from '../../../platform/command-bus/command-handler.decorator.js';
import type { HrCommandEnvelope, CommandResult } from '@hcm/command-contracts';
import { Uuid } from '@hcm/shared-kernel';
import { FsmFramework } from '../../../platform/workflow/fsm-framework.js';
import { toDate, toUuid } from '../../common/uuid-normalizer.js';
import { ContingentWorkerAssignment } from '../aggregates/contingent-worker-assignment.aggregate.js';
import { ContingentWorkerAssignmentRepository } from '../repositories/contingent-worker-assignment.repository.js';
import { ContingentWorkforceEventsPublisher } from '../events/contingent-workforce-events.publisher.js';

@CommandHandler('CreateContingentWorkerAssignment')
@Injectable()
export class CreateContingentWorkerAssignmentHandler {
  constructor(
    private readonly repo: ContingentWorkerAssignmentRepository,
    private readonly fsm: FsmFramework,
    private readonly publisher: ContingentWorkforceEventsPublisher,
  ) {}

  async handle(command: HrCommandEnvelope<unknown>): Promise<CommandResult<unknown>> {
    const payload = command.payload as { workerId: Uuid | string; vendorId: Uuid | string; projectId: Uuid | string; startDate: Date | string; endDate: Date | string; rate: number; currency: string };
    const ar = ContingentWorkerAssignment.create({
      id: Uuid.generate(),
      tenantId: command.tenantId,
      workerId: toUuid(payload.workerId),
      vendorId: toUuid(payload.vendorId),
      projectId: toUuid(payload.projectId),
      startDate: toDate(payload.startDate),
      endDate: toDate(payload.endDate),
      rate: payload.rate,
      currency: payload.currency,
    }, command.correlationId);
    await this.repo.save(ar);
    await this.publisher.publishFromAggregate(ar);
    return {
      success: true,
      data: { contingentWorkerAssignmentId: ar.id.value, status: ar.status },
      commandId: command.commandId,
      correlationId: command.correlationId,
      aggregateId: ar.id,
      newState: ar.status,
      newVersion: ar.aggregateVersion,
      allowedNextActions: this.fsm.getAllowedActionsFromState(ar.status, 'ContingentWorkerAssignment'),
      eventsEmitted: ar.domainEvents.map((e) => e.eventName),
      auditRecordId: command.commandId,
    } as CommandResult<unknown>;
  }
}
