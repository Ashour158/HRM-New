import { Injectable, NotFoundException } from '@nestjs/common';
import { Uuid, ConflictError } from '@hcm/shared-kernel';
import type { HrCommandEnvelope, CommandResult } from '@hcm/command-contracts';
import { CommandHandler } from '../../../platform/command-bus/command-handler.decorator.js';
import type { CommandHandler as ICommandHandler } from '../../../platform/command-bus/command-bus.js';
import { HeadcountRequestRepository } from '../repositories/headcount-request.repository.js';
import { HeadcountBudgetRepository } from '../repositories/headcount-budget.repository.js';

export interface ApproveHeadcountRequestCommandPayload {
  requestId: string;
  positionsApproved: number;
  /**
   * Fiscal year to check the org unit's headcount budget against. Defaults to
   * the current calendar year (matching the convention already used for
   * request-number generation) when omitted.
   */
  fiscalYear?: number;
}

/**
 * Handler for the ApproveHeadcountRequest command.
 *
 * Enforces SoD: approver cannot be the requester.
 * Enforces the org unit's headcount budget (see {@link HeadcountBudgetRepository}):
 * approval is rejected — fail closed — if it would push the department's total
 * approved headcount for the fiscal year over its configured ceiling. When no
 * budget has been configured for the department/year, this check is a no-op
 * (there is nothing to enforce against), and approval proceeds unconstrained.
 * May trigger Position creation if auto-create is enabled.
 */
@Injectable()
@CommandHandler('ApproveHeadcountRequest')
export class ApproveHeadcountRequestHandler implements ICommandHandler {
  readonly commandName = 'ApproveHeadcountRequest';

  constructor(
    private readonly headcountRepo: HeadcountRequestRepository,
    private readonly budgetRepo: HeadcountBudgetRepository,
  ) {}

  async handle(command: HrCommandEnvelope<unknown>): Promise<CommandResult<unknown>> {
    const payload = command.payload as ApproveHeadcountRequestCommandPayload;
    const request = await this.headcountRepo.findById(new Uuid(payload.requestId));
    if (!request) {
      throw new NotFoundException('Headcount request not found');
    }

    await this.enforceHeadcountBudget(request.tenantId, request.departmentId, payload);

    request.approve(command.actor.actorId, payload.positionsApproved, command.correlationId);
    await this.headcountRepo.save(request);

    return {
      success: true,
      data: {
        headcountRequestId: request.id.value,
        approvedBy: command.actor.actorId.value,
        status: request.status,
        positionsApproved: request.positionsApproved,
      },
      commandId: command.commandId,
      correlationId: command.correlationId,
      aggregateId: request.id,
      newState: request.status,
      newVersion: request.version,
      allowedNextActions: [],
      fieldAccessDecisions: {},
      eventsEmitted: ['HeadcountRequestApproved'],
      auditRecordId: Uuid.generate(),
    };
  }

  /**
   * Fail-closed headcount budget gate.
   *
   * Requests with no `departmentId` cannot be attributed to any org unit's
   * budget and are left unconstrained. Otherwise, if a {@link HeadcountBudget}
   * is configured for the department/fiscal-year, this rejects the approval
   * when `currentApprovedTotal + positionsApproved` would exceed the ceiling.
   */
  private async enforceHeadcountBudget(
    tenantId: Uuid,
    departmentId: Uuid | undefined,
    payload: ApproveHeadcountRequestCommandPayload,
  ): Promise<void> {
    if (!departmentId) {
      return;
    }

    const fiscalYear = payload.fiscalYear ?? new Date().getFullYear();
    const budget = await this.budgetRepo.findByDepartmentAndYear(tenantId, departmentId, fiscalYear);
    if (!budget) {
      return;
    }

    const currentApprovedTotal = await this.headcountRepo.sumApprovedPositionsByDepartment(tenantId, departmentId);
    const projectedTotal = currentApprovedTotal + payload.positionsApproved;

    if (projectedTotal > budget.ceiling) {
      throw new ConflictError(
        `Approving ${payload.positionsApproved} position(s) for org unit ${departmentId.value} would bring its `
        + `approved headcount to ${projectedTotal} for fiscal year ${fiscalYear}, exceeding the budgeted ceiling `
        + `of ${budget.ceiling} (currently ${currentApprovedTotal} approved).`,
        {
          departmentId: departmentId.value,
          fiscalYear,
          requestedApproval: payload.positionsApproved,
          currentApprovedTotal,
          budgetCeiling: budget.ceiling,
          projectedTotal,
        },
      );
    }
  }
}
