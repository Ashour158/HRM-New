import { Controller, Get, Post, Body, Param, Req, BadRequestException } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { randomUUID } from 'crypto';
import { CommandBus } from '../../../platform/command-bus/command-bus.js';
import { Uuid } from '@hcm/shared-kernel';
import { computeRequestHash } from '@hcm/platform-core';
import type { HrCommandEnvelope } from '@hcm/command-contracts';
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
@Controller('hr-service-delivery')
export class HrServiceDeliveryController {
  constructor(
    private readonly commandBus: CommandBus,
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
    return {
      commandId: Uuid.generate(),
      commandName,
      commandSchemaVersion: 1,
      tenantId,
      actor: { actorType: 'SYSTEM', actorId: Uuid.generate(), roles: ['HR_ADMIN'], permissions: ['HR_SERVICE_DELIVERY_WRITE'], mfaAuthenticated: true },
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

  /* HR Service Cases */
  @Post('cases')
  async openHrServiceCase(@Body(new ZodValidationPipe(OpenHrServiceCaseDtoSchema)) dto: dtos.OpenHrServiceCaseDto, @Req() req: Request) {
    return this.commandBus.execute(this.buildCommand('OpenHrServiceCase', 'HrServiceCase', dto, req));
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
  async getHrServiceCase(@Param('id') id: string) {
    return this.hrServiceCaseRepo.findById(new Uuid(id));
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
  @Post('catalog-items')
  async createHrServiceCatalogItem(@Body(new ZodValidationPipe(CreateHrServiceCatalogItemDtoSchema)) dto: dtos.CreateHrServiceCatalogItemDto, @Req() req: Request) {
    return this.commandBus.execute(this.buildCommand('CreateHrServiceCatalogItem', 'HrServiceCatalogItem', dto, req));
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
    return this.hrServiceCatalogItemRepo.findById(new Uuid(id));
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
