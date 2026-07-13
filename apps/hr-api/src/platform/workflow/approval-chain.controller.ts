import { BadRequestException, Body, Controller, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { Uuid } from '@hcm/shared-kernel';
import { computeRequestHash } from '@hcm/platform-core';
import type { HrCommandEnvelope } from '@hcm/command-contracts';
import { AuthGuard } from '../../guards/auth.guard.js';
import { PermissionGuard } from '../../guards/permission.guard.js';
import { Permissions } from '../../decorators/permissions.decorator.js';
import { actorClientType, requireActor, requireTenantId } from '../http/request-context.js';
import { CommandBus } from '../command-bus/command-bus.js';
import { HcmSetupService } from '../../domains/hcm-setup/hcm-setup.service.js';
import { APPROVAL_CONDITION_OPERATORS, type ApprovalWorkflowRule } from '../../domains/hcm-setup/hcm-setup.types.js';
import { ApprovalWorkflowService } from './approval-workflow.service.js';
import { ApprovalChain } from './approval-chain.aggregate.js';

interface ApprovalConfigBody {
  rules?: ApprovalWorkflowRule[];
}

@ApiTags('Platform Workflow')
@UseGuards(AuthGuard, PermissionGuard)
@Controller('platform/workflow')
export class ApprovalChainController {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly hcmSetup: HcmSetupService,
    private readonly workflow: ApprovalWorkflowService,
  ) {}

  @Get('approval-config')
  @Permissions('WORKFLOW_MANAGE')
  async getApprovalConfig(@Req() req: Request) {
    const tenantId = requireTenantId(req, 'Approval workflow');
    const setup = await this.hcmSetup.getSetup(tenantId);
    return {
      tenantId: tenantId.value,
      rules: setup.approvalWorkflowRules ?? [],
    };
  }

  @Post('approval-config')
  @Permissions('WORKFLOW_MANAGE')
  async saveApprovalConfig(@Body() body: ApprovalConfigBody, @Req() req: Request) {
    const tenantId = requireTenantId(req, 'Approval workflow');
    const rules = this.normalizeRules(body.rules ?? []);
    const setup = await this.hcmSetup.updateSetup(tenantId, { approvalWorkflowRules: rules });
    return {
      tenantId: tenantId.value,
      rules: setup.approvalWorkflowRules ?? [],
    };
  }

  @Get('approval-chains/pending')
  @Permissions('WORKFLOW_APPROVE')
  async pendingApprovals(@Req() req: Request) {
    const tenantId = requireTenantId(req, 'Approval workflow');
    const actor = requireActor(req, 'Approval workflow');
    const chains = await this.workflow.findPendingForActor(tenantId, actor.roles, actor.actorId);
    return { tenantId: tenantId.value, chains: chains.map(serializeChain) };
  }

  @Get('approval-chains/:id')
  @Permissions('WORKFLOW_APPROVE')
  async getChain(@Param('id') id: string) {
    return serializeChain(await this.workflow.getChain(new Uuid(id)));
  }

  @Post('approval-chains/:id/steps/:stepId/commands/approve')
  @Permissions('WORKFLOW_APPROVE')
  async approveStep(@Param('id') id: string, @Param('stepId') stepId: string, @Body() body: { reason?: string } = {}, @Req() req: Request) {
    return this.commandBus.execute(this.buildCommand('ApproveApprovalStep', { approvalChainId: new Uuid(id), stepId: new Uuid(stepId), reason: body.reason }, req, new Uuid(id)));
  }

  @Post('approval-chains/:id/steps/:stepId/commands/reject')
  @Permissions('WORKFLOW_APPROVE')
  async rejectStep(@Param('id') id: string, @Param('stepId') stepId: string, @Body() body: { reason?: string } = {}, @Req() req: Request) {
    return this.commandBus.execute(this.buildCommand('RejectApprovalStep', { approvalChainId: new Uuid(id), stepId: new Uuid(stepId), reason: body.reason }, req, new Uuid(id)));
  }

  @Post('approval-chains/:id/steps/:stepId/commands/delegate')
  @Permissions('WORKFLOW_APPROVE')
  async delegateStep(
    @Param('id') id: string,
    @Param('stepId') stepId: string,
    @Body() body: { delegateToWorkerId?: string; reason?: string } = {},
    @Req() req: Request,
  ) {
    if (!body.delegateToWorkerId) throw new BadRequestException('delegateToWorkerId is required');
    return this.commandBus.execute(this.buildCommand('DelegateApprovalStep', {
      approvalChainId: new Uuid(id),
      stepId: new Uuid(stepId),
      delegateToWorkerId: new Uuid(body.delegateToWorkerId),
      reason: body.reason,
    }, req, new Uuid(id)));
  }

  @Post('approval-chains/:id/commands/escalate-overdue')
  @Permissions('WORKFLOW_APPROVE')
  async escalateOverdue(@Param('id') id: string, @Body() body: { now?: string } = {}, @Req() req: Request) {
    return this.commandBus.execute(this.buildCommand('EscalateApprovalChainOverdue', {
      approvalChainId: new Uuid(id),
      now: body.now,
    }, req, new Uuid(id)));
  }

  private buildCommand<TPayload extends Record<string, unknown>>(
    commandName: string,
    payload: TPayload,
    req: Request,
    aggregateId: Uuid,
  ): HrCommandEnvelope<TPayload> {
    const tenantId = requireTenantId(req, 'Approval workflow');
    const actor = requireActor(req, 'Approval workflow');
    return {
      commandId: Uuid.generate(),
      commandName,
      commandSchemaVersion: 1,
      tenantId,
      actor,
      aggregateType: 'ApprovalChain',
      aggregateId,
      idempotencyKey: crypto.randomUUID(),
      correlationId: Uuid.generate(),
      reason: 'Approval workflow command',
      payload,
      metadata: {
        requestHash: computeRequestHash(payload),
        clientType: actorClientType(actor),
        hrDataSensitivity: 'HIGH',
      },
    };
  }

  private normalizeRules(rules: ApprovalWorkflowRule[]): ApprovalWorkflowRule[] {
    return rules.map((rule) => {
      if (!rule.code || !rule.label || !rule.commandName || !Array.isArray(rule.steps) || rule.steps.length === 0) {
        throw new BadRequestException('Approval workflow rules require code, label, commandName, and at least one step');
      }
      const conditions = this.normalizeConditions(rule.conditions);
      return {
        ...rule,
        active: rule.active !== false,
        conditions,
        conditionLogic: this.normalizeConditionLogic(rule.conditionLogic, conditions.length),
        steps: rule.steps
          .slice()
          .sort((left, right) => left.order - right.order)
          .map((step) => ({
            ...step,
            active: step.active !== false,
            mode: step.mode ?? 'SEQUENTIAL',
            approverType: step.approverType ?? 'ROLE',
          })),
      };
    });
  }

  private normalizeConditionLogic(
    conditionLogic: ApprovalWorkflowRule['conditionLogic'],
    conditionCount: number,
  ): ApprovalWorkflowRule['conditionLogic'] {
    if (conditionCount === 0) return undefined;
    if (conditionLogic === undefined) return 'ALL';
    if (conditionLogic !== 'ALL' && conditionLogic !== 'ANY') {
      throw new BadRequestException(`Approval routing conditionLogic "${conditionLogic}" is not supported`);
    }
    return conditionLogic;
  }

  private normalizeConditions(conditions: ApprovalWorkflowRule['conditions']): NonNullable<ApprovalWorkflowRule['conditions']> {
    if (!Array.isArray(conditions) || conditions.length === 0) return [];
    return conditions.map((condition) => {
      if (!condition.field || typeof condition.field !== 'string' || !condition.field.trim()) {
        throw new BadRequestException('Approval routing conditions require a field path');
      }
      if (!APPROVAL_CONDITION_OPERATORS.includes(condition.operator)) {
        throw new BadRequestException(`Approval routing condition operator "${condition.operator}" is not supported`);
      }
      if (condition.value === undefined) {
        throw new BadRequestException('Approval routing conditions require a comparison value');
      }
      return { field: condition.field.trim(), operator: condition.operator, value: condition.value };
    });
  }
}

function serializeChain(chain: ApprovalChain) {
  return {
    id: chain.id.value,
    tenantId: chain.tenantId.value,
    commandName: chain.commandName,
    aggregateType: chain.aggregateType,
    aggregateId: chain.aggregateId?.value ?? null,
    requestedBy: chain.requestedBy.value,
    status: chain.status,
    currentStepOrder: chain.currentStepOrder ?? null,
    createdAt: chain.createdAt.toISOString(),
    updatedAt: chain.updatedAt.toISOString(),
    completedAt: chain.completedAt?.toISOString() ?? null,
    steps: chain.steps.map((step) => ({
      id: step.id.value,
      code: step.code,
      label: step.label,
      order: step.order,
      mode: step.mode,
      approverType: step.approverType,
      approverRole: step.approverRole ?? null,
      approverWorkerId: step.approverWorkerId?.value ?? null,
      delegatedToWorkerId: step.delegatedToWorkerId?.value ?? null,
      state: step.state,
      escalationTierCode: step.escalationTierCode ?? null,
      slaDueAt: step.slaDueAt?.toISOString() ?? null,
      reason: step.reason ?? null,
      actedBy: step.actedBy?.value ?? null,
      actedAt: step.actedAt?.toISOString() ?? null,
    })),
  };
}
