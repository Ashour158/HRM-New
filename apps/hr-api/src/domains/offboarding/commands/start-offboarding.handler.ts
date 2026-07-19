import { Injectable, NotFoundException } from '@nestjs/common';
import { CommandHandler } from '../../../platform/command-bus/command-handler.decorator.js';
import type { CommandHandler as ICommandHandler } from '../../../platform/command-bus/command-bus.js';
import type { HrCommandEnvelope, CommandResult } from '@hcm/command-contracts';
import { Uuid } from '@hcm/shared-kernel';
import { FsmFramework } from '../../../platform/workflow/fsm-framework.js';
import { OffboardingPlanRepository } from '../repositories/offboarding-plan.repository.js';
import { OffboardingEventsPublisher } from '../events/offboarding-events.publisher.js';
import { toUuid, type UuidInput } from '../../common/uuid-normalizer.js';

export interface StartOffboardingCommandPayload {
  planId: UuidInput;
}

/**
 * Handler for the StartOffboarding command.
 *
 * Transitions an offboarding plan from DRAFT to ACTIVE.
 */
@Injectable()
@CommandHandler('StartOffboarding')
export class StartOffboardingHandler implements ICommandHandler {
  readonly commandName = 'StartOffboarding';

  constructor(
    private readonly planRepo: OffboardingPlanRepository,
    private readonly fsm: FsmFramework,
    private readonly eventPublisher: OffboardingEventsPublisher,
  ) {}

  async handle(command: HrCommandEnvelope<unknown>): Promise<CommandResult<unknown>> {
    const payload = command.payload as StartOffboardingCommandPayload;
    const plan = await this.planRepo.findById(toUuid(payload.planId));
    if (!plan) {
      throw new NotFoundException('Offboarding plan not found');
    }

    plan.start(command.correlationId);
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
      allowedNextActions: this.fsm.getAllowedActionsFromState(plan.status, 'OffboardingPlan'),
      fieldAccessDecisions: {},
      eventsEmitted: ['OffboardingPlanStarted'],
      auditRecordId: Uuid.generate(),
    };
  }
}
