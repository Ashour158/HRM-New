import { Injectable } from '@nestjs/common';
import { CommandHandler } from '../../../platform/command-bus/command-handler.decorator.js';
import type { CommandHandler as ICommandHandler } from '../../../platform/command-bus/command-bus.js';
import type { HrCommandEnvelope, CommandResult } from '@hcm/command-contracts';
import { Uuid } from '@hcm/shared-kernel';
import { FsmFramework } from '../../../platform/workflow/fsm-framework.js';
import { OffboardingPlan } from '../aggregates/offboarding-plan.aggregate.js';
import type { OffboardingReasonCategory } from '../aggregates/offboarding-plan.aggregate.js';
import { OffboardingPlanRepository } from '../repositories/offboarding-plan.repository.js';
import { OffboardingEventsPublisher } from '../events/offboarding-events.publisher.js';
import { toUuid, toOptionalUuid, type UuidInput } from '../../common/uuid-normalizer.js';

export interface CreateOffboardingPlanCommandPayload {
  planId: UuidInput;
  workerId: UuidInput;
  lastWorkingDay: Date;
  initiatedBy: UuidInput;
  reasonCategory?: OffboardingReasonCategory;
  reasonNotes?: string;
  managerId?: UuidInput;
}

/**
 * Handler for the CreateOffboardingPlan command.
 *
 * Creates a new OffboardingPlan in DRAFT state. Typically triggered either
 * by an HR admin explicitly initiating an exit, or automatically by the
 * OffboardingInitiationSaga reacting to WorkerTerminated.
 */
@Injectable()
@CommandHandler('CreateOffboardingPlan')
export class CreateOffboardingPlanHandler implements ICommandHandler {
  readonly commandName = 'CreateOffboardingPlan';

  constructor(
    private readonly planRepo: OffboardingPlanRepository,
    private readonly fsm: FsmFramework,
    private readonly eventPublisher: OffboardingEventsPublisher,
  ) {}

  async handle(command: HrCommandEnvelope<unknown>): Promise<CommandResult<unknown>> {
    const payload = command.payload as CreateOffboardingPlanCommandPayload;

    const plan = OffboardingPlan.create(
      {
        id: toUuid(payload.planId),
        tenantId: command.tenantId,
        workerId: toUuid(payload.workerId),
        lastWorkingDay: new Date(payload.lastWorkingDay),
        initiatedBy: toUuid(payload.initiatedBy),
        reasonCategory: payload.reasonCategory,
        reasonNotes: payload.reasonNotes,
        managerId: toOptionalUuid(payload.managerId),
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
      allowedNextActions: this.fsm.getAllowedActionsFromState(plan.status, 'OffboardingPlan'),
      fieldAccessDecisions: {},
      eventsEmitted: ['OffboardingPlanCreated'],
      auditRecordId: Uuid.generate(),
    };
  }
}
