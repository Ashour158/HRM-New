import { Injectable } from '@nestjs/common';
import { CommandHandler } from '../../../platform/command-bus/command-handler.decorator.js';
import type { HrCommandEnvelope, CommandResult } from '@hcm/command-contracts';
import { Uuid } from '@hcm/shared-kernel';
import { FsmFramework } from '../../../platform/workflow/fsm-framework.js';
import { HcmSetupService } from '../../hcm-setup/hcm-setup.service.js';
import { AbsenceRequestRepository } from '../repositories/absence-request.repository.js';
import { AbsenceAccrualBalanceRepository } from '../repositories/absence-accrual-balance.repository.js';
import { AbsenceLeaveEventsPublisher } from '../events/absence-leave-events.publisher.js';
import { LeavePolicyService } from '../services/leave-policy.service.js';

@CommandHandler('ApproveAbsenceRequest')
@Injectable()
export class ApproveAbsenceRequestHandler {
  constructor(
    private readonly repo: AbsenceRequestRepository,
    private readonly balanceRepo: AbsenceAccrualBalanceRepository,
    private readonly fsm: FsmFramework,
    private readonly publisher: AbsenceLeaveEventsPublisher,
    private readonly hcmSetupService: HcmSetupService,
    private readonly leavePolicyService: LeavePolicyService,
  ) {}

  async handle(command: HrCommandEnvelope<unknown>): Promise<CommandResult<unknown>> {
    const payload = command.payload as { absenceRequestId: Uuid; approvedBy: Uuid };
    const ar = await this.repo.findById(payload.absenceRequestId);
    if (!ar) throw new Error('Absence request not found');
    await this.assertBalanceImpactAvailable(ar);
    ar.approve(payload.approvedBy, command.correlationId);
    await this.applyBalanceImpact(ar, command.correlationId);
    await this.repo.save(ar);
    await this.publisher.publishFromAggregate(ar);
    return {
      success: true,
      data: {
        absenceRequestId: ar.id.value,
        workerId: ar.workerId.value,
        approvedBy: payload.approvedBy.value,
        status: ar.status,
        absenceType: ar.absenceType,
        policyCode: ar.policyCode,
        startDate: ar.startDate.toISOString().slice(0, 10),
        endDate: ar.endDate.toISOString().slice(0, 10),
        durationAmount: ar.durationAmount,
        durationUnit: ar.durationUnit,
        payrollImpact: ar.payrollImpact,
        amount: ar.payrollImpact === 'UNPAID_LEAVE' ? ar.durationAmount : 0,
        currency: 'EGP',
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

  private async applyBalanceImpact(ar: Awaited<ReturnType<AbsenceRequestRepository['findById']>>, correlationId: Uuid): Promise<void> {
    if (!ar?.deductFromBalance) return;
    const setup = await this.hcmSetupService.getSetup(ar.tenantId);
    const storedHours = this.leavePolicyService.amountToStoredHours(setup, ar.durationUnit, ar.durationAmount);
    const balances = await this.balanceRepo.findByWorker(ar.workerId);
    const balance = balances.find((candidate) => (
      candidate.tenantId.value === ar.tenantId.value
      && candidate.status === 'ACTIVE'
      && (candidate.leaveType === ar.absenceType || candidate.leaveType === ar.policyCode)
    ));
    if (!balance) return;
    balance.update({
      balanceHours: balance.balanceHours - storedHours,
      usedHours: balance.usedHours + storedHours,
    }, correlationId);
    await this.balanceRepo.save(balance);
    await this.publisher.publishFromAggregate(balance);
  }

  private async assertBalanceImpactAvailable(ar: Awaited<ReturnType<AbsenceRequestRepository['findById']>>): Promise<void> {
    if (!ar?.deductFromBalance) return;
    const setup = await this.hcmSetupService.getSetup(ar.tenantId);
    const policy = this.leavePolicyService.resolvePolicy({ leavePolicies: setup.leavePolicies }, ar.policyCode || ar.absenceType);
    const balances = await this.balanceRepo.findByWorker(ar.workerId);
    const balance = balances.find((candidate) => (
      candidate.tenantId.value === ar.tenantId.value
      && candidate.status === 'ACTIVE'
      && (candidate.leaveType === ar.absenceType || candidate.leaveType === ar.policyCode)
    ));
    this.leavePolicyService.assertBalanceAvailable(setup, {
      policy,
      durationUnit: ar.durationUnit,
      durationAmount: ar.durationAmount,
      calendarDays: ar.calendarDays,
      workingDays: ar.workingDays,
      excludedHolidayDates: ar.excludedHolidayDates,
      paid: ar.paid,
      deductFromBalance: ar.deductFromBalance,
      payrollImpact: ar.payrollImpact,
    }, balance?.balanceHours);
  }
}
