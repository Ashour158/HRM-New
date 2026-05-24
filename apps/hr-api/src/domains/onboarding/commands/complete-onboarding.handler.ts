import { Injectable, NotFoundException } from '@nestjs/common';
import { CommandHandler } from '../../../platform/command-bus/command-handler.decorator.js';
import type { CommandHandler as ICommandHandler } from '../../../platform/command-bus/command-bus.js';
import type { HrCommandEnvelope, CommandResult } from '@hcm/command-contracts';
import { Uuid } from '@hcm/shared-kernel';
import { FsmFramework } from '../../../platform/workflow/fsm-framework.js';
import { OnboardingPlanRepository } from '../repositories/onboarding-plan.repository.js';
import { OnboardingEventsPublisher } from '../events/onboarding-events.publisher.js';

export interface CompleteOnboardingCommandPayload {
  planId: Uuid;
}

/**
 * Handler for the CompleteOnboarding command.
 *
 * Transitions an onboarding plan from IN_PROGRESS to COMPLETED.
 */
@Injectable()
@CommandHandler('CompleteOnboarding')
export class CompleteOnboardingHandler implements ICommandHandler {
  readonly commandName = 'CompleteOnboarding';

  constructor(
    private readonly planRepo: OnboardingPlanRepository,
    private readonly fsm: FsmFramework,
    private readonly eventPublisher: OnboardingEventsPublisher,
  ) {}

  async handle(command: HrCommandEnvelope<unknown>): Promise<CommandResult<unknown>> {
    const payload = command.payload as CompleteOnboardingCommandPayload;
    const plan = await this.planRepo.findById(payload.planId);
    if (!plan) {
      throw new NotFoundException('Onboarding plan not found');
    }

    plan.complete(command.correlationId);
    await this.planRepo.save(plan);
    await this.eventPublisher.publishUncommitted(plan, command.tenantId, command.correlationId);

    return {
      success: true,
      data: { planId: plan.id.value, status: plan.status },
      commandId: command.commandId,
      correlationId: command.correlationId,
      aggregateId: plan.id,
      newState: plan.status,
      newVersion: plan.aggregateVersion,
      allowedNextActions: this.fsm.getAllowedActionsFromState(plan.status, 'OnboardingPlan'),
      fieldAccessDecisions: {},
      eventsEmitted: ['OnboardingPlanCompleted'],
      auditRecordId: Uuid.generate(),
    };
  }
}
