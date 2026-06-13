import { BadRequestException, Body, Controller, ForbiddenException, Get, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { Uuid } from '@hcm/shared-kernel';
import { AuthGuard } from '../../guards/auth.guard.js';
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
  constructor(private readonly service: PolicyCenterService) {}

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
    return this.service.createRevision(this.getTenantId(req), body, this.getActor(req));
  }

  @Patch('revisions/:id')
  async update(@Param('id') id: string, @Body() body: UpdatePolicyRevisionInput, @Req() req: Request) {
    this.assertPolicyAdmin(req);
    return this.service.updateRevision(this.getTenantId(req), id, body, this.getActor(req));
  }

  @Post('revisions/:id/validate')
  async validate(@Param('id') id: string, @Req() req: Request) {
    this.assertPolicyAdmin(req);
    return this.service.validateRevision(this.getTenantId(req), id, this.getActor(req));
  }

  @Post('revisions/:id/simulate')
  async simulate(@Param('id') id: string, @Req() req: Request) {
    this.assertPolicyAdmin(req);
    return this.service.simulateRevision(this.getTenantId(req), id, this.getActor(req));
  }

  @Post('revisions/:id/commands/submit-review')
  async submitReview(@Param('id') id: string, @Req() req: Request) {
    this.assertPolicyAdmin(req);
    return this.service.submitForReview(this.getTenantId(req), id, this.getActor(req));
  }

  @Post('revisions/:id/commands/mark-reviewed')
  async markReviewed(@Param('id') id: string, @Req() req: Request) {
    this.assertPolicyAdmin(req);
    return this.service.markReviewed(this.getTenantId(req), id, this.getActor(req));
  }

  @Post('revisions/:id/commands/approve')
  async approve(@Param('id') id: string, @Req() req: Request) {
    this.assertPolicyAdmin(req);
    return this.service.approveRevision(this.getTenantId(req), id, this.getActor(req));
  }

  @Post('revisions/:id/commands/publish')
  async publish(@Param('id') id: string, @Req() req: Request) {
    this.assertPolicyAdmin(req);
    return this.service.publishRevision(this.getTenantId(req), id, this.getActor(req));
  }

  @Post('revisions/:id/commands/apply')
  async apply(@Param('id') id: string, @Body() body: PolicyApplyInput | undefined, @Req() req: Request) {
    this.assertPolicyAdmin(req);
    return this.service.applyRevision(this.getTenantId(req), id, this.getActor(req), body ?? {});
  }

  @Post('revisions/:id/commands/create-rollback')
  async createRollback(@Param('id') id: string, @Body() body: PolicyRollbackInput, @Req() req: Request) {
    this.assertPolicyAdmin(req);
    return this.service.createRollbackDraft(this.getTenantId(req), id, body, this.getActor(req));
  }

  private getTenantId(req: Request): Uuid {
    const tenantId = req.tenantId;
    if (typeof tenantId !== 'string' || !Uuid.isValid(tenantId)) {
      throw new BadRequestException('Policy Center requires a valid tenant context');
    }
    return new Uuid(tenantId);
  }

  private getActor(req: Request): PolicyActor {
    if (!req.actor) {
      throw new ForbiddenException('Policy Center requires an authenticated policy administrator.');
    }
    return {
      actorId: req.actor?.actorId?.value ?? req.actor?.email ?? 'local-policy-admin',
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
