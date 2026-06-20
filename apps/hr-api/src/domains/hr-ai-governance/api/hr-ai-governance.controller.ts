import { Controller, Get, Post, Body, Param, Query, Req, BadRequestException, ForbiddenException, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { randomUUID } from 'crypto';
import { CommandBus } from '../../../platform/command-bus/command-bus.js';
import { Uuid } from '@hcm/shared-kernel';
import { computeRequestHash } from '@hcm/platform-core';
import type { HrCommandEnvelope } from '@hcm/command-contracts';
import { AuthGuard } from '../../../guards/auth.guard.js';
import { actorClientType, requireActor, requireTenantId } from '../../../platform/http/request-context.js';
import { HrAiUseCaseRepository } from '../repositories/hr-ai-use-case.repository.js';
import { HrAiModelRunRepository } from '../repositories/hr-ai-model-run.repository.js';
import { HrAiBiasTestRepository } from '../repositories/hr-ai-bias-test.repository.js';
import { HrAiKillSwitchRepository } from '../repositories/hr-ai-kill-switch.repository.js';
import type * as dtos from './dtos.js';
import {
  RegisterHrAiUseCaseDtoSchema, CreateHrAiModelRunDtoSchema, CompleteHrAiModelRunDtoSchema,
  FailHrAiModelRunDtoSchema, PlanHrAiBiasTestDtoSchema, CompleteHrAiBiasTestDtoSchema,
  FailHrAiBiasTestDtoSchema, ArmHrAiKillSwitchDtoSchema, ResolveHrAiKillSwitchDtoSchema, ZodValidationPipe,
} from './dtos.js';

// HR AI governance (use cases, model runs, bias tests, kill switches) is restricted
// to AI-governance, compliance, and platform administrators.
const HR_AI_GOVERNANCE_ADMIN_ROLES = new Set([
  'APP_ADMIN',
  'PLATFORM_ADMIN',
  'SUPER_ADMIN',
  'HR_ADMIN',
  'COMPLIANCE_ADMIN',
  'AI_GOVERNANCE_ADMIN',
]);

@ApiTags('HR AI Governance')
@Controller('hr-ai-governance')
@UseGuards(AuthGuard)
export class HrAiGovernanceController {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly useCaseRepo: HrAiUseCaseRepository,
    private readonly modelRunRepo: HrAiModelRunRepository,
    private readonly biasTestRepo: HrAiBiasTestRepository,
    private readonly killSwitchRepo: HrAiKillSwitchRepository,
  ) {}

  private buildCommand<TPayload>(
    commandName: string, aggregateType: string, payload: TPayload, req: Request,
    options?: { aggregateId?: Uuid; expectedState?: string; expectedVersion?: number },
  ): HrCommandEnvelope<TPayload> {
    this.assertAiGovernanceScope(req);
    const tenantId = requireTenantId(req, 'HR AI Governance');
    const actor = requireActor(req, 'HR AI Governance');
    return {
      commandId: Uuid.generate(), commandName, commandSchemaVersion: 1, tenantId,
      actor,
      aggregateType, aggregateId: options?.aggregateId, expectedState: options?.expectedState, expectedVersion: options?.expectedVersion,
      idempotencyKey: randomUUID(), correlationId: Uuid.generate(), reason: 'API request', payload,
      metadata: { requestHash: computeRequestHash(payload), clientType: actorClientType(actor) },
    };
  }

  private assertAiGovernanceScope(req: Request): void {
    const roles = req.actor?.roles ?? [];
    if (roles.some((role) => HR_AI_GOVERNANCE_ADMIN_ROLES.has(role))) return;
    throw new ForbiddenException('Only AI-governance, compliance, or HR administrators can access HR AI governance records');
  }

  /** Resolve the caller's tenant for tenant-scoped repository lookups. */
  private tenantId(req: Request): Uuid {
    this.assertAiGovernanceScope(req);
    return requireTenantId(req, 'HR AI Governance');
  }

  private requireMatchingTenant(req: Request, tenantId: string): Uuid {
    this.assertAiGovernanceScope(req);
    const requestTenantId = requireTenantId(req, 'HR AI Governance');
    if (requestTenantId.value !== tenantId) {
      throw new BadRequestException('Tenant mismatch');
    }
    return requestTenantId;
  }

  @Post('use-cases')
  async registerHrAiUseCase(@Body(new ZodValidationPipe(RegisterHrAiUseCaseDtoSchema)) dto: dtos.RegisterHrAiUseCaseDto, @Req() req: Request) {
    return this.commandBus.execute(this.buildCommand('RegisterHrAiUseCase', 'HrAiUseCase', dto, req));
  }
  @Post('use-cases/:id/commands/review')
  async reviewHrAiUseCase(@Param('id') id: string, @Req() req: Request) {
    const uc = await this.useCaseRepo.findById(new Uuid(id), this.tenantId(req));
    if (!uc) throw new BadRequestException('Use case not found');
    return this.commandBus.execute(this.buildCommand('ReviewHrAiUseCase', 'HrAiUseCase', { hrAiUseCaseId: id }, req, { aggregateId: new Uuid(id), expectedState: uc.status, expectedVersion: uc.aggregateVersion }));
  }
  @Post('use-cases/:id/commands/approve')
  async approveHrAiUseCase(@Param('id') id: string, @Req() req: Request) {
    const uc = await this.useCaseRepo.findById(new Uuid(id), this.tenantId(req));
    if (!uc) throw new BadRequestException('Use case not found');
    return this.commandBus.execute(this.buildCommand('ApproveHrAiUseCase', 'HrAiUseCase', { hrAiUseCaseId: id }, req, { aggregateId: new Uuid(id), expectedState: uc.status, expectedVersion: uc.aggregateVersion }));
  }
  @Post('use-cases/:id/commands/activate')
  async activateHrAiUseCase(@Param('id') id: string, @Req() req: Request) {
    const uc = await this.useCaseRepo.findById(new Uuid(id), this.tenantId(req));
    if (!uc) throw new BadRequestException('Use case not found');
    return this.commandBus.execute(this.buildCommand('ActivateHrAiUseCase', 'HrAiUseCase', { hrAiUseCaseId: id }, req, { aggregateId: new Uuid(id), expectedState: uc.status, expectedVersion: uc.aggregateVersion }));
  }
  @Post('use-cases/:id/commands/suspend')
  async suspendHrAiUseCase(@Param('id') id: string, @Req() req: Request) {
    const uc = await this.useCaseRepo.findById(new Uuid(id), this.tenantId(req));
    if (!uc) throw new BadRequestException('Use case not found');
    return this.commandBus.execute(this.buildCommand('SuspendHrAiUseCase', 'HrAiUseCase', { hrAiUseCaseId: id }, req, { aggregateId: new Uuid(id), expectedState: uc.status, expectedVersion: uc.aggregateVersion }));
  }
  @Post('use-cases/:id/commands/retire')
  async retireHrAiUseCase(@Param('id') id: string, @Req() req: Request) {
    const uc = await this.useCaseRepo.findById(new Uuid(id), this.tenantId(req));
    if (!uc) throw new BadRequestException('Use case not found');
    return this.commandBus.execute(this.buildCommand('RetireHrAiUseCase', 'HrAiUseCase', { hrAiUseCaseId: id }, req, { aggregateId: new Uuid(id), expectedState: uc.status, expectedVersion: uc.aggregateVersion }));
  }
  @Post('use-cases/:id/commands/reject')
  async rejectHrAiUseCase(@Param('id') id: string, @Req() req: Request) {
    const uc = await this.useCaseRepo.findById(new Uuid(id), this.tenantId(req));
    if (!uc) throw new BadRequestException('Use case not found');
    return this.commandBus.execute(this.buildCommand('RejectHrAiUseCase', 'HrAiUseCase', { hrAiUseCaseId: id }, req, { aggregateId: new Uuid(id), expectedState: uc.status, expectedVersion: uc.aggregateVersion }));
  }
  @Get('use-cases')
  async listHrAiUseCases(@Req() req: Request, @Query('status') status?: string) { return this.useCaseRepo.findByStatus(status ?? 'REGISTERED', this.tenantId(req)); }
  @Get('use-cases/tenant/:tenantId')
  async listHrAiUseCasesByTenant(@Param('tenantId') tenantId: string, @Req() req: Request) {
    return this.useCaseRepo.findByTenant(this.requireMatchingTenant(req, tenantId));
  }
  @Get('use-cases/:id')
  async getHrAiUseCase(@Param('id') id: string, @Req() req: Request) { return this.useCaseRepo.findById(new Uuid(id), this.tenantId(req)); }

  @Post('model-runs')
  async createHrAiModelRun(@Body(new ZodValidationPipe(CreateHrAiModelRunDtoSchema)) dto: dtos.CreateHrAiModelRunDto, @Req() req: Request) {
    return this.commandBus.execute(this.buildCommand('CreateHrAiModelRun', 'HrAiModelRun', dto, req));
  }
  @Post('model-runs/:id/commands/start')
  async startHrAiModelRun(@Param('id') id: string, @Req() req: Request) {
    const run = await this.modelRunRepo.findById(new Uuid(id), this.tenantId(req));
    if (!run) throw new BadRequestException('Model run not found');
    return this.commandBus.execute(this.buildCommand('StartHrAiModelRun', 'HrAiModelRun', { hrAiModelRunId: id }, req, { aggregateId: new Uuid(id), expectedState: run.status, expectedVersion: run.aggregateVersion }));
  }
  @Post('model-runs/:id/commands/complete')
  async completeHrAiModelRun(@Body(new ZodValidationPipe(CompleteHrAiModelRunDtoSchema)) dto: dtos.CompleteHrAiModelRunDto, @Req() req: Request) {
    const run = await this.modelRunRepo.findById(new Uuid(dto.hrAiModelRunId), this.tenantId(req));
    if (!run) throw new BadRequestException('Model run not found');
    return this.commandBus.execute(this.buildCommand('CompleteHrAiModelRun', 'HrAiModelRun', dto, req, { aggregateId: new Uuid(dto.hrAiModelRunId), expectedState: run.status, expectedVersion: run.aggregateVersion }));
  }
  @Post('model-runs/:id/commands/fail')
  async failHrAiModelRun(@Body(new ZodValidationPipe(FailHrAiModelRunDtoSchema)) dto: dtos.FailHrAiModelRunDto, @Req() req: Request) {
    const run = await this.modelRunRepo.findById(new Uuid(dto.hrAiModelRunId), this.tenantId(req));
    if (!run) throw new BadRequestException('Model run not found');
    return this.commandBus.execute(this.buildCommand('FailHrAiModelRun', 'HrAiModelRun', dto, req, { aggregateId: new Uuid(dto.hrAiModelRunId), expectedState: run.status, expectedVersion: run.aggregateVersion }));
  }
  @Get('model-runs')
  async listHrAiModelRuns(@Req() req: Request, @Query('useCaseId') useCaseId?: string) {
    if (useCaseId) return this.modelRunRepo.findByUseCaseId(new Uuid(useCaseId), this.tenantId(req));
    return [];
  }
  @Get('model-runs/tenant/:tenantId')
  async listHrAiModelRunsByTenant(@Param('tenantId') tenantId: string, @Req() req: Request) {
    return this.modelRunRepo.findByTenant(this.requireMatchingTenant(req, tenantId));
  }
  @Get('model-runs/:id')
  async getHrAiModelRun(@Param('id') id: string, @Req() req: Request) { return this.modelRunRepo.findById(new Uuid(id), this.tenantId(req)); }

  @Post('bias-tests')
  async planHrAiBiasTest(@Body(new ZodValidationPipe(PlanHrAiBiasTestDtoSchema)) dto: dtos.PlanHrAiBiasTestDto, @Req() req: Request) {
    return this.commandBus.execute(this.buildCommand('PlanHrAiBiasTest', 'HrAiBiasTest', dto, req));
  }
  @Post('bias-tests/:id/commands/start')
  async startHrAiBiasTest(@Param('id') id: string, @Req() req: Request) {
    const bt = await this.biasTestRepo.findById(new Uuid(id), this.tenantId(req));
    if (!bt) throw new BadRequestException('Bias test not found');
    return this.commandBus.execute(this.buildCommand('StartHrAiBiasTest', 'HrAiBiasTest', { hrAiBiasTestId: id }, req, { aggregateId: new Uuid(id), expectedState: bt.status, expectedVersion: bt.aggregateVersion }));
  }
  @Post('bias-tests/:id/commands/complete')
  async completeHrAiBiasTest(@Body(new ZodValidationPipe(CompleteHrAiBiasTestDtoSchema)) dto: dtos.CompleteHrAiBiasTestDto, @Req() req: Request) {
    const bt = await this.biasTestRepo.findById(new Uuid(dto.hrAiBiasTestId), this.tenantId(req));
    if (!bt) throw new BadRequestException('Bias test not found');
    return this.commandBus.execute(this.buildCommand('CompleteHrAiBiasTest', 'HrAiBiasTest', dto, req, { aggregateId: new Uuid(dto.hrAiBiasTestId), expectedState: bt.status, expectedVersion: bt.aggregateVersion }));
  }
  @Post('bias-tests/:id/commands/fail')
  async failHrAiBiasTest(@Body(new ZodValidationPipe(FailHrAiBiasTestDtoSchema)) dto: dtos.FailHrAiBiasTestDto, @Req() req: Request) {
    const bt = await this.biasTestRepo.findById(new Uuid(dto.hrAiBiasTestId), this.tenantId(req));
    if (!bt) throw new BadRequestException('Bias test not found');
    return this.commandBus.execute(this.buildCommand('FailHrAiBiasTest', 'HrAiBiasTest', dto, req, { aggregateId: new Uuid(dto.hrAiBiasTestId), expectedState: bt.status, expectedVersion: bt.aggregateVersion }));
  }
  @Get('bias-tests')
  async listHrAiBiasTests(@Req() req: Request, @Query('useCaseId') useCaseId?: string) {
    if (useCaseId) return this.biasTestRepo.findByUseCaseId(new Uuid(useCaseId), this.tenantId(req));
    return [];
  }
  @Get('bias-tests/tenant/:tenantId')
  async listHrAiBiasTestsByTenant(@Param('tenantId') tenantId: string, @Req() req: Request) {
    return this.biasTestRepo.findByTenant(this.requireMatchingTenant(req, tenantId));
  }
  @Get('bias-tests/:id')
  async getHrAiBiasTest(@Param('id') id: string, @Req() req: Request) { return this.biasTestRepo.findById(new Uuid(id), this.tenantId(req)); }

  @Post('kill-switches')
  async armHrAiKillSwitch(@Body(new ZodValidationPipe(ArmHrAiKillSwitchDtoSchema)) dto: dtos.ArmHrAiKillSwitchDto, @Req() req: Request) {
    return this.commandBus.execute(this.buildCommand('ArmHrAiKillSwitch', 'HrAiKillSwitch', dto, req));
  }
  @Post('kill-switches/:id/commands/trigger')
  async triggerHrAiKillSwitch(@Param('id') id: string, @Req() req: Request) {
    const ks = await this.killSwitchRepo.findById(new Uuid(id), this.tenantId(req));
    if (!ks) throw new BadRequestException('Kill switch not found');
    return this.commandBus.execute(this.buildCommand('TriggerHrAiKillSwitch', 'HrAiKillSwitch', { hrAiKillSwitchId: id }, req, { aggregateId: new Uuid(id), expectedState: ks.status, expectedVersion: ks.aggregateVersion }));
  }
  @Post('kill-switches/:id/commands/investigate')
  async investigateHrAiKillSwitch(@Param('id') id: string, @Req() req: Request) {
    const ks = await this.killSwitchRepo.findById(new Uuid(id), this.tenantId(req));
    if (!ks) throw new BadRequestException('Kill switch not found');
    return this.commandBus.execute(this.buildCommand('InvestigateHrAiKillSwitch', 'HrAiKillSwitch', { hrAiKillSwitchId: id }, req, { aggregateId: new Uuid(id), expectedState: ks.status, expectedVersion: ks.aggregateVersion }));
  }
  @Post('kill-switches/:id/commands/resolve')
  async resolveHrAiKillSwitch(@Body(new ZodValidationPipe(ResolveHrAiKillSwitchDtoSchema)) dto: dtos.ResolveHrAiKillSwitchDto, @Req() req: Request) {
    const ks = await this.killSwitchRepo.findById(new Uuid(dto.hrAiKillSwitchId), this.tenantId(req));
    if (!ks) throw new BadRequestException('Kill switch not found');
    return this.commandBus.execute(this.buildCommand('ResolveHrAiKillSwitch', 'HrAiKillSwitch', dto, req, { aggregateId: new Uuid(dto.hrAiKillSwitchId), expectedState: ks.status, expectedVersion: ks.aggregateVersion }));
  }
  @Post('kill-switches/:id/commands/rearm')
  async rearmHrAiKillSwitch(@Param('id') id: string, @Req() req: Request) {
    const ks = await this.killSwitchRepo.findById(new Uuid(id), this.tenantId(req));
    if (!ks) throw new BadRequestException('Kill switch not found');
    return this.commandBus.execute(this.buildCommand('RearmHrAiKillSwitch', 'HrAiKillSwitch', { hrAiKillSwitchId: id }, req, { aggregateId: new Uuid(id), expectedState: ks.status, expectedVersion: ks.aggregateVersion }));
  }
  @Get('kill-switches')
  async listHrAiKillSwitches(@Req() req: Request, @Query('useCaseId') useCaseId?: string) {
    if (useCaseId) return this.killSwitchRepo.findByUseCaseId(new Uuid(useCaseId), this.tenantId(req));
    return [];
  }
  @Get('kill-switches/tenant/:tenantId')
  async listHrAiKillSwitchesByTenant(@Param('tenantId') tenantId: string, @Req() req: Request) {
    return this.killSwitchRepo.findByTenant(this.requireMatchingTenant(req, tenantId));
  }
  @Get('kill-switches/:id')
  async getHrAiKillSwitch(@Param('id') id: string, @Req() req: Request) { return this.killSwitchRepo.findById(new Uuid(id), this.tenantId(req)); }
}
