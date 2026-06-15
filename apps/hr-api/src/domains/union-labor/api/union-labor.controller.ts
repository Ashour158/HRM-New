import { Controller, Get, Post, Body, Param, Req, BadRequestException } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { randomUUID } from 'crypto';
import { CommandBus } from '../../../platform/command-bus/command-bus.js';
import { Uuid } from '@hcm/shared-kernel';
import { computeRequestHash } from '@hcm/platform-core';
import type { HrCommandEnvelope } from '@hcm/command-contracts';
import { actorClientType, requireActor, requireTenantId } from '../../../platform/http/request-context.js';
import { UnionRecognitionRepository } from '../repositories/union-recognition.repository.js';
import { GrievanceRepository } from '../repositories/grievance.repository.js';
import { CollectiveBargainingSessionRepository } from '../repositories/collective-bargaining-session.repository.js';
import type * as dtos from './union-labor.dto.js';
import {
  CreateUnionRecognitionDto,
  CreateGrievanceDto,
  CreateCollectiveBargainingSessionDto,
  ZodValidationPipe,
} from './union-labor.dto.js';

@ApiTags('Union & Labor')
@Controller('union-labor')
export class UnionLaborController {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly unionRecognitionRepo: UnionRecognitionRepository,
    private readonly grievanceRepo: GrievanceRepository,
    private readonly cbsRepo: CollectiveBargainingSessionRepository,
  ) {}

  private buildCommand<TPayload>(
    commandName: string,
    aggregateType: string,
    payload: TPayload,
    req: Request,
    options?: { aggregateId?: Uuid; expectedState?: string; expectedVersion?: number; subjectWorkerId?: Uuid },
  ): HrCommandEnvelope<TPayload> {
    const tenantId = requireTenantId(req, 'Union and Labor');
    const actor = requireActor(req, 'Union and Labor');
    return {
      commandId: Uuid.generate(),
      commandName,
      commandSchemaVersion: 1,
      tenantId,
      actor,
      aggregateType,
      aggregateId: options?.aggregateId,
      expectedState: options?.expectedState,
      expectedVersion: options?.expectedVersion,
      subjectWorkerId: options?.subjectWorkerId,
      idempotencyKey: randomUUID(),
      correlationId: Uuid.generate(),
      reason: 'API request',
      payload,
      metadata: { requestHash: computeRequestHash(payload), clientType: actorClientType(actor) },
    };
  }

  private requireMatchingTenant(req: Request, tenantId: string): Uuid {
    const requestTenantId = requireTenantId(req, 'Union and Labor');
    if (requestTenantId.value !== tenantId) {
      throw new BadRequestException('Tenant mismatch');
    }
    return requestTenantId;
  }

  @Post('union-recognitions')
  async createRecognition(@Body(new ZodValidationPipe(CreateUnionRecognitionDto)) dto: dtos.CreateUnionRecognitionDto, @Req() req: Request) {
    return this.commandBus.execute(this.buildCommand('CreateUnionRecognition', 'UnionRecognition', dto, req));
  }

  @Post('union-recognitions/:id/commands/negotiate')
  async negotiateRecognition(@Param('id') id: string, @Req() req: Request) {
    const ar = await this.unionRecognitionRepo.findById(new Uuid(id));
    if (!ar) throw new BadRequestException('Union recognition not found');
    return this.commandBus.execute(this.buildCommand('NegotiateUnionRecognition', 'UnionRecognition', { unionRecognitionId: new Uuid(id) }, req, { aggregateId: new Uuid(id), expectedState: ar.status, expectedVersion: ar.aggregateVersion }));
  }

  @Post('union-recognitions/:id/commands/ratify')
  async ratifyRecognition(@Param('id') id: string, @Req() req: Request) {
    const ar = await this.unionRecognitionRepo.findById(new Uuid(id));
    if (!ar) throw new BadRequestException('Union recognition not found');
    return this.commandBus.execute(this.buildCommand('RatifyUnionRecognition', 'UnionRecognition', { unionRecognitionId: new Uuid(id) }, req, { aggregateId: new Uuid(id), expectedState: ar.status, expectedVersion: ar.aggregateVersion }));
  }

  @Post('union-recognitions/:id/commands/activate')
  async activateRecognition(@Param('id') id: string, @Req() req: Request) {
    const ar = await this.unionRecognitionRepo.findById(new Uuid(id));
    if (!ar) throw new BadRequestException('Union recognition not found');
    return this.commandBus.execute(this.buildCommand('ActivateUnionRecognition', 'UnionRecognition', { unionRecognitionId: new Uuid(id) }, req, { aggregateId: new Uuid(id), expectedState: ar.status, expectedVersion: ar.aggregateVersion }));
  }

  @Post('union-recognitions/:id/commands/expire')
  async expireRecognition(@Param('id') id: string, @Req() req: Request) {
    const ar = await this.unionRecognitionRepo.findById(new Uuid(id));
    if (!ar) throw new BadRequestException('Union recognition not found');
    return this.commandBus.execute(this.buildCommand('ExpireUnionRecognition', 'UnionRecognition', { unionRecognitionId: new Uuid(id) }, req, { aggregateId: new Uuid(id), expectedState: ar.status, expectedVersion: ar.aggregateVersion }));
  }

  @Post('union-recognitions/:id/commands/renew')
  async renewRecognition(@Param('id') id: string, @Req() req: Request) {
    const ar = await this.unionRecognitionRepo.findById(new Uuid(id));
    if (!ar) throw new BadRequestException('Union recognition not found');
    return this.commandBus.execute(this.buildCommand('RenewUnionRecognition', 'UnionRecognition', { unionRecognitionId: new Uuid(id) }, req, { aggregateId: new Uuid(id), expectedState: ar.status, expectedVersion: ar.aggregateVersion }));
  }

  @Get('union-recognitions/:id')
  async getRecognition(@Param('id') id: string) {
    return this.unionRecognitionRepo.findById(new Uuid(id));
  }

  @Get('union-recognitions/tenant/:tenantId')
  async getRecognitionsByTenant(@Param('tenantId') tenantId: string, @Req() req: Request) {
    return this.unionRecognitionRepo.findByTenant(this.requireMatchingTenant(req, tenantId));
  }

  @Post('grievances')
  async createGrievance(@Body(new ZodValidationPipe(CreateGrievanceDto)) dto: dtos.CreateGrievanceDto, @Req() req: Request) {
    return this.commandBus.execute(this.buildCommand('CreateGrievance', 'Grievance', dto, req));
  }

  @Post('grievances/:id/commands/acknowledge')
  async acknowledgeGrievance(@Param('id') id: string, @Req() req: Request) {
    const ar = await this.grievanceRepo.findById(new Uuid(id));
    if (!ar) throw new BadRequestException('Grievance not found');
    return this.commandBus.execute(this.buildCommand('AcknowledgeGrievance', 'Grievance', { grievanceId: new Uuid(id) }, req, { aggregateId: new Uuid(id), expectedState: ar.status, expectedVersion: ar.aggregateVersion }));
  }

  @Post('grievances/:id/commands/start-investigation')
  async startInvestigationGrievance(@Param('id') id: string, @Req() req: Request) {
    const ar = await this.grievanceRepo.findById(new Uuid(id));
    if (!ar) throw new BadRequestException('Grievance not found');
    return this.commandBus.execute(this.buildCommand('StartInvestigationGrievance', 'Grievance', { grievanceId: new Uuid(id) }, req, { aggregateId: new Uuid(id), expectedState: ar.status, expectedVersion: ar.aggregateVersion }));
  }

  @Post('grievances/:id/commands/resolve')
  async resolveGrievance(@Param('id') id: string, @Req() req: Request) {
    const ar = await this.grievanceRepo.findById(new Uuid(id));
    if (!ar) throw new BadRequestException('Grievance not found');
    return this.commandBus.execute(this.buildCommand('ResolveGrievance', 'Grievance', { grievanceId: new Uuid(id) }, req, { aggregateId: new Uuid(id), expectedState: ar.status, expectedVersion: ar.aggregateVersion }));
  }

  @Post('grievances/:id/commands/arbitrate')
  async arbitrateGrievance(@Param('id') id: string, @Req() req: Request) {
    const ar = await this.grievanceRepo.findById(new Uuid(id));
    if (!ar) throw new BadRequestException('Grievance not found');
    return this.commandBus.execute(this.buildCommand('ArbitrateGrievance', 'Grievance', { grievanceId: new Uuid(id) }, req, { aggregateId: new Uuid(id), expectedState: ar.status, expectedVersion: ar.aggregateVersion }));
  }

  @Post('grievances/:id/commands/withdraw')
  async withdrawGrievance(@Param('id') id: string, @Req() req: Request) {
    const ar = await this.grievanceRepo.findById(new Uuid(id));
    if (!ar) throw new BadRequestException('Grievance not found');
    return this.commandBus.execute(this.buildCommand('WithdrawGrievance', 'Grievance', { grievanceId: new Uuid(id) }, req, { aggregateId: new Uuid(id), expectedState: ar.status, expectedVersion: ar.aggregateVersion }));
  }

  @Get('grievances/:id')
  async getGrievance(@Param('id') id: string) {
    return this.grievanceRepo.findById(new Uuid(id));
  }

  @Get('grievances/tenant/:tenantId')
  async getGrievancesByTenant(@Param('tenantId') tenantId: string, @Req() req: Request) {
    return this.grievanceRepo.findByTenant(this.requireMatchingTenant(req, tenantId));
  }

  @Post('collective-bargaining-sessions')
  async createSession(@Body(new ZodValidationPipe(CreateCollectiveBargainingSessionDto)) dto: dtos.CreateCollectiveBargainingSessionDto, @Req() req: Request) {
    return this.commandBus.execute(this.buildCommand('CreateCollectiveBargainingSession', 'CollectiveBargainingSession', dto, req));
  }

  @Post('collective-bargaining-sessions/:id/commands/start')
  async startSession(@Param('id') id: string, @Req() req: Request) {
    const ar = await this.cbsRepo.findById(new Uuid(id));
    if (!ar) throw new BadRequestException('Collective bargaining session not found');
    return this.commandBus.execute(this.buildCommand('StartCollectiveBargainingSession', 'CollectiveBargainingSession', { collectiveBargainingSessionId: new Uuid(id) }, req, { aggregateId: new Uuid(id), expectedState: ar.status, expectedVersion: ar.aggregateVersion }));
  }

  @Post('collective-bargaining-sessions/:id/commands/record-tentative-agreement')
  async recordTentativeAgreementSession(@Param('id') id: string, @Req() req: Request) {
    const ar = await this.cbsRepo.findById(new Uuid(id));
    if (!ar) throw new BadRequestException('Collective bargaining session not found');
    return this.commandBus.execute(this.buildCommand('RecordTentativeAgreementCollectiveBargainingSession', 'CollectiveBargainingSession', { collectiveBargainingSessionId: new Uuid(id) }, req, { aggregateId: new Uuid(id), expectedState: ar.status, expectedVersion: ar.aggregateVersion }));
  }

  @Post('collective-bargaining-sessions/:id/commands/ratify')
  async ratifySession(@Param('id') id: string, @Req() req: Request) {
    const ar = await this.cbsRepo.findById(new Uuid(id));
    if (!ar) throw new BadRequestException('Collective bargaining session not found');
    return this.commandBus.execute(this.buildCommand('RatifyCollectiveBargainingSession', 'CollectiveBargainingSession', { collectiveBargainingSessionId: new Uuid(id) }, req, { aggregateId: new Uuid(id), expectedState: ar.status, expectedVersion: ar.aggregateVersion }));
  }

  @Post('collective-bargaining-sessions/:id/commands/mark-failed')
  async markFailedSession(@Param('id') id: string, @Req() req: Request) {
    const ar = await this.cbsRepo.findById(new Uuid(id));
    if (!ar) throw new BadRequestException('Collective bargaining session not found');
    return this.commandBus.execute(this.buildCommand('MarkFailedCollectiveBargainingSession', 'CollectiveBargainingSession', { collectiveBargainingSessionId: new Uuid(id) }, req, { aggregateId: new Uuid(id), expectedState: ar.status, expectedVersion: ar.aggregateVersion }));
  }

  @Post('collective-bargaining-sessions/:id/commands/close')
  async closeSession(@Param('id') id: string, @Req() req: Request) {
    const ar = await this.cbsRepo.findById(new Uuid(id));
    if (!ar) throw new BadRequestException('Collective bargaining session not found');
    return this.commandBus.execute(this.buildCommand('CloseCollectiveBargainingSession', 'CollectiveBargainingSession', { collectiveBargainingSessionId: new Uuid(id) }, req, { aggregateId: new Uuid(id), expectedState: ar.status, expectedVersion: ar.aggregateVersion }));
  }

  @Get('collective-bargaining-sessions/:id')
  async getSession(@Param('id') id: string) {
    return this.cbsRepo.findById(new Uuid(id));
  }

  @Get('collective-bargaining-sessions/tenant/:tenantId')
  async getSessionsByTenant(@Param('tenantId') tenantId: string, @Req() req: Request) {
    return this.cbsRepo.findByTenant(this.requireMatchingTenant(req, tenantId));
  }
}
