import { Controller, Get, Post, Body, Param, Query, Req, BadRequestException, ForbiddenException, NotFoundException, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { randomUUID } from 'crypto';
import { CommandBus } from '../../../platform/command-bus/command-bus.js';
import { Uuid } from '@hcm/shared-kernel';
import { computeRequestHash } from '@hcm/platform-core';
import type { CommandOutcome, CommandResult, HrCommandEnvelope } from '@hcm/command-contracts';
import { AuthGuard } from '../../../guards/auth.guard.js';
import type { WorkerProfile } from '../../hr-core/aggregates/worker-profile.aggregate.js';
import { WorkerRepository } from '../../hr-core/repositories/worker.repository.js';
import type { HrServiceCase } from '../aggregates/hr-service-case.aggregate.js';
import type { HrServiceCatalogItem } from '../aggregates/hr-service-catalog-item.aggregate.js';
import { HrServiceCaseRepository } from '../repositories/hr-service-case.repository.js';
import { HrCaseTaskRepository } from '../repositories/hr-case-task.repository.js';
import { HrKnowledgeArticleRepository } from '../repositories/hr-knowledge-article.repository.js';
import { HrServiceCatalogItemRepository } from '../repositories/hr-service-catalog-item.repository.js';
import { HrCaseSlaInstanceRepository } from '../repositories/hr-case-sla-instance.repository.js';
import type * as dtos from './dtos.js';
import {
  OpenHrServiceCaseDtoSchema, CreateHrCaseTaskDtoSchema,
  CreateHrKnowledgeArticleDtoSchema, CreateHrServiceCatalogItemDtoSchema,
  CreateHrCaseSlaInstanceDtoSchema, ZodValidationPipe,
} from './dtos.js';

@ApiTags('HR Service Delivery')
@UseGuards(AuthGuard)
@Controller('hr-service-delivery')
export class HrServiceDeliveryController {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly workerRepo: WorkerRepository,
    private readonly hrServiceCaseRepo: HrServiceCaseRepository,
    private readonly hrCaseTaskRepo: HrCaseTaskRepository,
    private readonly hrKnowledgeArticleRepo: HrKnowledgeArticleRepository,
    private readonly hrServiceCatalogItemRepo: HrServiceCatalogItemRepository,
    private readonly hrCaseSlaInstanceRepo: HrCaseSlaInstanceRepository,
  ) {}

  private buildCommand<TPayload>(
    commandName: string,
    aggregateType: string,
    payload: TPayload,
    req: Request,
    options?: { aggregateId?: Uuid; expectedState?: string; expectedVersion?: number; subjectWorkerId?: Uuid },
  ): HrCommandEnvelope<TPayload> {
    const tenantId = new Uuid((req['tenantId'] as string | undefined) ?? '00000000-0000-0000-0000-000000000001');
    if (!req.actor) throw new ForbiddenException('Authenticated actor is required');
    return {
      commandId: Uuid.generate(),
      commandName,
      commandSchemaVersion: 1,
      tenantId,
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
      metadata: { requestHash: computeRequestHash(payload), clientType: this.hasServiceAdminScope(req) ? 'HR_ADMIN' : 'EMPLOYEE_PORTAL' },
    };
  }

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

  private hasServiceAdminScope(req: Request): boolean {
    return this.hasAnyRole(req, ['HR_ADMIN', 'HRBP', 'ER_SPECIALIST', 'SUPER_ADMIN']);
  }

  private async resolveSelfWorker(req: Request): Promise<WorkerProfile> {
    const tenantId = this.getTenantId(req);
    const actorId = this.getActorId(req);
    try {
      const worker = await this.workerRepo.findByIdForTenant(new Uuid(actorId), tenantId);
      if (worker) return worker;
    } catch {
      // Identity subjects may not always be worker IDs.
    }

    const email = this.getActorEmail(req);
    if (email) {
      const worker = await this.workerRepo.findByEmailForTenant(email, tenantId);
      if (worker) return worker;
    }

    throw new ForbiddenException('No employee profile is linked to the authenticated user');
  }

  private async resolveRequesterWorkerId(dto: dtos.OpenHrServiceCaseDto, req: Request): Promise<Uuid> {
    if (dto.requesterWorkerId) {
      const requesterWorkerId = new Uuid(dto.requesterWorkerId);
      if (this.hasServiceAdminScope(req)) return requesterWorkerId;
      const self = await this.resolveSelfWorker(req);
      if (self.id.value !== requesterWorkerId.value) {
        throw new ForbiddenException('Employee service requests can only be opened for the authenticated employee');
      }
      return requesterWorkerId;
    }
    return (await this.resolveSelfWorker(req)).id;
  }

  private generateCaseNumber(): string {
    const now = new Date();
    const day = now.toISOString().slice(0, 10).replace(/-/g, '');
    return `HR-${day}-${randomUUID().slice(0, 8).toUpperCase()}`;
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

  private serializeDate(value?: Date): string | undefined {
    return value ? value.toISOString() : undefined;
  }

  private serializeHrServiceCase(serviceCase: HrServiceCase) {
    return {
      id: serviceCase.id.value,
      caseNumber: serviceCase.caseNumber,
      requesterWorkerId: serviceCase.requesterWorkerId.value,
      caseType: serviceCase.caseType,
      priority: serviceCase.priority,
      description: serviceCase.description,
      assignedTo: serviceCase.assignedTo?.value,
      slaDeadline: this.serializeDate(serviceCase.slaDeadline),
      resolvedAt: this.serializeDate(serviceCase.resolvedAt),
      status: serviceCase.status,
      createdAt: this.serializeDate(serviceCase.createdAt),
      updatedAt: this.serializeDate(serviceCase.updatedAt),
    };
  }

  private serializeHrServiceCatalogItem(item: HrServiceCatalogItem) {
    return {
      id: item.id.value,
      serviceCode: item.serviceCode,
      serviceName: item.serviceName,
      description: item.description,
      category: item.category,
      slaHours: item.slaHours,
      fulfillmentProcess: item.fulfillmentProcess,
      status: item.status,
      createdAt: this.serializeDate(item.createdAt),
      updatedAt: this.serializeDate(item.updatedAt),
    };
  }

  /* HR Service Cases */
  @Post('cases')
  async openHrServiceCase(@Body(new ZodValidationPipe(OpenHrServiceCaseDtoSchema)) dto: dtos.OpenHrServiceCaseDto, @Req() req: Request) {
    const requesterWorkerId = await this.resolveRequesterWorkerId(dto, req);
    const payload = {
      ...dto,
      caseNumber: dto.caseNumber ?? this.generateCaseNumber(),
      requesterWorkerId: requesterWorkerId.value,
    };
    const outcome = await this.commandBus.execute(this.buildCommand('OpenHrServiceCase', 'HrServiceCase', payload, req, { subjectWorkerId: requesterWorkerId }));
    return this.assertCommandSucceeded(outcome);
  }

  @Get('cases')
  async listHrServiceCases(@Req() req: Request, @Query('requesterWorkerId') requesterWorkerId?: string) {
    const tenantId = this.getTenantId(req);
    if (this.hasServiceAdminScope(req)) {
      if (requesterWorkerId) {
        return (await this.hrServiceCaseRepo.findByRequester(tenantId, new Uuid(requesterWorkerId))).map((serviceCase) => this.serializeHrServiceCase(serviceCase));
      }
      return (await this.hrServiceCaseRepo.findByTenant(tenantId)).map((serviceCase) => this.serializeHrServiceCase(serviceCase));
    }
    const self = await this.resolveSelfWorker(req);
    return (await this.hrServiceCaseRepo.findByRequester(tenantId, self.id)).map((serviceCase) => this.serializeHrServiceCase(serviceCase));
  }

  @Get('cases/my')
  async listMyHrServiceCases(@Req() req: Request) {
    const self = await this.resolveSelfWorker(req);
    return (await this.hrServiceCaseRepo.findByRequester(this.getTenantId(req), self.id)).map((serviceCase) => this.serializeHrServiceCase(serviceCase));
  }

  @Post('cases/:id/commands/mark-in-progress')
  async markInProgressHrServiceCase(@Param('id') id: string, @Req() req: Request) {
    const ar = await this.hrServiceCaseRepo.findById(new Uuid(id));
    if (!ar) throw new BadRequestException('HR service case not found');
    return this.commandBus.execute(this.buildCommand('MarkInProgressHrServiceCase', 'HrServiceCase', { hrServiceCaseId: new Uuid(id) }, req, { aggregateId: new Uuid(id), expectedState: ar.status, expectedVersion: ar.aggregateVersion }));
  }

  @Post('cases/:id/commands/mark-pending-customer')
  async markPendingCustomerHrServiceCase(@Param('id') id: string, @Req() req: Request) {
    const ar = await this.hrServiceCaseRepo.findById(new Uuid(id));
    if (!ar) throw new BadRequestException('HR service case not found');
    return this.commandBus.execute(this.buildCommand('MarkPendingCustomerHrServiceCase', 'HrServiceCase', { hrServiceCaseId: new Uuid(id) }, req, { aggregateId: new Uuid(id), expectedState: ar.status, expectedVersion: ar.aggregateVersion }));
  }

  @Post('cases/:id/commands/resolve')
  async resolveHrServiceCase(@Param('id') id: string, @Req() req: Request) {
    const ar = await this.hrServiceCaseRepo.findById(new Uuid(id));
    if (!ar) throw new BadRequestException('HR service case not found');
    return this.commandBus.execute(this.buildCommand('ResolveHrServiceCase', 'HrServiceCase', { hrServiceCaseId: new Uuid(id) }, req, { aggregateId: new Uuid(id), expectedState: ar.status, expectedVersion: ar.aggregateVersion }));
  }

  @Post('cases/:id/commands/close')
  async closeHrServiceCase(@Param('id') id: string, @Req() req: Request) {
    const ar = await this.hrServiceCaseRepo.findById(new Uuid(id));
    if (!ar) throw new BadRequestException('HR service case not found');
    return this.commandBus.execute(this.buildCommand('CloseHrServiceCase', 'HrServiceCase', { hrServiceCaseId: new Uuid(id) }, req, { aggregateId: new Uuid(id), expectedState: ar.status, expectedVersion: ar.aggregateVersion }));
  }

  @Get('cases/:id')
  async getHrServiceCase(@Param('id') id: string, @Req() req: Request) {
    const serviceCase = await this.hrServiceCaseRepo.findById(new Uuid(id));
    if (!serviceCase) throw new NotFoundException('HR service case not found');
    if (!this.hasServiceAdminScope(req)) {
      const self = await this.resolveSelfWorker(req);
      if (serviceCase.requesterWorkerId.value !== self.id.value) {
        throw new ForbiddenException('Employee service requests can only be viewed by the requester or HR');
      }
    }
    return this.serializeHrServiceCase(serviceCase);
  }

  /* HR Case Tasks */
  @Post('tasks')
  async createHrCaseTask(@Body(new ZodValidationPipe(CreateHrCaseTaskDtoSchema)) dto: dtos.CreateHrCaseTaskDto, @Req() req: Request) {
    return this.commandBus.execute(this.buildCommand('CreateHrCaseTask', 'HrCaseTask', dto, req));
  }

  @Post('tasks/:id/commands/start')
  async startHrCaseTask(@Param('id') id: string, @Req() req: Request) {
    const ar = await this.hrCaseTaskRepo.findById(new Uuid(id));
    if (!ar) throw new BadRequestException('HR case task not found');
    return this.commandBus.execute(this.buildCommand('StartHrCaseTask', 'HrCaseTask', { hrCaseTaskId: new Uuid(id) }, req, { aggregateId: new Uuid(id), expectedState: ar.status, expectedVersion: ar.aggregateVersion }));
  }

  @Post('tasks/:id/commands/complete')
  async completeHrCaseTask(@Param('id') id: string, @Req() req: Request) {
    const ar = await this.hrCaseTaskRepo.findById(new Uuid(id));
    if (!ar) throw new BadRequestException('HR case task not found');
    return this.commandBus.execute(this.buildCommand('CompleteHrCaseTask', 'HrCaseTask', { hrCaseTaskId: new Uuid(id) }, req, { aggregateId: new Uuid(id), expectedState: ar.status, expectedVersion: ar.aggregateVersion }));
  }

  @Post('tasks/:id/commands/mark-overdue')
  async markOverdueHrCaseTask(@Param('id') id: string, @Req() req: Request) {
    const ar = await this.hrCaseTaskRepo.findById(new Uuid(id));
    if (!ar) throw new BadRequestException('HR case task not found');
    return this.commandBus.execute(this.buildCommand('MarkOverdueHrCaseTask', 'HrCaseTask', { hrCaseTaskId: new Uuid(id) }, req, { aggregateId: new Uuid(id), expectedState: ar.status, expectedVersion: ar.aggregateVersion }));
  }

  @Post('tasks/:id/commands/cancel')
  async cancelHrCaseTask(@Param('id') id: string, @Req() req: Request) {
    const ar = await this.hrCaseTaskRepo.findById(new Uuid(id));
    if (!ar) throw new BadRequestException('HR case task not found');
    return this.commandBus.execute(this.buildCommand('CancelHrCaseTask', 'HrCaseTask', { hrCaseTaskId: new Uuid(id) }, req, { aggregateId: new Uuid(id), expectedState: ar.status, expectedVersion: ar.aggregateVersion }));
  }

  @Get('tasks/:id')
  async getHrCaseTask(@Param('id') id: string) {
    return this.hrCaseTaskRepo.findById(new Uuid(id));
  }

  /* HR Knowledge Articles */
  @Post('knowledge-articles')
  async createHrKnowledgeArticle(@Body(new ZodValidationPipe(CreateHrKnowledgeArticleDtoSchema)) dto: dtos.CreateHrKnowledgeArticleDto, @Req() req: Request) {
    return this.commandBus.execute(this.buildCommand('CreateHrKnowledgeArticle', 'HrKnowledgeArticle', dto, req));
  }

  @Post('knowledge-articles/:id/commands/publish')
  async publishHrKnowledgeArticle(@Param('id') id: string, @Req() req: Request) {
    const ar = await this.hrKnowledgeArticleRepo.findById(new Uuid(id));
    if (!ar) throw new BadRequestException('HR knowledge article not found');
    return this.commandBus.execute(this.buildCommand('PublishHrKnowledgeArticle', 'HrKnowledgeArticle', { hrKnowledgeArticleId: new Uuid(id) }, req, { aggregateId: new Uuid(id), expectedState: ar.status, expectedVersion: ar.aggregateVersion }));
  }

  @Post('knowledge-articles/:id/commands/archive')
  async archiveHrKnowledgeArticle(@Param('id') id: string, @Req() req: Request) {
    const ar = await this.hrKnowledgeArticleRepo.findById(new Uuid(id));
    if (!ar) throw new BadRequestException('HR knowledge article not found');
    return this.commandBus.execute(this.buildCommand('ArchiveHrKnowledgeArticle', 'HrKnowledgeArticle', { hrKnowledgeArticleId: new Uuid(id) }, req, { aggregateId: new Uuid(id), expectedState: ar.status, expectedVersion: ar.aggregateVersion }));
  }

  @Get('knowledge-articles/:id')
  async getHrKnowledgeArticle(@Param('id') id: string) {
    return this.hrKnowledgeArticleRepo.findById(new Uuid(id));
  }

  /* HR Service Catalog Items */
  @Get('catalog-items')
  async listHrServiceCatalogItems(@Req() req: Request) {
    const tenantId = this.getTenantId(req);
    const items = this.hasServiceAdminScope(req)
      ? this.hrServiceCatalogItemRepo.findByTenant(tenantId)
      : this.hrServiceCatalogItemRepo.findActive(tenantId);
    return (await items).map((item) => this.serializeHrServiceCatalogItem(item));
  }

  @Post('catalog-items')
  async createHrServiceCatalogItem(@Body(new ZodValidationPipe(CreateHrServiceCatalogItemDtoSchema)) dto: dtos.CreateHrServiceCatalogItemDto, @Req() req: Request) {
    const outcome = await this.commandBus.execute(this.buildCommand('CreateHrServiceCatalogItem', 'HrServiceCatalogItem', dto, req));
    return this.assertCommandSucceeded(outcome);
  }

  @Post('catalog-items/:id/commands/activate')
  async activateHrServiceCatalogItem(@Param('id') id: string, @Req() req: Request) {
    const ar = await this.hrServiceCatalogItemRepo.findById(new Uuid(id));
    if (!ar) throw new BadRequestException('HR service catalog item not found');
    return this.commandBus.execute(this.buildCommand('ActivateHrServiceCatalogItem', 'HrServiceCatalogItem', { hrServiceCatalogItemId: new Uuid(id) }, req, { aggregateId: new Uuid(id), expectedState: ar.status, expectedVersion: ar.aggregateVersion }));
  }

  @Post('catalog-items/:id/commands/suspend')
  async suspendHrServiceCatalogItem(@Param('id') id: string, @Req() req: Request) {
    const ar = await this.hrServiceCatalogItemRepo.findById(new Uuid(id));
    if (!ar) throw new BadRequestException('HR service catalog item not found');
    return this.commandBus.execute(this.buildCommand('SuspendHrServiceCatalogItem', 'HrServiceCatalogItem', { hrServiceCatalogItemId: new Uuid(id) }, req, { aggregateId: new Uuid(id), expectedState: ar.status, expectedVersion: ar.aggregateVersion }));
  }

  @Post('catalog-items/:id/commands/retire')
  async retireHrServiceCatalogItem(@Param('id') id: string, @Req() req: Request) {
    const ar = await this.hrServiceCatalogItemRepo.findById(new Uuid(id));
    if (!ar) throw new BadRequestException('HR service catalog item not found');
    return this.commandBus.execute(this.buildCommand('RetireHrServiceCatalogItem', 'HrServiceCatalogItem', { hrServiceCatalogItemId: new Uuid(id) }, req, { aggregateId: new Uuid(id), expectedState: ar.status, expectedVersion: ar.aggregateVersion }));
  }

  @Get('catalog-items/:id')
  async getHrServiceCatalogItem(@Param('id') id: string) {
    const item = await this.hrServiceCatalogItemRepo.findById(new Uuid(id));
    if (!item) throw new NotFoundException('HR service catalog item not found');
    return this.serializeHrServiceCatalogItem(item);
  }

  /* HR Case SLA Instances */
  @Post('sla-instances')
  async createHrCaseSlaInstance(@Body(new ZodValidationPipe(CreateHrCaseSlaInstanceDtoSchema)) dto: dtos.CreateHrCaseSlaInstanceDto, @Req() req: Request) {
    return this.commandBus.execute(this.buildCommand('CreateHrCaseSlaInstance', 'HrCaseSlaInstance', dto, req));
  }

  @Post('sla-instances/:id/commands/breach')
  async breachHrCaseSlaInstance(@Param('id') id: string, @Req() req: Request) {
    const ar = await this.hrCaseSlaInstanceRepo.findById(new Uuid(id));
    if (!ar) throw new BadRequestException('HR case SLA instance not found');
    return this.commandBus.execute(this.buildCommand('BreachHrCaseSlaInstance', 'HrCaseSlaInstance', { hrCaseSlaInstanceId: new Uuid(id) }, req, { aggregateId: new Uuid(id), expectedState: ar.status, expectedVersion: ar.aggregateVersion }));
  }

  @Post('sla-instances/:id/commands/meet')
  async meetHrCaseSlaInstance(@Param('id') id: string, @Req() req: Request) {
    const ar = await this.hrCaseSlaInstanceRepo.findById(new Uuid(id));
    if (!ar) throw new BadRequestException('HR case SLA instance not found');
    return this.commandBus.execute(this.buildCommand('MeetHrCaseSlaInstance', 'HrCaseSlaInstance', { hrCaseSlaInstanceId: new Uuid(id) }, req, { aggregateId: new Uuid(id), expectedState: ar.status, expectedVersion: ar.aggregateVersion }));
  }

  @Post('sla-instances/:id/commands/exempt')
  async exemptHrCaseSlaInstance(@Param('id') id: string, @Body() body: { exemptReason: string }, @Req() req: Request) {
    const ar = await this.hrCaseSlaInstanceRepo.findById(new Uuid(id));
    if (!ar) throw new BadRequestException('HR case SLA instance not found');
    return this.commandBus.execute(this.buildCommand('ExemptHrCaseSlaInstance', 'HrCaseSlaInstance', { hrCaseSlaInstanceId: new Uuid(id), exemptReason: body.exemptReason }, req, { aggregateId: new Uuid(id), expectedState: ar.status, expectedVersion: ar.aggregateVersion }));
  }

  @Get('sla-instances/:id')
  async getHrCaseSlaInstance(@Param('id') id: string) {
    return this.hrCaseSlaInstanceRepo.findById(new Uuid(id));
  }
}
