import { Body, Controller, ForbiddenException, Get, Param, Post, Query, Req, UseGuards, BadRequestException } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { randomUUID } from 'crypto';
import { z } from 'zod';
import { Uuid } from '@hcm/shared-kernel';
import { computeRequestHash } from '@hcm/platform-core';
import type { CommandOutcome, CommandResult, HrCommandEnvelope } from '@hcm/command-contracts';
import { AuthGuard } from '../../../guards/auth.guard.js';
import { CommandBus } from '../../../platform/command-bus/command-bus.js';
import type { WorkerProfile } from '../../hr-core/aggregates/worker-profile.aggregate.js';
import { WorkerRepository } from '../../hr-core/repositories/worker.repository.js';
import { HcmSetupService } from '../../hcm-setup/hcm-setup.service.js';
import type { LeavePolicy } from '../../hcm-setup/hcm-setup.types.js';
import { AbsenceRequest, type AbsenceRequestStatus } from '../aggregates/absence-request.aggregate.js';
import { AbsenceAccrualBalanceRepository } from '../repositories/absence-accrual-balance.repository.js';
import { AbsenceRequestRepository } from '../repositories/absence-request.repository.js';
import { LeavePolicyService } from '../services/leave-policy.service.js';
import { ZodValidationPipe } from './dtos.js';

const EmployeeLeaveRequestDtoSchema = z.object({
  type: z.string().min(1).optional(),
  absenceType: z.string().min(1).optional(),
  startDate: z.coerce.date(),
  endDate: z.coerce.date(),
  startTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/).optional(),
  endTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/).optional(),
  reason: z.string().optional(),
}).refine((value) => value.type || value.absenceType, {
  message: 'Leave type is required',
  path: ['type'],
});

type EmployeeLeaveRequestDto = z.infer<typeof EmployeeLeaveRequestDtoSchema>;

function statusForUi(status: AbsenceRequestStatus): 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED' {
  if (status === 'APPROVED') return 'APPROVED';
  if (status === 'REJECTED') return 'REJECTED';
  if (status === 'CANCELLED') return 'CANCELLED';
  return 'PENDING';
}

function toDateKey(value: Date): string {
  return value.toISOString().slice(0, 10);
}

