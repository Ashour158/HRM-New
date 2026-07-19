import { Injectable } from '@nestjs/common';
import { Uuid } from '@hcm/shared-kernel';
import type { HrCommandEnvelope, CommandResult } from '@hcm/command-contracts';
import { CommandHandler } from '../../../platform/command-bus/command-handler.decorator.js';
import type { CommandHandler as ICommandHandler } from '../../../platform/command-bus/command-bus.js';
import { HeadcountBudget } from '../aggregates/headcount-budget.aggregate.js';
import { HeadcountBudgetRepository } from '../repositories/headcount-budget.repository.js';

export interface ConfigureHeadcountBudgetCommandPayload {
  departmentId: string;
  fiscalYear: number;
  ceiling: number;
}

/**
 * Handler for the ConfigureHeadcountBudget command.
 *
 * Configures the budgeted FTE/headcount ceiling for a single org unit
 * (department) for a single fiscal year. Idempotent upsert: re-issuing the
 * command for the same (tenant, department, fiscalYear) tuple re-sets the
 * ceiling on the existing {@link HeadcountBudget} rather than creating a
 * duplicate. There is no separate lifecycle/FSM for budgets — a budget is
 * simply "configured" from the moment it is first set.
 */
@Injectable()
@CommandHandler('ConfigureHeadcountBudget')
export class ConfigureHeadcountBudgetHandler implements ICommandHandler {
  readonly commandName = 'ConfigureHeadcountBudget';

  constructor(
    private readonly budgetRepo: HeadcountBudgetRepository,
  ) {}

  async handle(command: HrCommandEnvelope<unknown>): Promise<CommandResult<unknown>> {
    const payload = command.payload as ConfigureHeadcountBudgetCommandPayload;
    const departmentId = new Uuid(payload.departmentId);

    const existing = await this.budgetRepo.findByDepartmentAndYear(command.tenantId, departmentId, payload.fiscalYear);

    let budget: HeadcountBudget;
    let eventName: string;
    if (existing) {
      existing.updateCeiling(payload.ceiling, command.actor.actorId, command.correlationId);
      budget = existing;
      eventName = 'HeadcountBudgetCeilingUpdated';
    } else {
      budget = HeadcountBudget.create({
        id: Uuid.generate(),
        tenantId: command.tenantId,
        departmentId,
        fiscalYear: payload.fiscalYear,
        ceiling: payload.ceiling,
        setBy: command.actor.actorId,
      });
      eventName = 'HeadcountBudgetSet';
    }

    await this.budgetRepo.save(budget);

    return {
      success: true,
      data: {
        headcountBudgetId: budget.id.value,
        departmentId: budget.departmentId.value,
        fiscalYear: budget.fiscalYear,
        ceiling: budget.ceiling,
      },
      commandId: command.commandId,
      correlationId: command.correlationId,
      aggregateId: budget.id,
      newState: 'ACTIVE',
      newVersion: budget.version,
      allowedNextActions: ['ConfigureHeadcountBudget'],
      fieldAccessDecisions: {},
      eventsEmitted: [eventName],
      auditRecordId: Uuid.generate(),
    };
  }
}
