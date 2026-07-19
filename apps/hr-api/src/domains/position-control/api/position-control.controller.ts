import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiOperation, ApiParam, ApiQuery, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { Uuid } from '@hcm/shared-kernel';
import { createCommand, type HrCommandEnvelope } from '@hcm/command-contracts';
import { AuthGuard } from '../../../guards/auth.guard.js';
import { CommandBus } from '../../../platform/command-bus/command-bus.js';
import { FsmFramework } from '../../../platform/workflow/fsm-framework.js';
import { PositionRepository } from '../repositories/position.repository.js';
import { HeadcountRequestRepository } from '../repositories/headcount-request.repository.js';
import { HeadcountBudgetRepository } from '../repositories/headcount-budget.repository.js';
import {
  ApproveHeadcountRequestDto,
  ApproveHeadcountRequestDtoSchema,
  ConfigureHeadcountBudgetDto,
  CreatePositionDto,
  CreatePositionDtoSchema,
  FillPositionDto,
  FillPositionDtoSchema,
  RejectHeadcountRequestDto,
  RejectHeadcountRequestDtoSchema,
  SubmitHeadcountRequestDto,
  SubmitHeadcountRequestDtoSchema,
  UpdatePositionDto,
  UpdatePositionDtoSchema,
  VacatePositionDto,
  VacatePositionDtoSchema,
  ZodValidationPipe,
} from './dtos.js';

const POSITION_ADMIN_ROLES = new Set([
  'APP_ADMIN',
  'PLATFORM_ADMIN',
  'SUPER_ADMIN',
  'HR_ADMIN',
  'HRBP',
  'ORG_ADMIN',
  'POSITION_ADMIN',
  'WORKFORCE_PLANNING_ADMIN',
  'FINANCE_ADMIN',
]);