@ApiTags('Employee Leave')
@UseGuards(AuthGuard)
@Controller()
export class EmployeeLeaveController {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly workerRepo: WorkerRepository,
    private readonly absenceRequestRepo: AbsenceRequestRepository,
    private readonly accrualBalanceRepo: AbsenceAccrualBalanceRepository,
    private readonly hcmSetupService: HcmSetupService,
    private readonly leavePolicyService: LeavePolicyService,
  ) {}

  private getTenantId(req: Request): Uuid {
    return new Uuid((req['tenantId'] as string | undefined) ?? '00000000-0000-0000-0000-000000000001');
  }

  private getActorId(req: Request): string {
    const actorId = req.actor?.actorId;
    if (actorId instanceof Uuid) return actorId.value;
    const actorIdLike = actorId as { value?: unknown } | undefined;
    if (typeof actorIdLike?.value === 'string') return actorIdLike.value;
    throw new ForbiddenException('Authenticated actor is required');
  }

  private getActorEmail(req: Request): string | undefined {
    return (req.actor as { email?: string } | undefined)?.email;
  }

  private hasAnyRole(req: Request, roles: string[]): boolean {
    return (req.actor?.roles ?? []).some((role) => roles.includes(role));
  }

  private hasLeaveAdminScope(req: Request): boolean {
    return this.hasAnyRole(req, ['HR_ADMIN', 'HRBP', 'SUPER_ADMIN']);
  }

  private hasManagerScope(req: Request): boolean {
    return this.hasAnyRole(req, ['MANAGER']);
  }

  private async resolveSelfWorker(req: Request): Promise<WorkerProfile | undefined> {
    const actorId = this.getActorId(req);
    try {
      const worker = await this.workerRepo.findById(new Uuid(actorId));
      if (worker) return worker;
    } catch {
      // Identity-provider subject IDs are not always worker IDs.
    }

    const email = this.getActorEmail(req);
    return email ? this.workerRepo.findByEmail(email) : undefined;
  }

  private async assertCanReviewRequest(req: Request, request: AbsenceRequest): Promise<Uuid> {
    if (this.hasLeaveAdminScope(req)) {
      return this.resolveActorAsWorkerId(req);
    }
    if (!this.hasManagerScope(req)) {
      throw new ForbiddenException('Only managers or HR can review leave requests');
    }
    const manager = await this.resolveSelfWorker(req);
    const worker = await this.workerRepo.findById(request.workerId);
    if (!manager || worker?.managerId?.value !== manager.id.value) {
      throw new ForbiddenException('Managers can only review direct-report leave requests');
    }
    return manager.id;
  }

  private async resolveActorAsWorkerId(req: Request): Promise<Uuid> {
    const worker = await this.resolveSelfWorker(req);
    if (worker) return worker.id;
    try {
      return new Uuid(this.getActorId(req));
    } catch {
      return Uuid.generate();
    }
  }

  private buildCommand<TPayload>(
    commandName: string,
    aggregateType: string,
    payload: TPayload,
    req: Request,
    options?: { aggregateId?: Uuid; expectedState?: string; expectedVersion?: number; subjectWorkerId?: Uuid },
  ): HrCommandEnvelope<TPayload> {
    if (!req.actor) throw new ForbiddenException('Authenticated actor is required');
    return {
      commandId: Uuid.generate(),
      commandName,
      commandSchemaVersion: 1,
      tenantId: this.getTenantId(req),
      actor: req.actor,
      aggregateType,
      aggregateId: options?.aggregateId,
      expectedState: options?.expectedState,
      expectedVersion: options?.expectedVersion,
      subjectWorkerId: options?.subjectWorkerId,
      idempotencyKey: randomUUID(),
      correlationId: Uuid.generate(),
      reason: 'API request',
      payload,
      metadata: { requestHash: computeRequestHash(payload), clientType: 'EMPLOYEE_PORTAL' },
    };
  }

  private assertCommandSucceeded<TData>(outcome: CommandOutcome<TData>): CommandResult<TData> {
    if (outcome.success) return outcome;
    throw new BadRequestException({
      errorCode: outcome.errorCode,
      errorMessage: outcome.errorMessage,
      errorDetails: outcome.errorDetails,
      stepFailed: outcome.stepFailed,
      retryable: outcome.retryable,
    });
  }

  private toAbsenceDto(request: AbsenceRequest, worker?: WorkerProfile) {
    return {
      id: request.id.value,
      workerId: request.workerId.value,
      employeeId: worker?.employeeNumber,
      employeeName: worker ? `${worker.firstName} ${worker.lastName}` : undefined,
      type: request.absenceType,
      absenceType: request.absenceType,
      startDate: toDateKey(request.startDate),
      endDate: toDateKey(request.endDate),
      status: statusForUi(request.status),
      workflowStatus: request.status,
      reason: request.reason,
      requestedAt: (request.submittedAt ?? request.createdAt).toISOString(),
      approvedBy: request.approvedBy?.value,
      approvedAt: request.approvedAt?.toISOString(),
      durationAmount: request.durationAmount,
      durationUnit: request.durationUnit,
      payrollImpact: request.payrollImpact,
      paid: request.paid,
      deductFromBalance: request.deductFromBalance,
      calendarDays: request.calendarDays,
      workingDays: request.workingDays,
      excludedHolidayDates: request.excludedHolidayDates,
      startTime: request.startTime,
      endTime: request.endTime,
    };
  }

  private async toAbsenceDtos(requests: AbsenceRequest[]) {
    const workers = await Promise.all(requests.map((request) => this.workerRepo.findById(request.workerId)));
    return requests
      .map((request, index) => this.toAbsenceDto(request, workers[index]))
      .sort((left, right) => right.requestedAt.localeCompare(left.requestedAt));
  }

  @Get('employee/absences')
  async getEmployeeAbsences(@Req() req: Request) {
    const worker = await this.resolveSelfWorker(req);
    if (!worker) throw new ForbiddenException('No employee profile is linked to the authenticated user');
    return this.toAbsenceDtos(await this.absenceRequestRepo.findByWorker(worker.id));
  }

  @Get('employee/absences/balance')
  async getEmployeeLeaveBalance(@Req() req: Request) {
    const worker = await this.resolveSelfWorker(req);
    if (!worker) throw new ForbiddenException('No employee profile is linked to the authenticated user');
    const setup = await this.hcmSetupService.getSetup(this.getTenantId(req));
    const balances = await this.accrualBalanceRepo.findByWorker(worker.id);
    if (balances.length === 0) {
      return setup.leavePolicies
        .filter((policy) => policy.active && policy.requestableByEmployee && policy.deductFromBalance && policy.annualEntitlement !== undefined)
        .map((policy) => ({
          type: policy.code,
          label: policy.label,
          total: policy.annualEntitlement ?? 0,
          used: 0,
          remaining: policy.annualEntitlement ?? 0,
          unit: policy.unit.toLowerCase(),
        }));
    }
    return balances.map((balance) => {
      const policy = this.resolvePolicyOrFallback(setup.leavePolicies, balance.leaveType);
      return {
        type: balance.leaveType,
        label: policy.label,
        total: this.leavePolicyService.amountFromStoredHours(setup, policy, balance.accruedHours + balance.carriedOverHours),
        used: this.leavePolicyService.amountFromStoredHours(setup, policy, balance.usedHours),
        remaining: this.leavePolicyService.amountFromStoredHours(setup, policy, balance.balanceHours),
        unit: policy.unit.toLowerCase(),
      };
    });
  }

  @Get('employee/absences/policies')
  async getEmployeeLeavePolicies(@Req() req: Request) {
    const setup = await this.hcmSetupService.getSetup(this.getTenantId(req));
    return {
      policies: setup.leavePolicies.filter((policy) => policy.active && policy.requestableByEmployee),
      publicHolidays: [
        ...(setup.attendancePolicy.holidayCalendars ?? []),
        ...(setup.attendancePolicy.holidays ?? []).map((holiday) => ({ ...holiday })),
      ].sort((left, right) => left.date.localeCompare(right.date)),
      standardDailyMinutes: setup.attendancePolicy.standardDailyMinutes,
      workDays: setup.attendancePolicy.workDays ?? [0, 1, 2, 3, 4],
    };
  }

  @Post('employee/absences')
  async createEmployeeAbsence(
    @Body(new ZodValidationPipe(EmployeeLeaveRequestDtoSchema)) dto: EmployeeLeaveRequestDto,
    @Req() req: Request,
  ) {
    const worker = await this.resolveSelfWorker(req);
    if (!worker) throw new ForbiddenException('No employee profile is linked to the authenticated user');
    if (dto.startDate.getTime() > dto.endDate.getTime()) throw new BadRequestException('Leave start date must be before end date');
    const payload = {
      workerId: worker.id,
      absenceType: dto.absenceType ?? dto.type as string,
      startDate: dto.startDate,
      endDate: dto.endDate,
      startTime: dto.startTime,
      endTime: dto.endTime,
      reason: dto.reason,
    };
    const created = this.assertCommandSucceeded(await this.commandBus.execute<typeof payload, { absenceRequestId: string }>(this.buildCommand('CreateAbsenceRequest', 'AbsenceRequest', payload, req, {
      subjectWorkerId: worker.id,
    })));
    const absenceRequestId = 'data' in created ? (created.data as { absenceRequestId: string }).absenceRequestId : undefined;
    if (!absenceRequestId) return created;
    const request = await this.absenceRequestRepo.findById(new Uuid(absenceRequestId));
    if (!request) return created;
    this.assertCommandSucceeded(await this.commandBus.execute(this.buildCommand('SubmitAbsenceRequest', 'AbsenceRequest', { absenceRequestId: request.id }, req, {
      aggregateId: request.id,
      expectedState: request.status,
      expectedVersion: request.aggregateVersion,
      subjectWorkerId: worker.id,
    })));
    const updated = await this.absenceRequestRepo.findById(request.id);
    return this.toAbsenceDto(updated ?? request, worker);
  }

  @Get('manager/dashboard')
  async getManagerDashboard(@Req() req: Request) {
    const manager = await this.resolveSelfWorker(req);
    if (!manager && !this.hasLeaveAdminScope(req)) throw new ForbiddenException('No manager employee profile is linked to the authenticated user');
    const directReports = manager ? await this.workerRepo.findByManager(manager.id) : [];
    const reportIds = new Set(directReports.map((worker) => worker.id.value));
    const pendingRequests = this.hasLeaveAdminScope(req)
      ? await this.absenceRequestRepo.findByTenant(this.getTenantId(req), 'PENDING_APPROVAL')
      : (await Promise.all(directReports.map((worker) => this.absenceRequestRepo.findByWorker(worker.id))))
        .flat()
        .filter((request) => request.status === 'PENDING_APPROVAL' && reportIds.has(request.workerId.value));
    return {
      directReports: directReports.map((worker) => ({
        id: worker.id.value,
        employeeId: worker.employeeNumber,
        firstName: worker.firstName,
        lastName: worker.lastName,
        email: worker.email.toString(),
        hireDate: worker.hireDate?.toISOString() ?? null,
        status: worker.status,
        jobTitle: worker.jobTitle ?? undefined,
        departmentId: worker.departmentId?.value,
        managerId: worker.managerId?.value,
      })),
      pendingApprovals: {
        absences: await this.toAbsenceDtos(pendingRequests),
        timesheets: 0,
        expenses: 0,
      },
      teamMetrics: {
        headcount: directReports.length,
        averagePerformance: 0,
        openGoals: 0,
      },
    };
  }

  @Get('employee/manager/dashboard')
  async getEmployeeManagerDashboard(@Req() req: Request) {
    return this.getManagerDashboard(req);
  }

  @Get('manager/leave/requests')
  async getManagerLeaveRequests(@Query('status') status: string | undefined, @Req() req: Request) {
    const manager = await this.resolveSelfWorker(req);
    if (!manager && !this.hasLeaveAdminScope(req)) throw new ForbiddenException('No manager employee profile is linked to the authenticated user');
    if (this.hasLeaveAdminScope(req)) {
      return this.toAbsenceDtos(await this.absenceRequestRepo.findByTenant(this.getTenantId(req), status as AbsenceRequestStatus | undefined));
    }
    const directReports = await this.workerRepo.findByManager(manager!.id);
    const requests = (await Promise.all(directReports.map((worker) => this.absenceRequestRepo.findByWorker(worker.id)))).flat();
    return this.toAbsenceDtos(status ? requests.filter((request) => request.status === status) : requests);
  }

  @Get('employee/manager/leave/requests')
  async getEmployeeManagerLeaveRequests(@Query('status') status: string | undefined, @Req() req: Request) {
    return this.getManagerLeaveRequests(status, req);
  }

  @Post('manager/leave/requests/:id/approve')
  async approveLeaveRequest(@Param('id') id: string, @Req() req: Request) {
    const request = await this.absenceRequestRepo.findById(new Uuid(id));
    if (!request) throw new BadRequestException('Leave request not found');
    const approvedBy = await this.assertCanReviewRequest(req, request);
    this.assertCommandSucceeded(await this.commandBus.execute(this.buildCommand('ApproveAbsenceRequest', 'AbsenceRequest', { absenceRequestId: request.id, approvedBy }, req, {
      aggregateId: request.id,
      expectedState: request.status,
      expectedVersion: request.aggregateVersion,
      subjectWorkerId: request.workerId,
    })));
    const updated = await this.absenceRequestRepo.findById(request.id);
    return this.toAbsenceDto(updated ?? request, await this.workerRepo.findById(request.workerId));
  }

  @Post('employee/manager/leave/requests/:id/approve')
  async approveEmployeeManagerLeaveRequest(@Param('id') id: string, @Req() req: Request) {
    return this.approveLeaveRequest(id, req);
  }

  @Post('manager/leave/requests/:id/reject')
  async rejectLeaveRequest(
    @Param('id') id: string,
    @Body() body: { reason?: string } | undefined,
    @Req() req: Request,
  ) {
    const request = await this.absenceRequestRepo.findById(new Uuid(id));
    if (!request) throw new BadRequestException('Leave request not found');
    await this.assertCanReviewRequest(req, request);
    this.assertCommandSucceeded(await this.commandBus.execute(this.buildCommand('RejectAbsenceRequest', 'AbsenceRequest', {
      absenceRequestId: request.id,
      rejectionReason: body?.reason,
    }, req, {
      aggregateId: request.id,
      expectedState: request.status,
      expectedVersion: request.aggregateVersion,
      subjectWorkerId: request.workerId,
    })));
    const updated = await this.absenceRequestRepo.findById(request.id);
    return this.toAbsenceDto(updated ?? request, await this.workerRepo.findById(request.workerId));
  }

  @Post('employee/manager/leave/requests/:id/reject')
  async rejectEmployeeManagerLeaveRequest(
    @Param('id') id: string,
    @Body() body: { reason?: string } | undefined,
    @Req() req: Request,
  ) {
    return this.rejectLeaveRequest(id, body, req);
  }

  private resolvePolicyOrFallback(policies: LeavePolicy[], leaveType: string): LeavePolicy {
    try {
      return this.leavePolicyService.resolvePolicy({ leavePolicies: policies }, leaveType);
    } catch {
      return {
        code: leaveType,
        label: leaveType,
        active: true,
        unit: 'HOURS',
        paid: true,
        deductFromBalance: true,
        requestableByEmployee: true,
        payrollImpact: 'PAID_LEAVE',
        approvalWorkflow: 'MANAGER',
      };
    }
  }
}
