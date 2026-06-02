import { Injectable } from '@nestjs/common';
import { CommandHandler } from '../../../platform/command-bus/command-handler.decorator.js';
import type { CommandHandler as ICommandHandler } from '../../../platform/command-bus/command-bus.js';
import type { HrCommandEnvelope, CommandResult } from '@hcm/command-contracts';
import { Uuid } from '@hcm/shared-kernel';
import { FsmFramework } from '../../../platform/workflow/fsm-framework.js';
import { OnboardingPlan } from '../aggregates/onboarding-plan.aggregate.js';
import { OnboardingPlanRepository } from '../repositories/onboarding-plan.repository.js';
import { OnboardingEventsPublisher } from '../events/onboarding-events.publisher.js';
import { toUuid, type UuidInput } from '../../common/uuid-normalizer.js';

export interface CreateOnboardingPlanCommandPayload {
  planId: UuidInput;
  workerId: UuidInput;
  startDate: Date;
  assignedBuddyId?: UuidInput;
  mentorId?: UuidInput;
  roleTrack?: string;
  preboardingPortalStatus?: 'NOT_INVITED' | 'INVITED' | 'ACTIVE' | 'COMPLETED';
  firstDayInstructions?: Record<string, unknown>;
  welcomeMessage?: string;
  probationReviewDate?: Date;
  probationStatus?: 'NOT_REQUIRED' | 'PENDING_REVIEW' | 'CONFIRMED' | 'EXTENDED' | 'TERMINATION_RECOMMENDED';
}

/**
 * Handler for the CreateOnboardingPlan command.
 *
 * Creates a new OnboardingPlan in DRAFT state.
 * Typically triggered by the OfferToHireSaga after offer acceptance.
 */
@Injectable()
@CommandHandler('CreateOnboardingPlan')
export class CreateOnboardingPlanHandler implements ICommandHandler {
  readonly commandName = 'CreateOnboardingPlan';

  constructor(
    private readonly planRepo: OnboardingPlanRepository,
    private readonly fsm: FsmFramework,
    private readonly eventPublisher: OnboardingEventsPublisher,
  ) {}

  async handle(command: HrCommandEnvelope<unknown>): Promise<CommandResult<unknown>> {
    const payload = command.payload as CreateOnboardingPlanCommandPayload;

    const plan = OnboardingPlan.create(
      {
        id: toUuid(payload.planId),
        tenantId: command.tenantId,
        workerId: toUuid(payload.workerId),
        startDate: new Date(payload.startDate),
        assignedBuddyId: payload.assignedBuddyId ? toUuid(payload.assignedBuddyId) : undefined,
        mentorId: payload.mentorId ? toUuid(payload.mentorId) : undefined,
        roleTrack: payload.roleTrack,
        preboardingPortalStatus: payload.preboardingPortalStatus,
        firstDayInstructions: payload.firstDayInstructions,
        welcomeMessage: payload.welcomeMessage,
        probationReviewDate: payload.probationReviewDate ? new Date(payload.probationReviewDate) : undefined,
        probationStatus: payload.probationStatus,
      },
      command.correlationId,
    );

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
      eventsEmitted: ['OnboardingPlanCreated'],
      auditRecordId: Uuid.generate(),
    };
  }
}
