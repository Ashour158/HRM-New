import { Injectable } from '@nestjs/common';
import { CommandHandler } from '../../../platform/command-bus/command-handler.decorator.js';
import type { HrCommandEnvelope, CommandResult } from '@hcm/command-contracts';
import { Uuid } from '@hcm/shared-kernel';
import { FsmFramework } from '../../../platform/workflow/fsm-framework.js';
import { ReviewTemplate } from '../aggregates/review-template.aggregate.js';
import { ReviewTemplateRepository } from '../repositories/review-template.repository.js';
import { PerformanceEventsPublisher } from '../events/performance-events.publisher.js';

@CommandHandler('CreateReviewTemplate')
@Injectable()
export class CreateReviewTemplateHandler {
  constructor(
    private readonly repo: ReviewTemplateRepository,
    private readonly fsm: FsmFramework,
    private readonly publisher: PerformanceEventsPublisher,
  ) {}

  async handle(command: HrCommandEnvelope<unknown>): Promise<CommandResult<unknown>> {
    const payload = command.payload as {
      name: string;
      description?: string;
      templateType?: string;
      sections: Array<{ title: string; questions: string[]; competencyIds: string[]; weight: number }>;
      ratingScale: { min: number; max: number; labels: Record<string, string> };
      applicableRoles: string[];
    };
    const ar = ReviewTemplate.create(
      {
        id: Uuid.generate(),
        tenantId: command.tenantId,
        name: payload.name,
        description: payload.description,
        templateType: payload.templateType ?? 'PERFORMANCE_REVIEW',
        sections: payload.sections,
        ratingScale: payload.ratingScale,
        applicableRoles: payload.applicableRoles,
      },
      command.correlationId,
    );
    await this.repo.save(ar);
    await this.publisher.publishFromAggregate(ar);
    return {
      success: true,
      data: { reviewTemplateId: ar.id.value, status: ar.status },
      commandId: command.commandId,
      correlationId: command.correlationId,
      aggregateId: ar.id,
      newState: ar.status,
      newVersion: ar.aggregateVersion,
      allowedNextActions: this.fsm.getAllowedActionsFromState(ar.status, 'ReviewTemplate'),
      eventsEmitted: ar.domainEvents.map((e) => e.eventName),
      auditRecordId: command.commandId,
    } as CommandResult<unknown>;
  }
}
