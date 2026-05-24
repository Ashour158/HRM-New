import { Injectable } from '@nestjs/common';
import { CommandHandler } from '../../../platform/command-bus/command-handler.decorator.js';
import type { HrCommandEnvelope, CommandResult } from '@hcm/command-contracts';
import { Uuid } from '@hcm/shared-kernel';
import { FsmFramework } from '../../../platform/workflow/fsm-framework.js';
import { SurveyResponse } from '../aggregates/survey-response.aggregate.js';
import { SurveyResponseRepository } from '../repositories/survey-response.repository.js';
import { EngagementEventsPublisher } from '../events/engagement-events.publisher.js';

@CommandHandler('CreateSurveyResponse')
@Injectable()
export class CreateSurveyResponseHandler {
  constructor(
    private readonly repo: SurveyResponseRepository,
    private readonly fsm: FsmFramework,
    private readonly publisher: EngagementEventsPublisher,
  ) {}

  async handle(command: HrCommandEnvelope<unknown>): Promise<CommandResult<unknown>> {
    const payload = command.payload as {
      surveyId: Uuid;
      workerId: Uuid;
      isAnonymous?: boolean;
    };
    const ar = SurveyResponse.create(
      {
        id: Uuid.generate(),
        tenantId: command.tenantId,
        surveyId: payload.surveyId,
        workerId: payload.workerId,
        isAnonymous: payload.isAnonymous,
      },
      command.correlationId,
    );
    await this.repo.save(ar);
    await this.publisher.publishFromAggregate(ar);
    return {
      success: true,
      data: { surveyResponseId: ar.id.value, status: ar.status },
      commandId: command.commandId,
      correlationId: command.correlationId,
      aggregateId: ar.id,
      newState: ar.status,
      newVersion: ar.aggregateVersion,
      allowedNextActions: this.fsm.getAllowedActionsFromState(ar.status, 'SurveyResponse'),
      eventsEmitted: ar.domainEvents.map((e) => e.eventName),
      auditRecordId: command.commandId,
    } as CommandResult<unknown>;
  }
}
