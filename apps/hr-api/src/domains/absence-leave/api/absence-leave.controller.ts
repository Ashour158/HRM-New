import { Controller, Get, Post, Body, Param, Req, BadRequestException } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { randomUUID } from 'crypto';
import { CommandBus } from '../../../platform/command-bus/command-bus.js';
import { Uuid } from '@hcm/shared-kernel';
import { computeRequestHash } from '@hcm/platform-core';
import type { HrCommandEnvelope } from '@hcm/command-contracts';
import { AbsenceRequestRepository } from '../repositories/absence-request.repository.js';
import { LeaveCaseRepository } from '../repositories/leave-case.repository.js';
import { AbsenceAccrualBalanceRepository } from '../repositories/absence-accrual-balance.repository.js';
import { LeaveEntitlementCalculationRepository } from '../repositories/leave-entitlement-calculation.repository.js';
import type * as dtos from './dtos.js';
import {
  CreateAbsenceRequestDtoSchema, OpenLeaveCaseDtoSchema,
  CreateAbsenceAccrualBalanceDtoSchema, StartLeaveEntitlementCalculationDtoSchema, ZodValidationPipe,
} from './dtos.js';

@ApiTags('Absence & Leave')
@Controller('absence/leave')
export class AbsenceLeaveController {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly absenceRequestRepo: AbsenceRequestRepository,
    private readonly leaveCaseRepo: LeaveCaseRepository,
    private readonly accrualBalanceRepo: AbsenceAccrualBalanceRepository,
    private readonly entitlementCalculationRepo: LeaveEntitlementCalculationRepository,
  ) {}

  private buildCommand<TPayload>(
    commandName: string,
    aggregateType: string,
    payload: TPayload,
    req: Request,
    options?: { aggregateId?: Uuid; expectedState?: string; expectedVersion?: number; subjectWorkerId?: Uuid },
  ): HrCommandEnvelope<TPayload> {
    const tenantId = new Uuid((req['tenantId'] as string | undefined) ?? '00000000-0000-0000-0000-000000000001');
    return {
      commandId: Uuid.generate(),
      commandName,
      commandSchemaVersion: 1,
      tenantId,
      actor: { actorType: 'SYSTEM', actorId: Uuid.generate(), roles: ['HR_ADMIN'], permissions: ['ABSENCE_LEAVE_WRITE'], mfaAuthenticated: true },
      aggregateType,
      aggregateId: options?.aggregateId,
      expectedState: options?.expectedState,
      expectedVersion: options?.expectedVersion,
      subjectWorkerId: options?.subjectWorkerId,
      idempotencyKey: randomUUID(),
      correlationId: Uuid.generate(),
      reason: 'API request',
      payload,
      metadata: { requestHash: computeRequestHash(payload), clientType: 'HR_ADMIN' },
    };
  }

  /* Absence Requests */
  @Post('absence-requests')
  async createAbsenceRequest(@Body(new ZodValidationPipe(CreateAbsenceRequestDtoSchema)) dto: dtos.CreateAbsenceRequestDto, @Req() req: Request) {
    return this.commandBus.execute(this.buildCommand('CreateAbsenceRequest', 'AbsenceRequest', dto, req));
  }

  @Post('absence-requests/:id/commands/submit')
  async submitAbsenceRequest(@Param('id') id: string, @Req() req: Request) {
    const ar = await this.absenceRequestRepo.findById(new Uuid(id));
    if (!ar) throw new BadRequestException('Absence request not found');
    return this.commandBus.execute(this.buildCommand('SubmitAbsenceRequest', 'AbsenceRequest', { absenceRequestId: new Uuid(id) }, req, { aggregateId: new Uuid(id), expectedState: ar.status, expectedVersion: ar.aggregateVersion }));
  }

  @Post('absence-requests/:id/commands/approve')
  async approveAbsenceRequest(@Param('id') id: string, @Req() req: Request) {
    const ar = await this.absenceRequestRepo.findById(new Uuid(id));
    if (!ar) throw new BadRequestException('Absence request not found');
    return this.commandBus.execute(this.buildCommand('ApproveAbsenceRequest', 'AbsenceRequest', { absenceRequestId: new Uuid(id), approvedBy: Uuid.generate() }, req, { aggregateId: new Uuid(id), expectedState: ar.status, expectedVersion: ar.aggregateVersion }));
  }

  @Post('absence-requests/:id/commands/reject')
  async rejectAbsenceRequest(@Param('id') id: string, @Req() req: Request) {
    const ar = await this.absenceRequestRepo.findById(new Uuid(id));
    if (!ar) throw new BadRequestException('Absence request not found');
    return this.commandBus.execute(this.buildCommand('RejectAbsenceRequest', 'AbsenceRequest', { absenceRequestId: new Uuid(id) }, req, { aggregateId: new Uuid(id), expectedState: ar.status, expectedVersion: ar.aggregateVersion }));
  }

  @Post('absence-requests/:id/commands/cancel')
  async cancelAbsenceRequest(@Param('id') id: string, @Req() req: Request) {
    const ar = await this.absenceRequestRepo.findById(new Uuid(id));
    if (!ar) throw new BadRequestException('Absence request not found');
    return this.commandBus.execute(this.buildCommand('CancelAbsenceRequest', 'AbsenceRequest', { absenceRequestId: new Uuid(id) }, req, { aggregateId: new Uuid(id), expectedState: ar.status, expectedVersion: ar.aggregateVersion }));
  }

  @Get('absence-requests/:id')
  async getAbsenceRequest(@Param('id') id: string) {
    return this.absenceRequestRepo.findById(new Uuid(id));
  }

  @Get('absence-requests/worker/:workerId')
  async getAbsenceRequestsByWorker(@Param('workerId') workerId: string) {
    return this.absenceRequestRepo.findByWorker(new Uuid(workerId));
  }

  /* Leave Cases */
  @Post('leave-cases')
  async openLeaveCase(@Body(new ZodValidationPipe(OpenLeaveCaseDtoSchema)) dto: dtos.OpenLeaveCaseDto, @Req() req: Request) {
    return this.commandBus.execute(this.buildCommand('OpenLeaveCase', 'LeaveCase', dto, req));
  }

  @Post('leave-cases/:id/commands/approve')
  async approveLeaveCase(@Param('id') id: string, @Req() req: Request) {
    const lc = await this.leaveCaseRepo.findById(new Uuid(id));
    if (!lc) throw new BadRequestException('Leave case not found');
    return this.commandBus.execute(this.buildCommand('ApproveLeaveCase', 'LeaveCase', { leaveCaseId: new Uuid(id) }, req, { aggregateId: new Uuid(id), expectedState: lc.status, expectedVersion: lc.aggregateVersion }));
  }

  @Post('leave-cases/:id/commands/activate')
  async activateLeaveCase(@Param('id') id: string, @Req() req: Request) {
    const lc = await this.leaveCaseRepo.findById(new Uuid(id));
    if (!lc) throw new BadRequestException('Leave case not found');
    return this.commandBus.execute(this.buildCommand('ActivateLeaveCase', 'LeaveCase', { leaveCaseId: new Uuid(id) }, req, { aggregateId: new Uuid(id), expectedState: lc.status, expectedVersion: lc.aggregateVersion }));
  }

  @Post('leave-cases/:id/commands/plan-return')
  async planReturnToWork(@Param('id') id: string, @Req() req: Request) {
    const lc = await this.leaveCaseRepo.findById(new Uuid(id));
    if (!lc) throw new BadRequestException('Leave case not found');
    return this.commandBus.execute(this.buildCommand('PlanReturnToWork', 'LeaveCase', { leaveCaseId: new Uuid(id) }, req, { aggregateId: new Uuid(id), expectedState: lc.status, expectedVersion: lc.aggregateVersion }));
  }

  @Post('leave-cases/:id/commands/close')
  async closeLeaveCase(@Param('id') id: string, @Req() req: Request) {
    const lc = await this.leaveCaseRepo.findById(new Uuid(id));
    if (!lc) throw new BadRequestException('Leave case not found');
    return this.commandBus.execute(this.buildCommand('CloseLeaveCase', 'LeaveCase', { leaveCaseId: new Uuid(id) }, req, { aggregateId: new Uuid(id), expectedState: lc.status, expectedVersion: lc.aggregateVersion }));
  }

  @Post('leave-cases/:id/commands/reject')
  async rejectLeaveCase(@Param('id') id: string, @Req() req: Request) {
    const lc = await this.leaveCaseRepo.findById(new Uuid(id));
    if (!lc) throw new BadRequestException('Leave case not found');
    return this.commandBus.execute(this.buildCommand('RejectLeaveCase', 'LeaveCase', { leaveCaseId: new Uuid(id) }, req, { aggregateId: new Uuid(id), expectedState: lc.status, expectedVersion: lc.aggregateVersion }));
  }

  @Get('leave-cases/:id')
  async getLeaveCase(@Param('id') id: string) {
    return this.leaveCaseRepo.findById(new Uuid(id));
  }

  @Get('leave-cases/worker/:workerId')
  async getLeaveCasesByWorker(@Param('workerId') workerId: string) {
    return this.leaveCaseRepo.findByWorker(new Uuid(workerId));
  }

  /* Accrual Balances */
  @Post('accrual-balances')
  async createAccrualBalance(@Body(new ZodValidationPipe(CreateAbsenceAccrualBalanceDtoSchema)) dto: dtos.CreateAbsenceAccrualBalanceDto, @Req() req: Request) {
    return this.commandBus.execute(this.buildCommand('CreateAbsenceAccrualBalance', 'AbsenceAccrualBalance', dto, req));
  }

  @Post('accrual-balances/:id/commands/update')
  async updateAccrualBalance(@Param('id') id: string, @Body() body: { balanceHours?: number; accruedHours?: number; usedHours?: number }, @Req() req: Request) {
    const ab = await this.accrualBalanceRepo.findById(new Uuid(id));
    if (!ab) throw new BadRequestException('Accrual balance not found');
    return this.commandBus.execute(this.buildCommand('UpdateAbsenceAccrualBalance', 'AbsenceAccrualBalance', { balanceId: new Uuid(id), ...body }, req, { aggregateId: new Uuid(id), expectedState: ab.status, expectedVersion: ab.aggregateVersion }));
  }

  @Post('accrual-balances/:id/commands/carry-over')
  async carryOverAccrualBalance(@Param('id') id: string, @Req() req: Request) {
    const ab = await this.accrualBalanceRepo.findById(new Uuid(id));
    if (!ab) throw new BadRequestException('Accrual balance not found');
    return this.commandBus.execute(this.buildCommand('CarryOverAbsenceAccrualBalance', 'AbsenceAccrualBalance', { balanceId: new Uuid(id) }, req, { aggregateId: new Uuid(id), expectedState: ab.status, expectedVersion: ab.aggregateVersion }));
  }

  @Post('accrual-balances/:id/commands/close')
  async closeAccrualBalance(@Param('id') id: string, @Req() req: Request) {
    const ab = await this.accrualBalanceRepo.findById(new Uuid(id));
    if (!ab) throw new BadRequestException('Accrual balance not found');
    return this.commandBus.execute(this.buildCommand('CloseAbsenceAccrualBalance', 'AbsenceAccrualBalance', { balanceId: new Uuid(id) }, req, { aggregateId: new Uuid(id), expectedState: ab.status, expectedVersion: ab.aggregateVersion }));
  }

  @Get('accrual-balances/:id')
  async getAccrualBalance(@Param('id') id: string) {
    return this.accrualBalanceRepo.findById(new Uuid(id));
  }

  @Get('accrual-balances/worker/:workerId')
  async getAccrualBalancesByWorker(@Param('workerId') workerId: string) {
    return this.accrualBalanceRepo.findByWorker(new Uuid(workerId));
  }

  /* Entitlement Calculations */
  @Post('entitlement-calculations')
  async startEntitlementCalculation(@Body(new ZodValidationPipe(StartLeaveEntitlementCalculationDtoSchema)) dto: dtos.StartLeaveEntitlementCalculationDto, @Req() req: Request) {
    return this.commandBus.execute(this.buildCommand('StartLeaveEntitlementCalculation', 'LeaveEntitlementCalculation', dto, req));
  }

  @Post('entitlement-calculations/:id/commands/complete')
  async completeEntitlementCalculation(@Param('id') id: string, @Req() req: Request) {
    const le = await this.entitlementCalculationRepo.findById(new Uuid(id));
    if (!le) throw new BadRequestException('Entitlement calculation not found');
    return this.commandBus.execute(this.buildCommand('CompleteLeaveEntitlementCalculation', 'LeaveEntitlementCalculation', { leaveEntitlementCalculationId: new Uuid(id) }, req, { aggregateId: new Uuid(id), expectedState: le.status, expectedVersion: le.aggregateVersion }));
  }

  @Post('entitlement-calculations/:id/commands/fail')
  async failEntitlementCalculation(@Param('id') id: string, @Req() req: Request) {
    const le = await this.entitlementCalculationRepo.findById(new Uuid(id));
    if (!le) throw new BadRequestException('Entitlement calculation not found');
    return this.commandBus.execute(this.buildCommand('FailLeaveEntitlementCalculation', 'LeaveEntitlementCalculation', { leaveEntitlementCalculationId: new Uuid(id) }, req, { aggregateId: new Uuid(id), expectedState: le.status, expectedVersion: le.aggregateVersion }));
  }

  @Get('entitlement-calculations/:id')
  async getEntitlementCalculation(@Param('id') id: string) {
    return this.entitlementCalculationRepo.findById(new Uuid(id));
  }

  @Get('entitlement-calculations/worker/:workerId')
  async getEntitlementCalculationsByWorker(@Param('workerId') workerId: string) {
    return this.entitlementCalculationRepo.findByWorker(new Uuid(workerId));
  }
}
