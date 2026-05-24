import { Injectable, NotFoundException } from '@nestjs/common';
import { CommandHandler } from '../../../platform/command-bus/command-handler.decorator.js';
import type { CommandHandler as ICommandHandler } from '../../../platform/command-bus/command-bus.js';
import type { HrCommandEnvelope, CommandResult } from '@hcm/command-contracts';
import { Uuid } from '@hcm/shared-kernel';
import { FsmFramework } from '../../../platform/workflow/fsm-framework.js';
import { InterviewPlanRepository } from '../repositories/interview-plan.repository.js';
import { RecruitingEventsPublisher } from '../events/recruiting-events.publisher.js';

export interface CancelInterviewCommandPayload {
  interviewId: Uuid;
}

/**
 * Handler for the CancelInterview command.
 *
 * Transitions an interview plan to CANCELLED (terminal).
 */
@Injectable()
@CommandHandler('CancelInterview')
export class CancelInterviewHandler implements ICommandHandler {
  readonly commandName = 'CancelInterview';

  constructor(
    private readonly interviewPlanRepo: InterviewPlanRepository,
    private readonly fsm: FsmFramework,
    private readonly eventPublisher: RecruitingEventsPublisher,
  ) {}

  async handle(command: HrCommandEnvelope<unknown>): Promise<CommandResult<unknown>> {
    const payload = command.payload as CancelInterviewCommandPayload;
    const plan = await this.interviewPlanRepo.findById(payload.interviewId);
    if (!plan) {
      throw new NotFoundException('Interview plan not found');
    }

    plan.cancel(command.correlationId);
    await this.interviewPlanRepo.save(plan);
    await this.eventPublisher.publishUncommitted(plan, command.tenantId, command.correlationId);

    return {
      success: true,
      data: { interviewId: plan.id.value, status: plan.status },
      commandId: command.commandId,
      correlationId: command.correlationId,
      aggregateId: plan.id,
      newState: plan.status,
      newVersion: plan.aggregateVersion,
      allowedNextActions: this.fsm.getAllowedActionsFromState(plan.status, 'InterviewPlan'),
      fieldAccessDecisions: {},
      eventsEmitted: ['InterviewPlanCancelled'],
      auditRecordId: Uuid.generate(),
    };
  }
}
