import { Injectable } from '@nestjs/common';
import { CommandHandler } from '../../../platform/command-bus/command-handler.decorator.js';
import type { HrCommandEnvelope, CommandResult } from '@hcm/command-contracts';
import { Uuid, ValidationError } from '@hcm/shared-kernel';
import { FsmFramework } from '../../../platform/workflow/fsm-framework.js';
import { HcmSetupService } from '../../hcm-setup/hcm-setup.service.js';
import { AbsenceRequest } from '../aggregates/absence-request.aggregate.js';
import { AbsenceRequestRepository } from '../repositories/absence-request.repository.js';
import { AbsenceAccrualBalanceRepository } from '../repositories/absence-accrual-balance.repository.js';
import { AbsenceLeaveEventsPublisher } from '../events/absence-leave-events.publisher.js';
import { LeavePolicyService } from '../services/leave-policy.service.js';

@CommandHandler('CreateAbsenceRequest')
@Injectable()
export class CreateAbsenceRequestHandler {
  constructor(
    private readonly repo: AbsenceRequestRepository,
    private readonly balanceRepo: AbsenceAccrualBalanceRepository,
    private readonly fsm: FsmFramework,
    private readonly publisher: AbsenceLeaveEventsPublisher,
    private readonly hcmSetupService: HcmSetupService,
    private readonly leavePolicyService: LeavePolicyService,
  ) {}

  async handle(command: HrCommandEnvelope<unknown>): Promise<CommandResult<unknown>> {
    const payload = command.payload as {
      workerId: Uuid;
      absenceType: string;
      startDate: Date;
      endDate: Date;
      startTime?: string;
      endTime?: string;
      reason?: string;
    };
    const setup = await this.hcmSetupService.getSetup(command.tenantId);
    const duration = this.leavePolicyService.calculateDuration(setup, payload);
    const balance = await this.findBalance(command.tenantId, payload.workerId, payload.absenceType, duration.policy.code);
    this.leavePolicyService.assertBalanceAvailable(setup, duration, balance?.balanceHours);
    if (!duration.policy.requestableByEmployee && !this.hasSetupAdminScope(command)) {
      throw new ValidationError(`${duration.policy.label} is system-managed and cannot be requested by employees`);
    }
    const overlapping = await this.repo.findOverlappingByWorker(
      command.tenantId,
      payload.workerId,
      payload.startDate,
      payload.endDate,
      ['PENDING_APPROVAL', 'APPROVED'],
    );
    if (overlapping.length > 0) {
      throw new ValidationError('Employee already has an overlapping pending or approved leave request');
    }
    const existingRequests = (await this.repo.findByWorker(payload.workerId)).filter((request) => (
      request.tenantId.value === command.tenantId.value
    ));
    this.leavePolicyService.assertPeriodLimits(duration, existingRequests, payload.startDate);
    const approvalDecision = this.leavePolicyService.resolveApprovalDecision(duration, {
      absenceType: payload.absenceType,
      startDate: payload.startDate,
    });
    const ar = AbsenceRequest.create(
      {
        id: Uuid.generate(),
        tenantId: command.tenantId,
        workerId: payload.workerId,
        absenceType: payload.absenceType,
        policyCode: duration.policy.code,
        startDate: payload.startDate,
        endDate: payload.endDate,
        durationUnit: duration.durationUnit,
        durationAmount: duration.durationAmount,
        startTime: payload.startTime,
        endTime: payload.endTime,
        paid: duration.paid,
        deductFromBalance: duration.deductFromBalance,
        payrollImpact: duration.payrollImpact,
        calendarDays: duration.calendarDays,
        workingDays: duration.workingDays,
        excludedHolidayDates: duration.excludedHolidayDates,
        reason: payload.reason,
      },
      command.correlationId,
    );
    await this.repo.save(ar);
    await this.publisher.publishFromAggregate(ar);
    return {
      success: true,
      data: {
        absenceRequestId: ar.id.value,
        status: ar.status,
        durationAmount: ar.durationAmount,
        durationUnit: ar.durationUnit,
        payrollImpact: ar.payrollImpact,
        approvalWorkflow: approvalDecision.approvalWorkflow,
        requiresDocument: approvalDecision.requiresDocument,
        requiredDocumentCodes: approvalDecision.requiredDocumentCodes,
        policyDecision: approvalDecision,
      },
      commandId: command.commandId,
      correlationId: command.correlationId,
      aggregateId: ar.id,
      newState: ar.status,
      newVersion: ar.aggregateVersion,
      allowedNextActions: this.fsm.getAllowedActionsFromState(ar.status, 'AbsenceRequest'),
      eventsEmitted: ar.domainEvents.map((e) => e.eventName),
      auditRecordId: command.commandId,
    } as CommandResult<unknown>;
  }

  private hasSetupAdminScope(command: HrCommandEnvelope<unknown>): boolean {
    return (command.actor.roles ?? []).some((role) => ['APP_ADMIN', 'PLATFORM_ADMIN', 'SUPER_ADMIN', 'HR_ADMIN'].includes(role));
  }

  private async findBalance(tenantId: Uuid, workerId: Uuid, absenceType: string, policyCode: string) {
    const balances = await this.balanceRepo.findByWorker(workerId);
    return balances.find((candidate) => (
      candidate.tenantId.value === tenantId.value
      && candidate.status === 'ACTIVE'
      && (candidate.leaveType === absenceType || candidate.leaveType === policyCode)
    ));
  }
}
