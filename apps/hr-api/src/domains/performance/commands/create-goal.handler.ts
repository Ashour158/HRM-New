import { Injectable } from '@nestjs/common';
import { CommandHandler } from '../../../platform/command-bus/command-handler.decorator.js';
import type { HrCommandEnvelope, CommandResult } from '@hcm/command-contracts';
import { Uuid } from '@hcm/shared-kernel';
import { FsmFramework } from '../../../platform/workflow/fsm-framework.js';
import { Goal } from '../aggregates/goal.aggregate.js';
import { GoalRepository } from '../repositories/goal.repository.js';
import { PerformanceEventsPublisher } from '../events/performance-events.publisher.js';
import { PerformanceGoalPolicyService, type SmartGoalCriteria } from '../services/performance-goal-policy.service.js';

@CommandHandler('CreateGoal')
@Injectable()
export class CreateGoalHandler {
  constructor(
    private readonly repo: GoalRepository,
    private readonly fsm: FsmFramework,
    private readonly publisher: PerformanceEventsPublisher,
    private readonly goalPolicy: PerformanceGoalPolicyService,
  ) {}

  async handle(command: HrCommandEnvelope<unknown>): Promise<CommandResult<unknown>> {
    const payload = command.payload as {
      workerId: Uuid;
      title: string;
      description?: string;
      targetValue?: number;
      unit?: string;
      startDate?: Date;
      dueDate?: Date;
      smartCriteria?: SmartGoalCriteria;
      metricName?: string;
      baselineValue?: number;
      weight?: number;
      reviewCadence?: string;
      evidenceRequired?: boolean;
    };
    this.goalPolicy.assertSmartGoal(payload);
    const ar = Goal.create(
      {
        id: Uuid.generate(),
        tenantId: command.tenantId,
        workerId: payload.workerId,
        title: payload.title,
        description: payload.description,
        targetValue: payload.targetValue,
        unit: payload.unit,
        startDate: payload.startDate,
        dueDate: payload.dueDate,
        smartCriteria: payload.smartCriteria,
        metricName: payload.metricName,
        baselineValue: payload.baselineValue,
        weight: payload.weight,
        reviewCadence: payload.reviewCadence,
        evidenceRequired: payload.evidenceRequired,
      },
      command.correlationId,
    );
    await this.repo.save(ar);
    await this.publisher.publishFromAggregate(ar);
    return {
      success: true,
      data: { goalId: ar.id.value, status: ar.status },
      commandId: command.commandId,
      correlationId: command.correlationId,
      aggregateId: ar.id,
      newState: ar.status,
      newVersion: ar.aggregateVersion,
      allowedNextActions: this.fsm.getAllowedActionsFromState(ar.status, 'Goal'),
      eventsEmitted: ar.domainEvents.map((e) => e.eventName),
      auditRecordId: command.commandId,
    } as CommandResult<unknown>;
  }
}
