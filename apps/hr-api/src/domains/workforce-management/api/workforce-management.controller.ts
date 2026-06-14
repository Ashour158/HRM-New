import { Controller, Get, Post, Body, Param, Req, BadRequestException, ForbiddenException, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { randomUUID } from 'crypto';
import { CommandBus } from '../../../platform/command-bus/command-bus.js';
import { Uuid } from '@hcm/shared-kernel';
import { computeRequestHash } from '@hcm/platform-core';
import type { HrCommandEnvelope } from '@hcm/command-contracts';
import { requireTenantId } from '../../../platform/http/request-context.js';
import { ShiftScheduleRepository } from '../repositories/shift-schedule.repository.js';
import { OpenShiftRepository } from '../repositories/open-shift.repository.js';
import { ShiftBidRepository } from '../repositories/shift-bid.repository.js';
import { ShiftSwapRequestRepository } from '../repositories/shift-swap-request.repository.js';
import { WfmOvertimeApprovalRepository } from '../repositories/overtime-approval.repository.js';
import { CoverageGapRepository } from '../repositories/coverage-gap.repository.js';
import { AuthGuard } from '../../../guards/auth.guard.js';
import type * as dtos from './dtos.js';
import {
  CreateShiftScheduleDtoSchema, CreateOpenShiftDtoSchema, CreateShiftBidDtoSchema,
  CreateShiftSwapRequestDtoSchema, RequestWfmOvertimeDtoSchema, CreateCoverageGapDtoSchema,
  ZodValidationPipe,
} from './dtos.js';

@ApiTags('Workforce Management')
@UseGuards(AuthGuard)
@Controller('workforce-management')
export class WorkforceManagementController {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly shiftScheduleRepo: ShiftScheduleRepository,
    private readonly openShiftRepo: OpenShiftRepository,
    private readonly shiftBidRepo: ShiftBidRepository,
    private readonly shiftSwapRequestRepo: ShiftSwapRequestRepository,
    private readonly overtimeApprovalRepo: WfmOvertimeApprovalRepository,
    private readonly coverageGapRepo: CoverageGapRepository,
  ) {}

  private getActor(req: Request): NonNullable<Request['actor']> {
    if (!req.actor) throw new ForbiddenException('Authenticated actor is required');
    return req.actor;
  }

  private requireMatchingTenant(req: Request, tenantId: string): Uuid {
    const requestTenantId = requireTenantId(req, 'Workforce Management');
    if (requestTenantId.value !== tenantId) {
      throw new BadRequestException('Tenant mismatch');
    }
    return requestTenantId;
  }

  private buildCommand<TPayload>(
    commandName: string,
    aggregateType: string,
    payload: TPayload,
    req: Request,
    options?: { aggregateId?: Uuid; expectedState?: string; expectedVersion?: number; subjectWorkerId?: Uuid },
  ): HrCommandEnvelope<TPayload> {
    const tenantId = requireTenantId(req, 'Workforce Management');
    return {
      commandId: Uuid.generate(),
      commandName,
      commandSchemaVersion: 1,
      tenantId,
      actor: this.getActor(req),
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

  /* Shift Schedules */
  @Post('shift-schedules')
  async createShiftSchedule(@Body(new ZodValidationPipe(CreateShiftScheduleDtoSchema)) dto: dtos.CreateShiftScheduleDto, @Req() req: Request) {
    return this.commandBus.execute(this.buildCommand('CreateShiftSchedule', 'ShiftSchedule', dto, req));
  }

  @Post('shift-schedules/:id/commands/publish')
  async publishShiftSchedule(@Param('id') id: string, @Req() req: Request) {
    const ar = await this.shiftScheduleRepo.findById(new Uuid(id));
    if (!ar) throw new BadRequestException('Shift schedule not found');
    return this.commandBus.execute(this.buildCommand('PublishShiftSchedule', 'ShiftSchedule', { shiftScheduleId: new Uuid(id) }, req, { aggregateId: new Uuid(id), expectedState: ar.status, expectedVersion: ar.aggregateVersion }));
  }

  @Post('shift-schedules/:id/commands/activate')
  async activateShiftSchedule(@Param('id') id: string, @Req() req: Request) {
    const ar = await this.shiftScheduleRepo.findById(new Uuid(id));
    if (!ar) throw new BadRequestException('Shift schedule not found');
    return this.commandBus.execute(this.buildCommand('ActivateShiftSchedule', 'ShiftSchedule', { shiftScheduleId: new Uuid(id) }, req, { aggregateId: new Uuid(id), expectedState: ar.status, expectedVersion: ar.aggregateVersion }));
  }

  @Post('shift-schedules/:id/commands/archive')
  async archiveShiftSchedule(@Param('id') id: string, @Req() req: Request) {
    const ar = await this.shiftScheduleRepo.findById(new Uuid(id));
    if (!ar) throw new BadRequestException('Shift schedule not found');
    return this.commandBus.execute(this.buildCommand('ArchiveShiftSchedule', 'ShiftSchedule', { shiftScheduleId: new Uuid(id) }, req, { aggregateId: new Uuid(id), expectedState: ar.status, expectedVersion: ar.aggregateVersion }));
  }

  @Get('shift-schedules/tenant/:tenantId')
  async getShiftSchedulesByTenant(@Param('tenantId') tenantId: string, @Req() req: Request) {
    return this.shiftScheduleRepo.findByTenant(this.requireMatchingTenant(req, tenantId));
  }

  @Get('shift-schedules/worker/:workerId')
  async getShiftSchedulesByWorker(@Param('workerId') workerId: string) {
    return this.shiftScheduleRepo.findByWorker(new Uuid(workerId));
  }

  @Get('shift-schedules/:id')
  async getShiftSchedule(@Param('id') id: string) {
    return this.shiftScheduleRepo.findById(new Uuid(id));
  }

  /* Open Shifts */
  @Post('open-shifts')
  async createOpenShift(@Body(new ZodValidationPipe(CreateOpenShiftDtoSchema)) dto: dtos.CreateOpenShiftDto, @Req() req: Request) {
    return this.commandBus.execute(this.buildCommand('CreateOpenShift', 'OpenShift', dto, req));
  }

  @Post('open-shifts/:id/commands/mark-bid-pending')
  async markBidPendingOpenShift(@Param('id') id: string, @Req() req: Request) {
    const ar = await this.openShiftRepo.findById(new Uuid(id));
    if (!ar) throw new BadRequestException('Open shift not found');
    return this.commandBus.execute(this.buildCommand('MarkBidPendingOpenShift', 'OpenShift', { openShiftId: new Uuid(id) }, req, { aggregateId: new Uuid(id), expectedState: ar.status, expectedVersion: ar.aggregateVersion }));
  }

  @Post('open-shifts/:id/commands/fill')
  async fillOpenShift(@Param('id') id: string, @Body() body: { filledByWorkerId: string }, @Req() req: Request) {
    const ar = await this.openShiftRepo.findById(new Uuid(id));
    if (!ar) throw new BadRequestException('Open shift not found');
    return this.commandBus.execute(this.buildCommand('FillOpenShift', 'OpenShift', { openShiftId: new Uuid(id), filledByWorkerId: new Uuid(body.filledByWorkerId) }, req, { aggregateId: new Uuid(id), expectedState: ar.status, expectedVersion: ar.aggregateVersion }));
  }

  @Post('open-shifts/:id/commands/close')
  async closeOpenShift(@Param('id') id: string, @Req() req: Request) {
    const ar = await this.openShiftRepo.findById(new Uuid(id));
    if (!ar) throw new BadRequestException('Open shift not found');
    return this.commandBus.execute(this.buildCommand('CloseOpenShift', 'OpenShift', { openShiftId: new Uuid(id) }, req, { aggregateId: new Uuid(id), expectedState: ar.status, expectedVersion: ar.aggregateVersion }));
  }

  @Post('open-shifts/:id/commands/cancel')
  async cancelOpenShift(@Param('id') id: string, @Req() req: Request) {
    const ar = await this.openShiftRepo.findById(new Uuid(id));
    if (!ar) throw new BadRequestException('Open shift not found');
    return this.commandBus.execute(this.buildCommand('CancelOpenShift', 'OpenShift', { openShiftId: new Uuid(id) }, req, { aggregateId: new Uuid(id), expectedState: ar.status, expectedVersion: ar.aggregateVersion }));
  }

  @Get('open-shifts/tenant/:tenantId')
  async getOpenShiftsByTenant(@Param('tenantId') tenantId: string, @Req() req: Request) {
    return this.openShiftRepo.findByTenant(this.requireMatchingTenant(req, tenantId));
  }

  @Get('open-shifts/department/:departmentId')
  async getOpenShiftsByDepartment(@Param('departmentId') departmentId: string) {
    return this.openShiftRepo.findByDepartment(new Uuid(departmentId));
  }

  @Get('open-shifts/:id')
  async getOpenShift(@Param('id') id: string) {
    return this.openShiftRepo.findById(new Uuid(id));
  }

  /* Shift Bids */
  @Post('shift-bids')
  async createShiftBid(@Body(new ZodValidationPipe(CreateShiftBidDtoSchema)) dto: dtos.CreateShiftBidDto, @Req() req: Request) {
    return this.commandBus.execute(this.buildCommand('CreateShiftBid', 'ShiftBid', dto, req));
  }

  @Post('shift-bids/:id/commands/approve')
  async approveShiftBid(@Param('id') id: string, @Body() body: { approvedBy: string }, @Req() req: Request) {
    const ar = await this.shiftBidRepo.findById(new Uuid(id));
    if (!ar) throw new BadRequestException('Shift bid not found');
    return this.commandBus.execute(this.buildCommand('ApproveShiftBid', 'ShiftBid', { shiftBidId: new Uuid(id), approvedBy: new Uuid(body.approvedBy) }, req, { aggregateId: new Uuid(id), expectedState: ar.status, expectedVersion: ar.aggregateVersion }));
  }

  @Post('shift-bids/:id/commands/reject')
  async rejectShiftBid(@Param('id') id: string, @Req() req: Request) {
    const ar = await this.shiftBidRepo.findById(new Uuid(id));
    if (!ar) throw new BadRequestException('Shift bid not found');
    return this.commandBus.execute(this.buildCommand('RejectShiftBid', 'ShiftBid', { shiftBidId: new Uuid(id) }, req, { aggregateId: new Uuid(id), expectedState: ar.status, expectedVersion: ar.aggregateVersion }));
  }

  @Post('shift-bids/:id/commands/cancel')
  async cancelShiftBid(@Param('id') id: string, @Req() req: Request) {
    const ar = await this.shiftBidRepo.findById(new Uuid(id));
    if (!ar) throw new BadRequestException('Shift bid not found');
    return this.commandBus.execute(this.buildCommand('CancelShiftBid', 'ShiftBid', { shiftBidId: new Uuid(id) }, req, { aggregateId: new Uuid(id), expectedState: ar.status, expectedVersion: ar.aggregateVersion }));
  }

  @Get('shift-bids/tenant/:tenantId')
  async getShiftBidsByTenant(@Param('tenantId') tenantId: string, @Req() req: Request) {
    return this.shiftBidRepo.findByTenant(this.requireMatchingTenant(req, tenantId));
  }

  @Get('shift-bids/worker/:workerId')
  async getShiftBidsByWorker(@Param('workerId') workerId: string) {
    return this.shiftBidRepo.findByWorker(new Uuid(workerId));
  }

  @Get('shift-bids/:id')
  async getShiftBid(@Param('id') id: string) {
    return this.shiftBidRepo.findById(new Uuid(id));
  }

  /* Shift Swap Requests */
  @Post('shift-swap-requests')
  async createShiftSwapRequest(@Body(new ZodValidationPipe(CreateShiftSwapRequestDtoSchema)) dto: dtos.CreateShiftSwapRequestDto, @Req() req: Request) {
    return this.commandBus.execute(this.buildCommand('CreateShiftSwapRequest', 'ShiftSwapRequest', dto, req));
  }

  @Post('shift-swap-requests/:id/commands/approve')
  async approveShiftSwapRequest(@Param('id') id: string, @Body() body: { approvedBy: string }, @Req() req: Request) {
    const ar = await this.shiftSwapRequestRepo.findById(new Uuid(id));
    if (!ar) throw new BadRequestException('Shift swap request not found');
    return this.commandBus.execute(this.buildCommand('ApproveShiftSwapRequest', 'ShiftSwapRequest', { shiftSwapRequestId: new Uuid(id), approvedBy: new Uuid(body.approvedBy) }, req, { aggregateId: new Uuid(id), expectedState: ar.status, expectedVersion: ar.aggregateVersion }));
  }

  @Post('shift-swap-requests/:id/commands/reject')
  async rejectShiftSwapRequest(@Param('id') id: string, @Req() req: Request) {
    const ar = await this.shiftSwapRequestRepo.findById(new Uuid(id));
    if (!ar) throw new BadRequestException('Shift swap request not found');
    return this.commandBus.execute(this.buildCommand('RejectShiftSwapRequest', 'ShiftSwapRequest', { shiftSwapRequestId: new Uuid(id) }, req, { aggregateId: new Uuid(id), expectedState: ar.status, expectedVersion: ar.aggregateVersion }));
  }

  @Post('shift-swap-requests/:id/commands/cancel')
  async cancelShiftSwapRequest(@Param('id') id: string, @Req() req: Request) {
    const ar = await this.shiftSwapRequestRepo.findById(new Uuid(id));
    if (!ar) throw new BadRequestException('Shift swap request not found');
    return this.commandBus.execute(this.buildCommand('CancelShiftSwapRequest', 'ShiftSwapRequest', { shiftSwapRequestId: new Uuid(id) }, req, { aggregateId: new Uuid(id), expectedState: ar.status, expectedVersion: ar.aggregateVersion }));
  }

  @Get('shift-swap-requests/tenant/:tenantId')
  async getShiftSwapRequestsByTenant(@Param('tenantId') tenantId: string, @Req() req: Request) {
    return this.shiftSwapRequestRepo.findByTenant(this.requireMatchingTenant(req, tenantId));
  }

  @Get('shift-swap-requests/requester/:workerId')
  async getShiftSwapRequestsByRequester(@Param('workerId') workerId: string) {
    return this.shiftSwapRequestRepo.findByRequester(new Uuid(workerId));
  }

  @Get('shift-swap-requests/:id')
  async getShiftSwapRequest(@Param('id') id: string) {
    return this.shiftSwapRequestRepo.findById(new Uuid(id));
  }

  /* Overtime Approvals */
  @Post('overtime-approvals')
  async requestWfmOvertime(@Body(new ZodValidationPipe(RequestWfmOvertimeDtoSchema)) dto: dtos.RequestWfmOvertimeDto, @Req() req: Request) {
    return this.commandBus.execute(this.buildCommand('RequestWfmOvertime', 'WfmOvertimeApproval', dto, req));
  }

  @Post('overtime-approvals/:id/commands/approve')
  async approveWfmOvertime(@Param('id') id: string, @Body() body: { approvedBy: string }, @Req() req: Request) {
    const ar = await this.overtimeApprovalRepo.findById(new Uuid(id));
    if (!ar) throw new BadRequestException('Overtime approval not found');
    return this.commandBus.execute(this.buildCommand('ApproveWfmOvertime', 'WfmOvertimeApproval', { overtimeApprovalId: new Uuid(id), approvedBy: new Uuid(body.approvedBy) }, req, { aggregateId: new Uuid(id), expectedState: ar.status, expectedVersion: ar.aggregateVersion }));
  }

  @Post('overtime-approvals/:id/commands/reject')
  async rejectWfmOvertime(@Param('id') id: string, @Req() req: Request) {
    const ar = await this.overtimeApprovalRepo.findById(new Uuid(id));
    if (!ar) throw new BadRequestException('Overtime approval not found');
    return this.commandBus.execute(this.buildCommand('RejectWfmOvertime', 'WfmOvertimeApproval', { overtimeApprovalId: new Uuid(id) }, req, { aggregateId: new Uuid(id), expectedState: ar.status, expectedVersion: ar.aggregateVersion }));
  }

  @Post('overtime-approvals/:id/commands/cancel')
  async cancelWfmOvertime(@Param('id') id: string, @Req() req: Request) {
    const ar = await this.overtimeApprovalRepo.findById(new Uuid(id));
    if (!ar) throw new BadRequestException('Overtime approval not found');
    return this.commandBus.execute(this.buildCommand('CancelWfmOvertime', 'WfmOvertimeApproval', { overtimeApprovalId: new Uuid(id) }, req, { aggregateId: new Uuid(id), expectedState: ar.status, expectedVersion: ar.aggregateVersion }));
  }

  @Get('overtime-approvals/tenant/:tenantId')
  async getOvertimeApprovalsByTenant(@Param('tenantId') tenantId: string, @Req() req: Request) {
    return this.overtimeApprovalRepo.findByTenant(this.requireMatchingTenant(req, tenantId));
  }

  @Get('overtime-approvals/worker/:workerId')
  async getOvertimeApprovalsByWorker(@Param('workerId') workerId: string) {
    return this.overtimeApprovalRepo.findByWorker(new Uuid(workerId));
  }

  @Get('overtime-approvals/:id')
  async getOvertimeApproval(@Param('id') id: string) {
    return this.overtimeApprovalRepo.findById(new Uuid(id));
  }

  /* Coverage Gaps */
  @Post('coverage-gaps')
  async createCoverageGap(@Body(new ZodValidationPipe(CreateCoverageGapDtoSchema)) dto: dtos.CreateCoverageGapDto, @Req() req: Request) {
    return this.commandBus.execute(this.buildCommand('CreateCoverageGap', 'CoverageGap', dto, req));
  }

  @Post('coverage-gaps/:id/commands/notify')
  async notifyCoverageGap(@Param('id') id: string, @Req() req: Request) {
    const ar = await this.coverageGapRepo.findById(new Uuid(id));
    if (!ar) throw new BadRequestException('Coverage gap not found');
    return this.commandBus.execute(this.buildCommand('NotifyCoverageGap', 'CoverageGap', { coverageGapId: new Uuid(id) }, req, { aggregateId: new Uuid(id), expectedState: ar.status, expectedVersion: ar.aggregateVersion }));
  }

  @Post('coverage-gaps/:id/commands/fill')
  async fillCoverageGap(@Param('id') id: string, @Body() body: { filledByWorkerId: string }, @Req() req: Request) {
    const ar = await this.coverageGapRepo.findById(new Uuid(id));
    if (!ar) throw new BadRequestException('Coverage gap not found');
    return this.commandBus.execute(this.buildCommand('FillCoverageGap', 'CoverageGap', { coverageGapId: new Uuid(id), filledByWorkerId: new Uuid(body.filledByWorkerId) }, req, { aggregateId: new Uuid(id), expectedState: ar.status, expectedVersion: ar.aggregateVersion }));
  }

  @Post('coverage-gaps/:id/commands/close')
  async closeCoverageGap(@Param('id') id: string, @Req() req: Request) {
    const ar = await this.coverageGapRepo.findById(new Uuid(id));
    if (!ar) throw new BadRequestException('Coverage gap not found');
    return this.commandBus.execute(this.buildCommand('CloseCoverageGap', 'CoverageGap', { coverageGapId: new Uuid(id) }, req, { aggregateId: new Uuid(id), expectedState: ar.status, expectedVersion: ar.aggregateVersion }));
  }

  @Get('coverage-gaps/tenant/:tenantId')
  async getCoverageGapsByTenant(@Param('tenantId') tenantId: string, @Req() req: Request) {
    return this.coverageGapRepo.findByTenant(this.requireMatchingTenant(req, tenantId));
  }

  @Get('coverage-gaps/department/:departmentId')
  async getCoverageGapsByDepartment(@Param('departmentId') departmentId: string) {
    return this.coverageGapRepo.findByDepartment(new Uuid(departmentId));
  }

  @Get('coverage-gaps/:id')
  async getCoverageGap(@Param('id') id: string) {
    return this.coverageGapRepo.findById(new Uuid(id));
  }
}
