import { Injectable } from '@nestjs/common';
import { CommandHandler } from '../../../platform/command-bus/command-handler.decorator.js';
import type { HrCommandEnvelope, CommandResult } from '@hcm/command-contracts';
import { Uuid } from '@hcm/shared-kernel';
import { FsmFramework } from '../../../platform/workflow/fsm-framework.js';
import { LearningAssignment } from '../aggregates/learning-assignment.aggregate.js';
import { LearningAssignmentRepository } from '../repositories/learning-assignment.repository.js';
import { LearningEventsPublisher } from '../events/learning-events.publisher.js';

@CommandHandler('CreateLearningAssignment')
@Injectable()
export class CreateLearningAssignmentHandler {
  constructor(
    private readonly repo: LearningAssignmentRepository,
    private readonly fsm: FsmFramework,
    private readonly publisher: LearningEventsPublisher,
  ) {}

  async handle(command: HrCommandEnvelope<unknown>): Promise<CommandResult<unknown>> {
    const payload = command.payload as {
      workerId: Uuid;
      courseId: Uuid;
      assignedBy: Uuid;
      dueDate?: Date;
    };
    const ar = LearningAssignment.create(
      {
        id: Uuid.generate(),
        tenantId: command.tenantId,
        workerId: payload.workerId,
        courseId: payload.courseId,
        assignedBy: payload.assignedBy,
        dueDate: payload.dueDate,
      },
      command.correlationId,
    );
    await this.repo.save(ar);
    await this.publisher.publishFromAggregate(ar);
    return {
      success: true,
      data: { learningAssignmentId: ar.id.value, status: ar.status },
      commandId: command.commandId,
      correlationId: command.correlationId,
      aggregateId: ar.id,
      newState: ar.status,
      newVersion: ar.aggregateVersion,
      allowedNextActions: this.fsm.getAllowedActionsFromState(ar.status, 'LearningAssignment'),
      eventsEmitted: ar.domainEvents.map((e) => e.eventName),
      auditRecordId: command.commandId,
    } as CommandResult<unknown>;
  }
}
