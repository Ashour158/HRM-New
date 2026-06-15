import { BadRequestException, Body, Controller, ForbiddenException, Get, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { createCommand, type CommandOutcome } from '@hcm/command-contracts';
import { Uuid } from '@hcm/shared-kernel';
import { AuthGuard } from '../../guards/auth.guard.js';
import { CommandBus } from '../../platform/command-bus/command-bus.js';
import { actorClientType, requireActor } from '../../platform/http/request-context.js';
import { PolicyCenterService } from './policy-center.service.js';
import {
  POLICY_AREAS,
  type CreatePolicyRevisionInput,
  type PolicyActor,
  type PolicyApplyInput,
  type PolicyArea,
  type PolicyImportDryRunInput,
  type PolicyRollbackInput,
  type UpdatePolicyRevisionInput,
} from './policy-center.types.js';

const POLICY_ADMIN_ROLES = new Set([
  'APP_ADMIN',
  'PLATFORM_ADMIN',
  'SUPER_ADMIN',
  'HR_ADMIN',
  'HRBP',
  'PAYROLL_ADMIN',
  'COMPLIANCE_OFFICER',
]);

function areaFromQuery(area: string | undefined): PolicyArea | undefined {
  if (!area) return undefined;
  const normalized = area.trim().toUpperCase().replace(/-/g, '_');
  return (POLICY_AREAS as readonly string[]).includes(normalized) ? normalized as PolicyArea : undefined;
}

@ApiTags('Policy Center')
@UseGuards(AuthGuard)
@Controller('admin/policies')
export class PolicyCenterController {
  constructor(
    private readonly service: PolicyCenterService,
    private readonly moduleRef: ModuleRef,
  ) {}

  @Get('summary')
  async summary(@Req() req: Request) {
    this.assertPolicyAdmin(req);
    return this.service.getSummary(this.getTenantId(req));
  }

  @Get('revisions')
  async list(@Req() req: Request, @Query('area') area?: string) {
    this.assertPolicyAdmin(req);
    return this.service.listRevisions(this.getTenantId(req), areaFromQuery(area));
  }

  @Get('templates')
  async templates(@Req() req: Request) {
    this.assertPolicyAdmin(req);
    return this.service.getTemplates();
  }

  @Post('import/dry-run')
  async dryRunImport(@Body() body: PolicyImportDryRunInput, @Req() req: Request) {
    this.assertPolicyAdmin(req);
    return this.service.dryRunImport(this.getTenantId(req), body, this.getActor(req));
  }

  @Get('decision-evidence')
  async decisionEvidence(@Req() req: Request, @Query('limit') limit?: string) {
    this.assertPolicyAdmin(req);
    const parsedLimit = Number.parseInt(limit ?? '25', 10);
    return this.service.listDecisionEvidence(this.getTenantId(req), Number.isFinite(parsedLimit) ? parsedLimit : 25);
  }

  @Get('revisions/:id/export')
  async exportRevision(@Param('id') id: string, @Req() req: Request) {
    this.assertPolicyAdmin(req);
    return this.service.exportRevision(this.getTenantId(req), id, this.getActor(req));
  }

  @Get('revisions/:leftId/compare/:rightId')
  async compare(@Param('leftId') leftId: string, @Param('rightId') rightId: string, @Req() req: Request) {
    this.assertPolicyAdmin(req);
    return this.service.compareRevisions(this.getTenantId(req), leftId, rightId);
  }

  @Post('revisions')
  async create(@Body() body: CreatePolicyRevisionInput, @Req() req: Request) {
    this.assertPolicyAdmin(req);
    return this.executePolicyCommand(req, 'CreatePolicyRevision', body, undefined, 'Create policy revision');
  }

  @Patch('revisions/:id')
  async update(@Param('id') id: string, @Body() body: UpdatePolicyRevisionInput, @Req() req: Request) {
    this.assertPolicyAdmin(req);
    return this.executePolicyCommand(req, 'UpdatePolicyRevision', { id, input: body }, id, 'Update policy revision');
  }

  @Post('revisions/:id/validate')
  async validate(@Param('id') id: string, @Req() req: Request) {
    this.assertPolicyAdmin(req);
    return this.executePolicyCommand(req, 'ValidatePolicyRevision', { id }, id, 'Validate policy revision');
  }

  @Post('revisions/:id/simulate')
  async simulate(@Param('id') id: string, @Req() req: Request) {
    this.assertPolicyAdmin(req);
    return this.executePolicyCommand(req, 'SimulatePolicyRevision', { id }, id, 'Simulate policy impact');
  }

  @Post('revisions/:id/commands/submit-review')
  async submitReview(@Param('id') id: string, @Req() req: Request) {
    this.assertPolicyAdmin(req);
    return this.executePolicyCommand(req, 'SubmitPolicyRevisionForReview', { id }, id, 'Submit policy revision for review');
  }

  @Post('revisions/:id/commands/mark-reviewed')
  async markReviewed(@Param('id') id: string, @Req() req: Request) {
    this.assertPolicyAdmin(req);
    return this.executePolicyCommand(req, 'MarkPolicyRevisionReviewed', { id }, id, 'Mark policy revision reviewed');
  }

  @Post('revisions/:id/commands/approve')
  async approve(@Param('id') id: string, @Req() req: Request) {
    this.assertPolicyAdmin(req);
    return this.executePolicyCommand(req, 'ApprovePolicyRevision', { id }, id, 'Approve policy revision');
  }

  @Post('revisions/:id/commands/publish')
  async publish(@Param('id') id: string, @Req() req: Request) {
    this.assertPolicyAdmin(req);
    return this.executePolicyCommand(req, 'PublishPolicyRevision', { id }, id, 'Publish policy revision');
  }

  @Post('revisions/:id/commands/apply')
  async apply(@Param('id') id: string, @Body() body: PolicyApplyInput | undefined, @Req() req: Request) {
    this.assertPolicyAdmin(req);
    return this.executePolicyCommand(req, 'ApplyPolicyRevision', { id, input: body ?? {} }, id, 'Apply policy revision');
  }

  @Post('revisions/:id/commands/create-rollback')
  async createRollback(@Param('id') id: string, @Body() body: PolicyRollbackInput, @Req() req: Request) {
    this.assertPolicyAdmin(req);
    return this.executePolicyCommand(req, 'CreatePolicyRollbackDraft', { id, input: body }, id, 'Create policy rollback draft');
  }

  private async executePolicyCommand<TPayload, TResult>(
    req: Request,
    commandName: string,
    payload: TPayload,
    revisionId: string | undefined,
    reason: string,
  ): Promise<TResult> {
    const tenantId = this.getTenantId(req);
    const actor = requireActor(req, 'Policy Center');
    const aggregateId = revisionId && Uuid.isValid(revisionId) ? new Uuid(revisionId) : undefined;
    const commandBus = this.moduleRef.get(CommandBus, { strict: false });
    const result = await commandBus.execute(createCommand(
      commandName,
      tenantId,
      actor,
      payload,
      {
        aggregateType: 'PolicyRevision',
        aggregateId,
        idempotencyKey: crypto.randomUUID(),
        correlationId: Uuid.generate(),
        reason,
        metadata: {
          clientType: actorClientType(actor),
          hrDataSensitivity: 'HIGH',
        },
      },
    )) as CommandOutcome<TResult>;
    if (!result.success) {
      throw new BadRequestException(result.errorMessage);
    }
    return result.data;
  }

  private getTenantId(req: Request): Uuid {
    if (typeof req.tenantId === 'string' && Uuid.isValid(req.tenantId)) {
      return new Uuid(req.tenantId);
    }
    throw new ForbiddenException('Policy Center requires a validated tenant context.');
  }

  private getActor(req: Request): PolicyActor {
    const actorId = req.actor?.actorId;
    const actorIdValue = actorId instanceof Uuid
      ? actorId.value
      : (actorId as { value?: unknown } | undefined)?.value;
    if (typeof actorIdValue !== 'string' || !Uuid.isValid(actorIdValue)) {
      throw new ForbiddenException('Policy Center requires an authenticated policy administrator.');
    }
    return {
      actorId: actorIdValue,
      actorName: req.actor?.email,
    };
  }

  private assertPolicyAdmin(req: Request): void {
    const roles = req.actor?.roles ?? [];
    if (!roles.some((role) => POLICY_ADMIN_ROLES.has(role))) {
      throw new ForbiddenException('Only policy administrators can manage Policy Center revisions.');
    }
  }
}
