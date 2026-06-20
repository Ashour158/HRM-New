import { Injectable } from '@nestjs/common';
import { CommandHandler } from '../../../platform/command-bus/command-handler.decorator.js';
import type { HrCommandEnvelope, CommandResult } from '@hcm/command-contracts';
import { Uuid } from '@hcm/shared-kernel';
import { FsmFramework } from '../../../platform/workflow/fsm-framework.js';
import { EngagementSurveyRepository } from '../repositories/engagement-survey.repository.js';
import { SurveyResponseRepository } from '../repositories/survey-response.repository.js';
import { EngagementEventsPublisher } from '../events/engagement-events.publisher.js';
import { analyzeEngagementSurvey } from '../engagement-survey-analysis.js';

@CommandHandler('AnalyzeEngagementSurvey')
@Injectable()
export class AnalyzeEngagementSurveyHandler {
  constructor(
    private readonly repo: EngagementSurveyRepository,
    private readonly responseRepo: SurveyResponseRepository,
    private readonly fsm: FsmFramework,
    private readonly publisher: EngagementEventsPublisher,
  ) {}

  async handle(command: HrCommandEnvelope<unknown>): Promise<CommandResult<unknown>> {
    const payload = command.payload as { engagementSurveyId: Uuid };
    const ar = await this.repo.findById(payload.engagementSurveyId);
    if (!ar) throw new Error('Engagement survey not found');

    // Compute real analysis over the collected responses (k-anonymity suppressed
    // when too few responses) and persist it on the survey.
    const responses = await this.responseRepo.findBySurvey(ar.id);
    const npsQuestionId = findNpsQuestionId(ar.questions);
    const analysis = analyzeEngagementSurvey(
      responses.map((r) => r.responses ?? {}),
      { npsQuestionId },
    );
    ar.analyze(command.correlationId, analysis as unknown as Record<string, unknown>);
    await this.repo.save(ar);
    await this.publisher.publishFromAggregate(ar);
    return {
      success: true,
      data: { engagementSurveyId: ar.id.value, status: ar.status, analysis },
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

/** Find the id of an NPS-style question (type NPS or a 0–10 scale) for eNPS, if any. */
function findNpsQuestionId(questions: Record<string, unknown>[]): string | undefined {
  for (const q of questions) {
    const type = typeof q.type === 'string' ? q.type.toUpperCase() : '';
    const id = typeof q.id === 'string' ? q.id : typeof q.questionId === 'string' ? q.questionId : undefined;
    if (!id) continue;
    if (type === 'NPS' || (Number(q.min) === 0 && Number(q.max) === 10)) return id;
  }
  return undefined;
}
