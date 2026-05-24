import { Injectable } from '@nestjs/common';
import { CommandHandler } from '../../../platform/command-bus/command-handler.decorator.js';
import type { HrCommandEnvelope, CommandResult } from '@hcm/command-contracts';
import { Uuid } from '@hcm/shared-kernel';
import { FsmFramework } from '../../../platform/workflow/fsm-framework.js';
import { EngagementSurvey } from '../aggregates/engagement-survey.aggregate.js';
import { EngagementSurveyRepository } from '../repositories/engagement-survey.repository.js';
import { EngagementEventsPublisher } from '../events/engagement-events.publisher.js';

@CommandHandler('CreateEngagementSurvey')
@Injectable()
export class CreateEngagementSurveyHandler {
  constructor(
    private readonly repo: EngagementSurveyRepository,
    private readonly fsm: FsmFramework,
    private readonly publisher: EngagementEventsPublisher,
  ) {}

  async handle(command: HrCommandEnvelope<unknown>): Promise<CommandResult<unknown>> {
    const payload = command.payload as {
      title: string;
      surveyType: string;
      questions?: Record<string, unknown>[];
      anonymous?: boolean;
      startDate?: Date;
      endDate?: Date;
    };
    const ar = EngagementSurvey.create(
      {
        id: Uuid.generate(),
        tenantId: command.tenantId,
        title: payload.title,
        surveyType: payload.surveyType,
        questions: payload.questions,
        anonymous: payload.anonymous,
        startDate: payload.startDate,
        endDate: payload.endDate,
      },
      command.correlationId,
    );
    await this.repo.save(ar);
    await this.publisher.publishFromAggregate(ar);
    return {
      success: true,
      data: { engagementSurveyId: ar.id.value, status: ar.status },
      commandId: command.commandId,
      correlationId: command.correlationId,
      aggregateId: ar.id,
      newState: ar.status,
      newVersion: ar.aggregateVersion,
      allowedNextActions: this.fsm.getAllowedActionsFromState(ar.status, 'EngagementSurvey'),
      eventsEmitted: ar.domainEvents.map((e) => e.eventName),
      auditRecordId: command.commandId,
    } as CommandResult<unknown>;
  }
}
