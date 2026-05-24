import { Injectable } from '@nestjs/common';
import { CommandHandler } from '../../../platform/command-bus/command-handler.decorator.js';
import type { HrCommandEnvelope, CommandResult } from '@hcm/command-contracts';
import { Uuid } from '@hcm/shared-kernel';
import { FsmFramework } from '../../../platform/workflow/fsm-framework.js';
import { LearningCourse } from '../aggregates/learning-course.aggregate.js';
import { LearningCourseRepository } from '../repositories/learning-course.repository.js';
import { LearningEventsPublisher } from '../events/learning-events.publisher.js';

@CommandHandler('CreateLearningCourse')
@Injectable()
export class CreateLearningCourseHandler {
  constructor(
    private readonly repo: LearningCourseRepository,
    private readonly fsm: FsmFramework,
    private readonly publisher: LearningEventsPublisher,
  ) {}

  async handle(command: HrCommandEnvelope<unknown>): Promise<CommandResult<unknown>> {
    const payload = command.payload as {
      title: string;
      description?: string;
      contentType: string;
      durationMinutes?: number;
      credits?: number;
      certificationEligible?: boolean;
    };
    const ar = LearningCourse.create(
      {
        id: Uuid.generate(),
        tenantId: command.tenantId,
        title: payload.title,
        description: payload.description,
        contentType: payload.contentType,
        durationMinutes: payload.durationMinutes,
        credits: payload.credits,
        certificationEligible: payload.certificationEligible,
      },
      command.correlationId,
    );
    await this.repo.save(ar);
    await this.publisher.publishFromAggregate(ar);
    return {
      success: true,
      data: { learningCourseId: ar.id.value, status: ar.status },
      commandId: command.commandId,
      correlationId: command.correlationId,
      aggregateId: ar.id,
      newState: ar.status,
      newVersion: ar.aggregateVersion,
      allowedNextActions: this.fsm.getAllowedActionsFromState(ar.status, 'LearningCourse'),
      eventsEmitted: ar.domainEvents.map((e) => e.eventName),
      auditRecordId: command.commandId,
    } as CommandResult<unknown>;
  }
}
