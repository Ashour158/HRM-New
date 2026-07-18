import {
  Controller,
  Post,
  Get,
  Param,
  Body,
  Req,
  BadRequestException,
  ForbiddenException,
  NotFoundException,
  UseGuards,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { CommandBus } from '../../../platform/command-bus/command-bus.js';
import { Uuid } from '@hcm/shared-kernel';
import { computeRequestHash } from '@hcm/platform-core';
import type { HrCommandEnvelope } from '@hcm/command-contracts';
import { AuthGuard } from '../../../guards/auth.guard.js';

import { CompensationPlanRepository } from '../repositories/compensation-plan.repository.js';
import { CompensationBandRepository } from '../repositories/compensation-band.repository.js';
import { CompensationChangeRepository } from '../repositories/compensation-change.repository.js';
import { BonusCycleRepository } from '../repositories/bonus-cycle.repository.js';
import { EquityGrantRepository } from '../repositories/equity-grant.repository.js';
import { VariableCompPlanRepository } from '../repositories/variable-comp-plan.repository.js';
import { PayScaleRepository } from '../repositories/pay-scale.repository.js';
import { TotalCompensationStatementRepository } from '../repositories/total-compensation-statement.repository.js';

import { CompensationPlanFsm } from '../fsm/compensation-plan.fsm.js';
import { CompensationBandFsm } from '../fsm/compensation-band.fsm.js';
import { CompensationChangeFsm } from '../fsm/compensation-change.fsm.js';
import { BonusCycleFsm } from '../fsm/bonus-cycle.fsm.js';
import { EquityGrantFsm } from '../fsm/equity-grant.fsm.js';
import { VariableCompPlanFsm } from '../fsm/variable-comp-plan.fsm.js';
import { PayScaleFsm } from '../fsm/pay-scale.fsm.js';
import { TotalCompensationStatementFsm } from '../fsm/total-compensation-statement.fsm.js';

import {
  CreateCompensationPlanDto,
  CreateCompensationBandDto,
  CreateCompensationChangeDto,
  ApproveCompensationChangeDto,
  CreateBonusCycleDto,
  CreateEquityGrantDto,
  CreateVariableCompPlanDto,
  CreatePayScaleDto,
  CreateTotalCompensationStatementDto,
} from './dtos.js';

const COMPENSATION_ADMIN_ROLES = new Set([
  'APP_ADMIN',
  'PLATFORM_ADMIN',
  'SUPER_ADMIN',
  'HR_ADMIN',
  'HRBP',
  'PAYROLL_ADMIN',
  'COMPENSATION_ADMIN',
]);

@ApiTags('Compensation')
@UseGuards(AuthGuard)
@Controller('hr/compensation')
export class CompensationController {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly planRepo: CompensationPlanRepository,
    private readonly bandRepo: CompensationBandRepository,
    private readonly changeRepo: CompensationChangeRepository,
    private readonly bonusCycleRepo: BonusCycleRepository,
    private readonly equityGrantRepo: EquityGrantRepository,
    private readonly variableCompPlanRepo: VariableCompPlanRepository,
    private readonly payScaleRepo: PayScaleRepository,
    private readonly totalCompStatementRepo: TotalCompensationStatementRepository,
    private readonly planFsm: CompensationPlanFsm,
    private readonly bandFsm: CompensationBandFsm,
    private readonly changeFsm: CompensationChangeFsm,
    private readonly bonusCycleFsm: BonusCycleFsm,
    private readonly equityGrantFsm: EquityGrantFsm,
    private readonly variableCompPlanFsm: VariableCompPlanFsm,
    private readonly payScaleFsm: PayScaleFsm,
    private readonly totalCompStatementFsm: TotalCompensationStatementFsm,
  ) {}

  private buildCommand<TPayload>(
    req: Request,
    commandName: string,
    aggregateType: string,
    aggregateId: string | undefined,
    payload: TPayload,
  ): HrCommandEnvelope<TPayload> {
    const tenantId = req.tenantId;
    if (!tenantId) {
      throw new BadRequestException('Tenant ID missing');
    }
    const actor = req.actor;
    if (!actor) {
      throw new BadRequestException('Actor missing');
    }
    this.assertCompensationAdminScope(req);
    return {
      commandId: Uuid.generate(),
      commandName,
      commandSchemaVersion: 1,
      tenantId: new Uuid(tenantId),
      actor,
      aggregateType,
      aggregateId: aggregateId ? new Uuid(aggregateId) : undefined,
      idempotencyKey: crypto.randomUUID(),
      correlationId: Uuid.generate(),
      reason: `${commandName} via API`,
      payload,
      metadata: {
        requestHash: computeRequestHash(payload),
        clientType: 'HR_ADMIN',
      },
    };
  }

  /* ---------------------------------------------------------------- */
  /*  Compensation Plans                                                */
  /* ---------------------------------------------------------------- */

  @Post('plans')
  async createPlan(@Body() dto: CreateCompensationPlanDto, @Req() req: Request) {
    const command = this.buildCommand(req, 'CreateCompensationPlan', 'CompensationPlan', undefined, {
      planId: new Uuid(dto.planId),
      name: dto.name,
      planType: dto.planType,
      currency: dto.currency,
      effectiveFrom: dto.effectiveFrom,
      effectiveUntil: dto.effectiveUntil,
    });
    return this.commandBus.execute(command);
  }

  @Post('plans/:id/commands/activate')
  async activatePlan(@Param('id') id: string, @Req() req: Request) {
    const command = this.buildCommand(req, 'ActivateCompensationPlan', 'CompensationPlan', id, {
      planId: new Uuid(id),
    });
    return this.commandBus.execute(command);
  }

  @Get('plans')
  async listPlans(@Req() req: Request) {
    this.assertCompensationAdminScope(req);
    const tenantId = req.tenantId;
    if (!tenantId) throw new BadRequestException('Tenant ID missing');
    return this.planRepo.findByTenant(new Uuid(tenantId));
  }

  @Get('plans/:id')
  async getPlan(@Param('id') id: string, @Req() req: Request) {
    this.assertCompensationAdminScope(req);
    const plan = await this.planRepo.findById(new Uuid(id));
    if (!plan) throw new NotFoundException('CompensationPlan not found');
    return plan;
  }

  @Get('plans/:id/allowed-actions')
  async getPlanAllowedActions(@Param('id') id: string, @Req() req: Request) {
    this.assertCompensationAdminScope(req);
    const plan = await this.planRepo.findById(new Uuid(id));
    if (!plan) throw new NotFoundException('CompensationPlan not found');
    return { allowedActions: this.planFsm.getAllowedActions(plan.status) };
  }

  /* ---------------------------------------------------------------- */
  /*  Compensation Bands                                                */
  /* ---------------------------------------------------------------- */

  @Post('bands')
  async createBand(@Body() dto: CreateCompensationBandDto, @Req() req: Request) {
    const command = this.buildCommand(req, 'CreateCompensationBand', 'CompensationBand', undefined, {
      bandId: new Uuid(dto.bandId),
      bandCode: dto.bandCode,
      jobLevel: dto.jobLevel,
      jobFamily: dto.jobFamily,
      minSalary: dto.minSalary,
      midSalary: dto.midSalary,
      maxSalary: dto.maxSalary,
      currency: dto.currency,
    });
    return this.commandBus.execute(command);
  }

  @Get('bands')
  async listBands(@Req() req: Request) {
    this.assertCompensationAdminScope(req);
    const tenantId = req.tenantId;
    if (!tenantId) throw new BadRequestException('Tenant ID missing');
    return this.bandRepo.findByTenant(new Uuid(tenantId));
  }

  @Get('bands/:id')
  async getBand(@Param('id') id: string, @Req() req: Request) {
    this.assertCompensationAdminScope(req);
    const band = await this.bandRepo.findById(new Uuid(id));
    if (!band) throw new NotFoundException('CompensationBand not found');
    return band;
  }

  @Get('bands/:id/allowed-actions')
  async getBandAllowedActions(@Param('id') id: string, @Req() req: Request) {
    this.assertCompensationAdminScope(req);
    const band = await this.bandRepo.findById(new Uuid(id));
    if (!band) throw new NotFoundException('CompensationBand not found');
    return { allowedActions: this.bandFsm.getAllowedActions(band.status) };
  }

  /* ---------------------------------------------------------------- */
  /*  Compensation Changes                                              */
  /* ---------------------------------------------------------------- */

  @Post('changes')
  async createChange(@Body() dto: CreateCompensationChangeDto, @Req() req: Request) {
    const command = this.buildCommand(req, 'CreateCompensationChange', 'CompensationChange', undefined, {
      changeId: new Uuid(dto.changeId),
      workerId: new Uuid(dto.workerId),
      changeType: dto.changeType,
      oldAmount: dto.oldAmount,
      newAmount: dto.newAmount,
      currency: dto.currency,
      effectiveDate: dto.effectiveDate,
    });
    return this.commandBus.execute(command);
  }

  @Post('changes/:id/commands/submit')
  async submitChange(@Param('id') id: string, @Req() req: Request) {
    const command = this.buildCommand(req, 'SubmitCompensationChange', 'CompensationChange', id, {
      changeId: new Uuid(id),
    });
    return this.commandBus.execute(command);
  }

  @Post('changes/:id/commands/approve')
  async approveChange(@Param('id') id: string, @Body() dto: ApproveCompensationChangeDto, @Req() req: Request) {
    const command = this.buildCommand(req, 'ApproveCompensationChange', 'CompensationChange', id, {
      changeId: new Uuid(id),
      approvedBy: new Uuid(dto.approvedBy),
    });
    return this.commandBus.execute(command);
  }

  @Get('changes/worker/:workerId')
  async getChangesByWorker(@Param('workerId') workerId: string, @Req() req: Request) {
    this.assertCompensationAdminScope(req);
    return this.changeRepo.findByWorker(new Uuid(workerId));
  }

  @Get('changes/:id/allowed-actions')
  async getChangeAllowedActions(@Param('id') id: string, @Req() req: Request) {
    this.assertCompensationAdminScope(req);
    const change = await this.changeRepo.findById(new Uuid(id));
    if (!change) throw new NotFoundException('CompensationChange not found');
    return { allowedActions: this.changeFsm.getAllowedActions(change.status) };
  }

  /* ---------------------------------------------------------------- */
  /*  Bonus Cycles                                                      */
  /* ---------------------------------------------------------------- */

  @Post('bonus-cycles')
  async createBonusCycle(@Body() dto: CreateBonusCycleDto, @Req() req: Request) {
    const command = this.buildCommand(req, 'CreateBonusCycle', 'BonusCycle', undefined, {
      cycleId: new Uuid(dto.cycleId),
      cycleName: dto.cycleName,
      cycleYear: dto.cycleYear,
      eligibilityDate: dto.eligibilityDate,
      paymentDate: dto.paymentDate,
      totalPoolAmount: dto.totalPoolAmount,
      currency: dto.currency,
    });
    return this.commandBus.execute(command);
  }

  @Get('bonus-cycles')
  async listBonusCycles(@Req() req: Request) {
    this.assertCompensationAdminScope(req);
    const tenantId = req.tenantId;
    if (!tenantId) throw new BadRequestException('Tenant ID missing');
    return this.bonusCycleRepo.findByTenant(new Uuid(tenantId));
  }

  @Get('bonus-cycles/:id')
  async getBonusCycle(@Param('id') id: string, @Req() req: Request) {
    this.assertCompensationAdminScope(req);
    const cycle = await this.bonusCycleRepo.findById(new Uuid(id));
    if (!cycle) throw new NotFoundException('BonusCycle not found');
    return cycle;
  }

  @Get('bonus-cycles/:id/allowed-actions')
  async getBonusCycleAllowedActions(@Param('id') id: string, @Req() req: Request) {
    this.assertCompensationAdminScope(req);
    const cycle = await this.bonusCycleRepo.findById(new Uuid(id));
    if (!cycle) throw new NotFoundException('BonusCycle not found');
    return { allowedActions: this.bonusCycleFsm.getAllowedActions(cycle.status) };
  }

  /* ---------------------------------------------------------------- */
  /*  Equity Grants                                                     */
  /* ---------------------------------------------------------------- */

  @Post('equity-grants')
  async createEquityGrant(@Body() dto: CreateEquityGrantDto, @Req() req: Request) {
    const command = this.buildCommand(req, 'CreateEquityGrant', 'EquityGrant', undefined, {
      grantId: new Uuid(dto.grantId),
      workerId: new Uuid(dto.workerId),
      grantType: dto.grantType,
      grantDate: dto.grantDate,
      vestingSchedule: dto.vestingSchedule,
      totalUnits: dto.totalUnits,
      strikePrice: dto.strikePrice,
    });
    return this.commandBus.execute(command);
  }

  @Get('equity-grants/worker/:workerId')
  async getEquityGrantsByWorker(@Param('workerId') workerId: string, @Req() req: Request) {
    this.assertCompensationAdminScope(req);
    return this.equityGrantRepo.findByWorker(new Uuid(workerId));
  }

  @Get('equity-grants/:id')
  async getEquityGrant(@Param('id') id: string, @Req() req: Request) {
    this.assertCompensationAdminScope(req);
    const grant = await this.equityGrantRepo.findById(new Uuid(id));
    if (!grant) throw new NotFoundException('EquityGrant not found');
    return grant;
  }

  @Get('equity-grants/:id/allowed-actions')
  async getEquityGrantAllowedActions(@Param('id') id: string, @Req() req: Request) {
    this.assertCompensationAdminScope(req);
    const grant = await this.equityGrantRepo.findById(new Uuid(id));
    if (!grant) throw new NotFoundException('EquityGrant not found');
    return { allowedActions: this.equityGrantFsm.getAllowedActions(grant.status) };
  }

  /* ---------------------------------------------------------------- */
  /*  Variable Comp Plans                                               */
  /* ---------------------------------------------------------------- */

  @Post('variable-comp-plans')
  async createVariableCompPlan(@Body() dto: CreateVariableCompPlanDto, @Req() req: Request) {
    const command = this.buildCommand(req, 'CreateVariableCompPlan', 'VariableCompPlan', undefined, {
      planId: new Uuid(dto.planId),
      name: dto.name,
      planType: dto.planType,
      targetPercentage: dto.targetPercentage,
      maxPercentage: dto.maxPercentage,
      currency: dto.currency,
    });
    return this.commandBus.execute(command);
  }

  @Get('variable-comp-plans')
  async listVariableCompPlans(@Req() req: Request) {
    this.assertCompensationAdminScope(req);
    const tenantId = req.tenantId;
    if (!tenantId) throw new BadRequestException('Tenant ID missing');
    return this.variableCompPlanRepo.findByTenant(new Uuid(tenantId));
  }

  @Get('variable-comp-plans/:id')
  async getVariableCompPlan(@Param('id') id: string, @Req() req: Request) {
    this.assertCompensationAdminScope(req);
    const plan = await this.variableCompPlanRepo.findById(new Uuid(id));
    if (!plan) throw new NotFoundException('VariableCompPlan not found');
    return plan;
  }

  @Get('variable-comp-plans/:id/allowed-actions')
  async getVariableCompPlanAllowedActions(@Param('id') id: string, @Req() req: Request) {
    this.assertCompensationAdminScope(req);
    const plan = await this.variableCompPlanRepo.findById(new Uuid(id));
    if (!plan) throw new NotFoundException('VariableCompPlan not found');
    return { allowedActions: this.variableCompPlanFsm.getAllowedActions(plan.status) };
  }

  /* ---------------------------------------------------------------- */
  /*  Pay Scales                                                        */
  /* ---------------------------------------------------------------- */

  @Post('pay-scales')
  async createPayScale(@Body() dto: CreatePayScaleDto, @Req() req: Request) {
    const command = this.buildCommand(req, 'CreatePayScale', 'PayScale', undefined, {
      scaleId: new Uuid(dto.scaleId),
      scaleCode: dto.scaleCode,
      grade: dto.grade,
      steps: dto.steps,
      currency: dto.currency,
    });
    return this.commandBus.execute(command);
  }

  @Get('pay-scales')
  async listPayScales(@Req() req: Request) {
    this.assertCompensationAdminScope(req);
    const tenantId = req.tenantId;
    if (!tenantId) throw new BadRequestException('Tenant ID missing');
    return this.payScaleRepo.findByTenant(new Uuid(tenantId));
  }

  @Get('pay-scales/:id')
  async getPayScale(@Param('id') id: string, @Req() req: Request) {
    this.assertCompensationAdminScope(req);
    const scale = await this.payScaleRepo.findById(new Uuid(id));
    if (!scale) throw new NotFoundException('PayScale not found');
    return scale;
  }

  @Get('pay-scales/:id/allowed-actions')
  async getPayScaleAllowedActions(@Param('id') id: string, @Req() req: Request) {
    this.assertCompensationAdminScope(req);
    const scale = await this.payScaleRepo.findById(new Uuid(id));
    if (!scale) throw new NotFoundException('PayScale not found');
    return { allowedActions: this.payScaleFsm.getAllowedActions(scale.status) };
  }

  /* ---------------------------------------------------------------- */
  /*  Total Compensation Statements                                     */
  /* ---------------------------------------------------------------- */

  @Post('total-comp-statements')
  async createTotalCompStatement(@Body() dto: CreateTotalCompensationStatementDto, @Req() req: Request) {
    const command = this.buildCommand(req, 'CreateTotalCompensationStatement', 'TotalCompensationStatement', undefined, {
      statementId: new Uuid(dto.statementId),
      workerId: new Uuid(dto.workerId),
      statementYear: dto.statementYear,
      baseSalary: dto.baseSalary,
      bonusAmount: dto.bonusAmount,
      equityValue: dto.equityValue,
      benefitsValue: dto.benefitsValue,
      totalComp: dto.totalComp,
      currency: dto.currency,
    });
    return this.commandBus.execute(command);
  }

  @Get('total-comp-statements/worker/:workerId')
  async getTotalCompStatementsByWorker(@Param('workerId') workerId: string, @Req() req: Request) {
    this.assertCompensationAdminScope(req);
    return this.totalCompStatementRepo.findByWorker(new Uuid(workerId));
  }

  @Get('total-comp-statements/:id')
  async getTotalCompStatement(@Param('id') id: string, @Req() req: Request) {
    this.assertCompensationAdminScope(req);
    const statement = await this.totalCompStatementRepo.findById(new Uuid(id));
    if (!statement) throw new NotFoundException('TotalCompensationStatement not found');
    return statement;
  }

  @Get('total-comp-statements/:id/allowed-actions')
  async getTotalCompStatementAllowedActions(@Param('id') id: string, @Req() req: Request) {
    this.assertCompensationAdminScope(req);
    const statement = await this.totalCompStatementRepo.findById(new Uuid(id));
    if (!statement) throw new NotFoundException('TotalCompensationStatement not found');
    return { allowedActions: this.totalCompStatementFsm.getAllowedActions(statement.status) };
  }

  private assertCompensationAdminScope(req: Request): void {
    const roles = req.actor?.roles ?? [];
    if (roles.some((role) => COMPENSATION_ADMIN_ROLES.has(role))) return;
    throw new ForbiddenException('Only HR, payroll, or compensation administrators can access compensation administration');
  }
}
