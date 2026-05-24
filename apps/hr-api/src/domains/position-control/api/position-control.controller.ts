import {
  Controller,
  Post,
  Get,
  Patch,
  Param,
  Body,
  Headers,
  Query,
  UsePipes,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiParam, ApiQuery } from '@nestjs/swagger';
import { Uuid } from '@hcm/shared-kernel';
import { createCommand } from '@hcm/command-contracts';
import type { HrCommandEnvelope } from '@hcm/command-contracts';
import { CommandBus } from '../../../platform/command-bus/command-bus.js';
import { FsmFramework } from '../../../platform/workflow/fsm-framework.js';
import { ZodValidationPipe } from '../../../pipes/zod-validation.pipe.js';
import { PositionRepository } from '../repositories/position.repository.js';
import { HeadcountRequestRepository } from '../repositories/headcount-request.repository.js';
import {
  CreatePositionDto,
  UpdatePositionDto,
  FillPositionDto,
  VacatePositionDto,
  SubmitHeadcountRequestDto,
  ApproveHeadcountRequestDto,
  RejectHeadcountRequestDto,
} from './dtos.js';

@ApiTags('Position Control')
@Controller('hr/position-control')
@UsePipes(ZodValidationPipe)
export class PositionControlController {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly positionRepo: PositionRepository,
    private readonly headcountRepo: HeadcountRequestRepository,
    private readonly fsmFramework: FsmFramework,
  ) {}

  /* ── Positions ───────────────────────────────────────────────── */

  @Post('positions')
  @ApiOperation({ summary: 'Create a new position' })
  async createPosition(
    @Body() dto: CreatePositionDto,
    @Headers('x-tenant-id') tenantId: string,
    @Headers('x-actor-id') actorId: string,
    @Headers('x-actor-roles') actorRolesHeader?: string,
  ) {
    const roles = actorRolesHeader ? actorRolesHeader.split(',') : ['HR_ADMIN'];
    const envelope = this.buildCommand('CreatePosition', tenantId, actorId, roles, dto, {
      aggregateType: 'position',
      reason: 'Create position via API',
    });
    return this.commandBus.execute(envelope);
  }

  @Post('positions/:id/commands/activate')
  @ApiOperation({ summary: 'Activate a position' })
  @ApiParam({ name: 'id', description: 'Position UUID' })
  async activatePosition(
    @Param('id') id: string,
    @Headers('x-tenant-id') tenantId: string,
    @Headers('x-actor-id') actorId: string,
    @Headers('x-actor-roles') actorRolesHeader?: string,
  ) {
    const roles = actorRolesHeader ? actorRolesHeader.split(',') : ['HR_ADMIN'];
    const envelope = this.buildCommand('ActivatePosition', tenantId, actorId, roles, { positionId: id }, {
      aggregateType: 'position',
      aggregateId: id,
      expectedState: 'DRAFT',
      reason: 'Activate position via API',
    });
    return this.commandBus.execute(envelope);
  }

  @Post('positions/:id/commands/freeze')
  @ApiOperation({ summary: 'Freeze a position' })
  @ApiParam({ name: 'id', description: 'Position UUID' })
  async freezePosition(
    @Param('id') id: string,
    @Headers('x-tenant-id') tenantId: string,
    @Headers('x-actor-id') actorId: string,
    @Headers('x-actor-roles') actorRolesHeader?: string,
  ) {
    const roles = actorRolesHeader ? actorRolesHeader.split(',') : ['HR_ADMIN'];
    const envelope = this.buildCommand('FreezePosition', tenantId, actorId, roles, { positionId: id, reason: 'Administrative freeze' }, {
      aggregateType: 'position',
      aggregateId: id,
      expectedState: 'ACTIVE',
      reason: 'Freeze position via API',
    });
    return this.commandBus.execute(envelope);
  }

  @Post('positions/:id/commands/unfreeze')
  @ApiOperation({ summary: 'Unfreeze a position' })
  @ApiParam({ name: 'id', description: 'Position UUID' })
  async unfreezePosition(
    @Param('id') id: string,
    @Headers('x-tenant-id') tenantId: string,
    @Headers('x-actor-id') actorId: string,
    @Headers('x-actor-roles') actorRolesHeader?: string,
  ) {
    const roles = actorRolesHeader ? actorRolesHeader.split(',') : ['HR_ADMIN'];
    const envelope = this.buildCommand('UnfreezePosition', tenantId, actorId, roles, { positionId: id }, {
      aggregateType: 'position',
      aggregateId: id,
      expectedState: 'FROZEN',
      reason: 'Unfreeze position via API',
    });
    return this.commandBus.execute(envelope);
  }

  @Post('positions/:id/commands/fill')
  @ApiOperation({ summary: 'Fill a position with a worker' })
  @ApiParam({ name: 'id', description: 'Position UUID' })
  async fillPosition(
    @Param('id') id: string,
    @Body() dto: FillPositionDto,
    @Headers('x-tenant-id') tenantId: string,
    @Headers('x-actor-id') actorId: string,
    @Headers('x-actor-roles') actorRolesHeader?: string,
  ) {
    const roles = actorRolesHeader ? actorRolesHeader.split(',') : ['HR_ADMIN'];
    const envelope = this.buildCommand('FillPosition', tenantId, actorId, roles, { positionId: id, workerId: dto.workerId }, {
      aggregateType: 'position',
      aggregateId: id,
      expectedState: 'ACTIVE',
      reason: 'Fill position via API',
    });
    return this.commandBus.execute(envelope);
  }

  @Post('positions/:id/commands/vacate')
  @ApiOperation({ summary: 'Vacate a position' })
  @ApiParam({ name: 'id', description: 'Position UUID' })
  async vacatePosition(
    @Param('id') id: string,
    @Body() dto: VacatePositionDto,
    @Headers('x-tenant-id') tenantId: string,
    @Headers('x-actor-id') actorId: string,
    @Headers('x-actor-roles') actorRolesHeader?: string,
  ) {
    const roles = actorRolesHeader ? actorRolesHeader.split(',') : ['HR_ADMIN'];
    const envelope = this.buildCommand('VacatePosition', tenantId, actorId, roles, { positionId: id, reason: dto.reason ?? 'Vacated via API' }, {
      aggregateType: 'position',
      aggregateId: id,
      expectedState: 'FILLED',
      reason: 'Vacate position via API',
    });
    return this.commandBus.execute(envelope);
  }

  @Post('positions/:id/commands/close')
  @ApiOperation({ summary: 'Close a position' })
  @ApiParam({ name: 'id', description: 'Position UUID' })
  async closePosition(
    @Param('id') id: string,
    @Headers('x-tenant-id') tenantId: string,
    @Headers('x-actor-id') actorId: string,
    @Headers('x-actor-roles') actorRolesHeader?: string,
  ) {
    const roles = actorRolesHeader ? actorRolesHeader.split(',') : ['HR_ADMIN'];
    const envelope = this.buildCommand('ClosePosition', tenantId, actorId, roles, { positionId: id, reason: 'Closed via API' }, {
      aggregateType: 'position',
      aggregateId: id,
      reason: 'Close position via API',
    });
    return this.commandBus.execute(envelope);
  }

  @Patch('positions/:id')
  @ApiOperation({ summary: 'Update a position' })
  @ApiParam({ name: 'id', description: 'Position UUID' })
  async updatePosition(
    @Param('id') id: string,
    @Body() dto: UpdatePositionDto,
    @Headers('x-tenant-id') tenantId: string,
    @Headers('x-actor-id') actorId: string,
    @Headers('x-actor-roles') actorRolesHeader?: string,
  ) {
    const roles = actorRolesHeader ? actorRolesHeader.split(',') : ['HR_ADMIN'];
    const envelope = this.buildCommand('UpdatePosition', tenantId, actorId, roles, { positionId: id, ...dto }, {
      aggregateType: 'position',
      aggregateId: id,
      reason: 'Update position via API',
    });
    return this.commandBus.execute(envelope);
  }

  @Get('positions')
  @ApiOperation({ summary: 'List positions with optional filters' })
  @ApiQuery({ name: 'status', required: false })
  @ApiQuery({ name: 'department', required: false })
  @ApiQuery({ name: 'legalEntity', required: false })
  async listPositions(
    @Headers('x-tenant-id') tenantId: string,
    @Query('status') status?: string,
    @Query('department') departmentId?: string,
    @Query('legalEntity') legalEntityId?: string,
  ) {
    const tenantUuid = new Uuid(tenantId);
    let positions = await this.positionRepo.findAll(tenantUuid, status);

    if (departmentId) {
      positions = positions.filter((p) => p.departmentId?.value === departmentId);
    }
    if (legalEntityId) {
      positions = positions.filter((p) => p.legalEntityId?.value === legalEntityId);
    }

    return positions.map((p) => ({
      id: p.id.value,
      positionCode: p.positionCode,
      title: p.title,
      status: p.status,
      departmentId: p.departmentId?.value,
      legalEntityId: p.legalEntityId?.value,
      employmentType: p.employmentType,
    }));
  }

  @Get('positions/vacant')
  @ApiOperation({ summary: 'List vacant positions' })
  async listVacantPositions(@Headers('x-tenant-id') tenantId: string) {
    const positions = await this.positionRepo.findVacant(new Uuid(tenantId));
    return positions.map((p) => ({
      id: p.id.value,
      positionCode: p.positionCode,
      title: p.title,
      status: p.status,
    }));
  }

  @Get('positions/:id')
  @ApiOperation({ summary: 'Get a position by ID' })
  @ApiParam({ name: 'id', description: 'Position UUID' })
  async getPosition(@Param('id') id: string) {
    const position = await this.positionRepo.findById(new Uuid(id));
    if (!position) {
      return { error: 'Position not found' };
    }
    return {
      id: position.id.value,
      positionCode: position.positionCode,
      title: position.title,
      status: position.status,
      departmentId: position.departmentId?.value,
      legalEntityId: position.legalEntityId?.value,
      jobFamily: position.jobFamily,
      jobLevel: position.jobLevel,
      employmentType: position.employmentType,
      filledByWorkerId: position.filledByWorkerId?.value,
      headcountRequestId: position.headcountRequestId?.value,
      version: position.version,
      createdAt: position.createdAt,
      updatedAt: position.updatedAt,
    };
  }

  @Get('positions/:id/allowed-actions')
  @ApiOperation({ summary: 'Get allowed actions for a position' })
  @ApiParam({ name: 'id', description: 'Position UUID' })
  async getAllowedActions(@Param('id') id: string) {
    const position = await this.positionRepo.findById(new Uuid(id));
    if (!position) {
      return { error: 'Position not found' };
    }
    const actions = this.fsmFramework.getAllowedActionsFromState(position.status, 'position');
    return { positionId: id, currentState: position.status, allowedActions: actions };
  }

  /* ── Headcount Requests ──────────────────────────────────────── */

  @Post('headcount-requests')
  @ApiOperation({ summary: 'Submit a new headcount request' })
  async submitHeadcountRequest(
    @Body() dto: SubmitHeadcountRequestDto,
    @Headers('x-tenant-id') tenantId: string,
    @Headers('x-actor-id') actorId: string,
    @Headers('x-actor-roles') actorRolesHeader?: string,
  ) {
    const roles = actorRolesHeader ? actorRolesHeader.split(',') : ['HR_ADMIN'];
    const envelope = this.buildCommand('SubmitHeadcountRequest', tenantId, actorId, roles, dto, {
      aggregateType: 'headcountRequest',
      reason: 'Submit headcount request via API',
    });
    return this.commandBus.execute(envelope);
  }

  @Post('headcount-requests/:id/commands/start-review')
  @ApiOperation({ summary: 'Start review of a headcount request' })
  @ApiParam({ name: 'id', description: 'Headcount request UUID' })
  async startReview(
    @Param('id') id: string,
    @Headers('x-tenant-id') tenantId: string,
    @Headers('x-actor-id') actorId: string,
    @Headers('x-actor-roles') actorRolesHeader?: string,
  ) {
    const roles = actorRolesHeader ? actorRolesHeader.split(',') : ['HR_ADMIN'];
    const envelope = this.buildCommand('StartReviewHeadcountRequest', tenantId, actorId, roles, { requestId: id }, {
      aggregateType: 'headcountRequest',
      aggregateId: id,
      expectedState: 'SUBMITTED',
      reason: 'Start review via API',
    });
    return this.commandBus.execute(envelope);
  }

  @Post('headcount-requests/:id/commands/approve')
  @ApiOperation({ summary: 'Approve a headcount request' })
  @ApiParam({ name: 'id', description: 'Headcount request UUID' })
  async approveHeadcountRequest(
    @Param('id') id: string,
    @Body() dto: ApproveHeadcountRequestDto,
    @Headers('x-tenant-id') tenantId: string,
    @Headers('x-actor-id') actorId: string,
    @Headers('x-actor-roles') actorRolesHeader?: string,
  ) {
    const roles = actorRolesHeader ? actorRolesHeader.split(',') : ['HR_ADMIN'];
    const envelope = this.buildCommand('ApproveHeadcountRequest', tenantId, actorId, roles, { requestId: id, positionsApproved: dto.positionsApproved }, {
      aggregateType: 'headcountRequest',
      aggregateId: id,
      expectedState: 'UNDER_REVIEW',
      reason: 'Approve headcount request via API',
    });
    return this.commandBus.execute(envelope);
  }

  @Post('headcount-requests/:id/commands/reject')
  @ApiOperation({ summary: 'Reject a headcount request' })
  @ApiParam({ name: 'id', description: 'Headcount request UUID' })
  async rejectHeadcountRequest(
    @Param('id') id: string,
    @Body() dto: RejectHeadcountRequestDto,
    @Headers('x-tenant-id') tenantId: string,
    @Headers('x-actor-id') actorId: string,
    @Headers('x-actor-roles') actorRolesHeader?: string,
  ) {
    const roles = actorRolesHeader ? actorRolesHeader.split(',') : ['HR_ADMIN'];
    const envelope = this.buildCommand('RejectHeadcountRequest', tenantId, actorId, roles, { requestId: id, reason: dto.reason }, {
      aggregateType: 'headcountRequest',
      aggregateId: id,
      expectedState: 'UNDER_REVIEW',
      reason: 'Reject headcount request via API',
    });
    return this.commandBus.execute(envelope);
  }

  @Post('headcount-requests/:id/commands/cancel')
  @ApiOperation({ summary: 'Cancel a headcount request' })
  @ApiParam({ name: 'id', description: 'Headcount request UUID' })
  async cancelHeadcountRequest(
    @Param('id') id: string,
    @Headers('x-tenant-id') tenantId: string,
    @Headers('x-actor-id') actorId: string,
    @Headers('x-actor-roles') actorRolesHeader?: string,
  ) {
    const roles = actorRolesHeader ? actorRolesHeader.split(',') : ['HR_ADMIN'];
    const envelope = this.buildCommand('CancelHeadcountRequest', tenantId, actorId, roles, { requestId: id }, {
      aggregateType: 'headcountRequest',
      aggregateId: id,
      reason: 'Cancel headcount request via API',
    });
    return this.commandBus.execute(envelope);
  }

  @Get('headcount-requests')
  @ApiOperation({ summary: 'List headcount requests' })
  async listHeadcountRequests(@Headers('x-tenant-id') tenantId: string) {
    const requests = await this.headcountRepo.findAll(new Uuid(tenantId));
    return requests.map((r) => ({
      id: r.id.value,
      requestNumber: r.requestNumber,
      status: r.status,
      requestedBy: r.requestedBy.value,
      positionsRequested: r.positionsRequested,
      positionsApproved: r.positionsApproved,
    }));
  }

  @Get('headcount-requests/pending')
  @ApiOperation({ summary: 'List headcount requests pending approval' })
  async listPendingHeadcountRequests(@Headers('x-tenant-id') tenantId: string) {
    const requests = await this.headcountRepo.findPendingApproval(new Uuid(tenantId));
    return requests.map((r) => ({
      id: r.id.value,
      requestNumber: r.requestNumber,
      status: r.status,
      requestedBy: r.requestedBy.value,
      positionsRequested: r.positionsRequested,
    }));
  }

  @Get('headcount-requests/:id')
  @ApiOperation({ summary: 'Get a headcount request by ID' })
  @ApiParam({ name: 'id', description: 'Headcount request UUID' })
  async getHeadcountRequest(@Param('id') id: string) {
    const request = await this.headcountRepo.findById(new Uuid(id));
    if (!request) {
      return { error: 'Headcount request not found' };
    }
    return {
      id: request.id.value,
      requestNumber: request.requestNumber,
      status: request.status,
      justification: request.justification,
      requestedBy: request.requestedBy.value,
      approvedBy: request.approvedBy?.value,
      approvedAt: request.approvedAt,
      positionsRequested: request.positionsRequested,
      positionsApproved: request.positionsApproved,
      version: request.version,
      createdAt: request.createdAt,
      updatedAt: request.updatedAt,
    };
  }

  /* ── Helpers ─────────────────────────────────────────────────── */

  private buildCommand<TPayload>(
    commandName: string,
    tenantId: string,
    actorId: string,
    roles: string[],
    payload: TPayload,
    options: {
      aggregateType: string;
      aggregateId?: string;
      expectedState?: string;
      reason?: string;
    },
  ): HrCommandEnvelope<TPayload> {
    return createCommand(
      commandName,
      new Uuid(tenantId),
      {
        actorType: 'USER',
        actorId: new Uuid(actorId),
        roles,
        permissions: roles,
        mfaAuthenticated: true,
      },
      payload,
      {
        aggregateType: options.aggregateType,
        aggregateId: options.aggregateId ? new Uuid(options.aggregateId) : undefined,
        expectedState: options.expectedState,
        idempotencyKey: crypto.randomUUID(),
        correlationId: Uuid.generate(),
        reason: options.reason ?? 'API request',
      },
    );
  }
}
