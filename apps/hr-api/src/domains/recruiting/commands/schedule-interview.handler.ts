import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { CommandHandler } from '../../../platform/command-bus/command-handler.decorator.js';
import type { CommandHandler as ICommandHandler } from '../../../platform/command-bus/command-bus.js';
import type { HrCommandEnvelope, CommandResult } from '@hcm/command-contracts';
import { Uuid } from '@hcm/shared-kernel';
import { FsmFramework } from '../../../platform/workflow/fsm-framework.js';
import { InterviewPlan, type InterviewFormat } from '../aggregates/interview-plan.aggregate.js';
import { InterviewPlanRepository } from '../repositories/interview-plan.repository.js';
import { CandidateRepository } from '../repositories/candidate.repository.js';
import { RecruitingEventsPublisher } from '../events/recruiting-events.publisher.js';

export interface ScheduleInterviewCommandPayload {
  interviewId: Uuid;
  applicationId: Uuid;
  scheduledAt: Date;
  interviewerWorkerIds: Uuid[];
  format?: InterviewFormat;
}

/**
 * Handler for the ScheduleInterview command.
 *
 * Creates an InterviewPlan and transitions the candidate to INTERVIEWING.
 */
@Injectable()
@CommandHandler('ScheduleInterview')
export class ScheduleInterviewHandler implements ICommandHandler {
  readonly commandName = 'ScheduleInterview';

  constructor(
    private readonly interviewPlanRepo: InterviewPlanRepository,
    private readonly candidateRepo: CandidateRepository,
    private readonly fsm: FsmFramework,
    private readonly eventPublisher: RecruitingEventsPublisher,
  ) {}

  async handle(command: HrCommandEnvelope<unknown>): Promise<CommandResult<unknown>> {
    const payload = command.payload as ScheduleInterviewCommandPayload;
    const candidate = await this.candidateRepo.findById(payload.applicationId);
    if (!candidate) {
      throw new NotFoundException('Candidate not found');
    }

    if (candidate.status !== 'SCREENING') {
      throw new BadRequestException('Candidate must be in SCREENING state to schedule an interview');
    }

    const plan = InterviewPlan.create(
      {
        id: payload.interviewId,
        tenantId: command.tenantId,
        candidateId: candidate.id,
        requisitionId: candidate.requisitionId,
        interviewers: payload.interviewerWorkerIds,
        scheduledAt: payload.scheduledAt,
        format: payload.format ?? 'VIDEO',
      },
      command.correlationId,
    );

    plan.schedule(payload.scheduledAt, payload.format ?? 'VIDEO', command.correlationId);
    await this.interviewPlanRepo.save(plan);
    await this.eventPublisher.publishUncommitted(plan, command.tenantId, command.correlationId);

    candidate.scheduleInterview(command.correlationId);
    await this.candidateRepo.save(candidate);
    await this.eventPublisher.publishUncommitted(candidate, command.tenantId, command.correlationId);

    return {
      success: true,
      data: { interviewId: plan.id.value, candidateId: candidate.id.value, status: plan.status },
      commandId: command.commandId,
      correlationId: command.correlationId,
      aggregateId: plan.id,
      newState: plan.status,
      newVersion: plan.aggregateVersion,
      allowedNextActions: this.fsm.getAllowedActionsFromState(plan.status, 'InterviewPlan'),
      fieldAccessDecisions: {},
      eventsEmitted: ['InterviewPlanCreated', 'InterviewPlanScheduled', 'CandidateInterviewScheduled'],
      auditRecordId: Uuid.generate(),
    };
  }
}