@ApiTags('Position Control')
@UseGuards(AuthGuard)
@Controller('hr/position-control')
export class PositionControlController {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly positionRepo: PositionRepository,
    private readonly headcountRepo: HeadcountRequestRepository,
    private readonly budgetRepo: HeadcountBudgetRepository,
    private readonly fsmFramework: FsmFramework,
  ) {}

  @Post('positions')
  @ApiOperation({ summary: 'Create a new position' })
  async createPosition(@Body(new ZodValidationPipe(CreatePositionDtoSchema)) dto: CreatePositionDto, @Req() req: Request) {
    const envelope = this.buildCommand('CreatePosition', req, dto, {
      aggregateType: 'position',
      reason: 'Create position via API',
    });
    return this.commandBus.execute(envelope);
  }

  @Post('positions/:id/commands/activate')
  @ApiOperation({ summary: 'Activate a position' })
  @ApiParam({ name: 'id', description: 'Position UUID' })
  async activatePosition(@Param('id') id: string, @Req() req: Request) {
    const envelope = this.buildCommand('ActivatePosition', req, { positionId: id }, {
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
  async freezePosition(@Param('id') id: string, @Req() req: Request) {
    const envelope = this.buildCommand('FreezePosition', req, { positionId: id, reason: 'Administrative freeze' }, {
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
  async unfreezePosition(@Param('id') id: string, @Req() req: Request) {
    const envelope = this.buildCommand('UnfreezePosition', req, { positionId: id }, {
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
  async fillPosition(@Param('id') id: string, @Body(new ZodValidationPipe(FillPositionDtoSchema)) dto: FillPositionDto, @Req() req: Request) {
    const envelope = this.buildCommand('FillPosition', req, { positionId: id, workerId: dto.workerId }, {
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
  async vacatePosition(@Param('id') id: string, @Body(new ZodValidationPipe(VacatePositionDtoSchema)) dto: VacatePositionDto, @Req() req: Request) {
    const envelope = this.buildCommand('VacatePosition', req, { positionId: id, reason: dto.reason ?? 'Vacated via API' }, {
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
  async closePosition(@Param('id') id: string, @Req() req: Request) {
    const envelope = this.buildCommand('ClosePosition', req, { positionId: id, reason: 'Closed via API' }, {
      aggregateType: 'position',
      aggregateId: id,
      reason: 'Close position via API',
    });
    return this.commandBus.execute(envelope);
  }

  @Patch('positions/:id')
  @ApiOperation({ summary: 'Update a position' })
  @ApiParam({ name: 'id', description: 'Position UUID' })
  async updatePosition(@Param('id') id: string, @Body(new ZodValidationPipe(UpdatePositionDtoSchema)) dto: UpdatePositionDto, @Req() req: Request) {
    const envelope = this.buildCommand('UpdatePosition', req, { positionId: id, ...dto }, {
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
    @Req() req: Request,
    @Query('status') status?: string,
    @Query('department') departmentId?: string,
    @Query('legalEntity') legalEntityId?: string,
  ) {
    this.assertPositionAdmin(req);
    let positions = await this.positionRepo.findAll(this.getTenantId(req), status);

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
  async listVacantPositions(@Req() req: Request) {
    this.assertPositionAdmin(req);
    const positions = await this.positionRepo.findVacant(this.getTenantId(req));
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
  async getPosition(@Param('id') id: string, @Req() req: Request) {
    this.assertPositionAdmin(req);
    const position = await this.positionRepo.findById(new Uuid(id));
    if (!position) {
      return { error: 'Position not found' };
    }
    this.assertSameTenant(position.tenantId, req);
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
  async getAllowedActions(@Param('id') id: string, @Req() req: Request) {
    this.assertPositionAdmin(req);
    const position = await this.positionRepo.findById(new Uuid(id));
    if (!position) {
      return { error: 'Position not found' };
    }
    this.assertSameTenant(position.tenantId, req);
    const actions = this.fsmFramework.getAllowedActionsFromState(position.status, 'position');
    return { positionId: id, currentState: position.status, allowedActions: actions };
  }

  @Post('headcount-requests')
  @ApiOperation({ summary: 'Submit a new headcount request' })
  async submitHeadcountRequest(@Body(new ZodValidationPipe(SubmitHeadcountRequestDtoSchema)) dto: SubmitHeadcountRequestDto, @Req() req: Request) {
    const envelope = this.buildCommand('SubmitHeadcountRequest', req, dto, {
      aggregateType: 'headcountRequest',
      reason: 'Submit headcount request via API',
    });
    return this.commandBus.execute(envelope);
  }

  @Post('headcount-requests/:id/commands/start-review')
  @ApiOperation({ summary: 'Start review of a headcount request' })
  @ApiParam({ name: 'id', description: 'Headcount request UUID' })
  async startReview(@Param('id') id: string, @Req() req: Request) {
    const envelope = this.buildCommand('StartReviewHeadcountRequest', req, { requestId: id }, {
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
  async approveHeadcountRequest(@Param('id') id: string, @Body(new ZodValidationPipe(ApproveHeadcountRequestDtoSchema)) dto: ApproveHeadcountRequestDto, @Req() req: Request) {
    const envelope = this.buildCommand('ApproveHeadcountRequest', req, {
      requestId: id,
      positionsApproved: dto.positionsApproved,
      fiscalYear: dto.fiscalYear,
    }, {
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
  async rejectHeadcountRequest(@Param('id') id: string, @Body(new ZodValidationPipe(RejectHeadcountRequestDtoSchema)) dto: RejectHeadcountRequestDto, @Req() req: Request) {
    const envelope = this.buildCommand('RejectHeadcountRequest', req, { requestId: id, reason: dto.reason }, {
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
  async cancelHeadcountRequest(@Param('id') id: string, @Req() req: Request) {
    const envelope = this.buildCommand('CancelHeadcountRequest', req, { requestId: id }, {
      aggregateType: 'headcountRequest',
      aggregateId: id,
      reason: 'Cancel headcount request via API',
    });
    return this.commandBus.execute(envelope);
  }

  @Get('headcount-requests')
  @ApiOperation({ summary: 'List headcount requests' })
  async listHeadcountRequests(@Req() req: Request) {
    this.assertPositionAdmin(req);
    const requests = await this.headcountRepo.findAll(this.getTenantId(req));
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
  async listPendingHeadcountRequests(@Req() req: Request) {
    this.assertPositionAdmin(req);
    const requests = await this.headcountRepo.findPendingApproval(this.getTenantId(req));
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
  async getHeadcountRequest(@Param('id') id: string, @Req() req: Request) {
    this.assertPositionAdmin(req);
    const request = await this.headcountRepo.findById(new Uuid(id));
    if (!request) {
      return { error: 'Headcount request not found' };
    }
    this.assertSameTenant(request.tenantId, req);
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

  @Post('headcount-budgets')
  @ApiOperation({ summary: 'Configure (create or update) the headcount budget ceiling for an org unit and fiscal year' })
  async configureHeadcountBudget(@Body() dto: ConfigureHeadcountBudgetDto, @Req() req: Request) {
    this.assertPositionAdmin(req);
    const envelope = this.buildCommand('ConfigureHeadcountBudget', req, dto, {
      aggregateType: 'headcountBudget',
      reason: 'Configure headcount budget via API',
    });
    return this.commandBus.execute(envelope);
  }

  @Get('headcount-budgets')
  @ApiOperation({ summary: 'List headcount budgets for the tenant, optionally filtered by fiscal year' })
  @ApiQuery({ name: 'fiscalYear', required: false })
  async listHeadcountBudgets(@Req() req: Request, @Query('fiscalYear') fiscalYear?: string) {
    this.assertPositionAdmin(req);
    const budgets = await this.budgetRepo.findAll(this.getTenantId(req), fiscalYear ? Number(fiscalYear) : undefined);
    return budgets.map((b) => ({
      id: b.id.value,
      departmentId: b.departmentId.value,
      fiscalYear: b.fiscalYear,
      ceiling: b.ceiling,
      version: b.version,
      updatedAt: b.updatedAt,
    }));
  }

  @Get('headcount-budgets/lookup')
  @ApiOperation({ summary: 'Get the headcount budget configured for a specific org unit and fiscal year' })
  @ApiQuery({ name: 'departmentId', required: true })
  @ApiQuery({ name: 'fiscalYear', required: true })
  async getHeadcountBudget(
    @Req() req: Request,
    @Query('departmentId') departmentId: string,
    @Query('fiscalYear') fiscalYear: string,
  ) {
    this.assertPositionAdmin(req);
    const budget = await this.budgetRepo.findByDepartmentAndYear(this.getTenantId(req), new Uuid(departmentId), Number(fiscalYear));
    if (!budget) {
      return { error: 'No headcount budget configured for this org unit and fiscal year' };
    }
    this.assertSameTenant(budget.tenantId, req);
    return {
      id: budget.id.value,
      departmentId: budget.departmentId.value,
      fiscalYear: budget.fiscalYear,
      ceiling: budget.ceiling,
      version: budget.version,
      updatedAt: budget.updatedAt,
    };
  }

  private buildCommand<TPayload>(
    commandName: string,
    req: Request,
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
      this.getTenantId(req),
      this.getAdminActor(req),
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

  private getTenantId(req: Request): Uuid {
    const tenantId = req.tenantId as string | undefined;
    if (!tenantId || !Uuid.isValid(tenantId)) {
      throw new ForbiddenException('Position control requires an authenticated tenant');
    }
    return new Uuid(tenantId);
  }

  private getAdminActor(req: Request) {
    const actor = req.actor;
    if (!actor) {
      throw new ForbiddenException('Position control commands require an authenticated actor');
    }
    if (!actor.roles.some((role) => POSITION_ADMIN_ROLES.has(role))) {
      throw new ForbiddenException('Only position or workforce administrators can manage position control');
    }
    return actor;
  }

  private assertPositionAdmin(req: Request): void {
    this.getAdminActor(req);
  }

  private assertSameTenant(recordTenantId: Uuid, req: Request): void {
    if (recordTenantId.value !== this.getTenantId(req).value) {
      throw new ForbiddenException('Requested position-control record is outside the authenticated tenant');
    }
  }
}
