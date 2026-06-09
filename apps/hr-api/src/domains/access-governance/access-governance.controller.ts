import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  Param,
  Patch,
  Post,
  Put,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { Uuid } from '@hcm/shared-kernel';
import { AuthGuard } from '../../guards/auth.guard.js';
import { AccessGovernanceService } from './access-governance.service.js';
import type {
  AssignUserRoleDto,
  CreateAbacPolicyDto,
  CreateAccessReviewCampaignDto,
  CreateAccessReviewItemDto,
  CreateFieldAccessPolicyDto,
  CreatePermissionDto,
  CreateRoleDto,
  CreateServiceAccountDto,
  CreateSodRuleDto,
  IssueServiceAccountCredentialDto,
  RemediateSodViolationDto,
  ReplaceRolePermissionsDto,
  RevokeServiceAccountCredentialDto,
  RotateServiceAccountCredentialDto,
  UpdateAbacPolicyDto,
  UpdateAccessReviewCampaignDto,
  AccessReviewWorkflowCommandDto,
  UpdateAccessReviewItemDto,
  UpdateFieldAccessPolicyDto,
  UpdatePermissionDto,
  UpdateRoleDto,
  UpdateServiceAccountDto,
  UpdateSodRuleDto,
} from './access-governance.types.js';

const ACCESS_GOVERNANCE_ADMIN_ROLES = new Set([
  'APP_ADMIN',
  'PLATFORM_ADMIN',
  'SUPER_ADMIN',
  'HR_ADMIN',
  'COMPLIANCE_OFFICER',
]);

@ApiTags('Access Governance')
@UseGuards(AuthGuard)
@Controller('admin/access-governance')
export class AccessGovernanceController {
  constructor(private readonly service: AccessGovernanceService) {}

  @Get()
  async getSummary(@Req() req: Request) {
    this.assertReadScope(req);
    return this.service.getSummary(this.getTenantId(req));
  }

  @Get('summary')
  async getSummaryAlias(@Req() req: Request) {
    return this.getSummary(req);
  }

  @Post('roles')
  async createRole(@Body() dto: CreateRoleDto, @Req() req: Request) {
    this.assertWriteScope(req);
    return this.service.createRole(this.getTenantId(req), dto);
  }

  @Patch('roles/:roleId')
  async updateRole(@Param('roleId') roleId: string, @Body() dto: UpdateRoleDto, @Req() req: Request) {
    this.assertWriteScope(req);
    return this.service.updateRole(this.getTenantId(req), this.uuid(roleId, 'roleId'), dto);
  }

  @Post('permissions')
  async createPermission(@Body() dto: CreatePermissionDto, @Req() req: Request) {
    this.assertWriteScope(req);
    return this.service.createPermission(this.getTenantId(req), dto);
  }

  @Patch('permissions/:permissionId')
  async updatePermission(@Param('permissionId') permissionId: string, @Body() dto: UpdatePermissionDto, @Req() req: Request) {
    this.assertWriteScope(req);
    return this.service.updatePermission(this.getTenantId(req), this.uuid(permissionId, 'permissionId'), dto);
  }

  @Put('roles/:roleId/permissions')
  async replaceRolePermissions(
    @Param('roleId') roleId: string,
    @Body() dto: ReplaceRolePermissionsDto,
    @Req() req: Request,
  ) {
    this.assertWriteScope(req);
    return this.service.replaceRolePermissions(this.getTenantId(req), this.uuid(roleId, 'roleId'), dto.permissionIds ?? []);
  }

  @Post('roles/:roleId/permissions/:permissionId')
  async assignRolePermission(
    @Param('roleId') roleId: string,
    @Param('permissionId') permissionId: string,
    @Req() req: Request,
  ) {
    this.assertWriteScope(req);
    return this.service.assignRolePermission(
      this.getTenantId(req),
      this.uuid(roleId, 'roleId'),
      this.uuid(permissionId, 'permissionId'),
    );
  }

  @Delete('roles/:roleId/permissions/:permissionId')
  async removeRolePermission(
    @Param('roleId') roleId: string,
    @Param('permissionId') permissionId: string,
    @Req() req: Request,
  ) {
    this.assertWriteScope(req);
    return this.service.removeRolePermission(
      this.getTenantId(req),
      this.uuid(roleId, 'roleId'),
      this.uuid(permissionId, 'permissionId'),
    );
  }

  @Post('user-roles')
  async assignUserRole(@Body() dto: AssignUserRoleDto, @Req() req: Request) {
    this.assertWriteScope(req);
    return this.service.assignUserRole(this.getTenantId(req), dto, this.getActorId(req));
  }

  @Delete('user-roles/:userId/:roleId')
  async removeUserRole(@Param('userId') userId: string, @Param('roleId') roleId: string, @Req() req: Request) {
    this.assertWriteScope(req);
    return this.service.removeUserRole(
      this.getTenantId(req),
      this.uuid(userId, 'userId'),
      this.uuid(roleId, 'roleId'),
    );
  }

  @Post('service-accounts')
  async createServiceAccount(@Body() dto: CreateServiceAccountDto, @Req() req: Request) {
    this.assertWriteScope(req);
    return this.service.createServiceAccount(this.getTenantId(req), dto, this.getActorId(req));
  }

  @Patch('service-accounts/:accountId')
  async updateServiceAccount(@Param('accountId') accountId: string, @Body() dto: UpdateServiceAccountDto, @Req() req: Request) {
    this.assertWriteScope(req);
    return this.service.updateServiceAccount(this.getTenantId(req), this.uuid(accountId, 'accountId'), dto);
  }

  @Post('service-accounts/:accountId/credentials/issue')
  async issueServiceAccountCredential(
    @Param('accountId') accountId: string,
    @Body() dto: IssueServiceAccountCredentialDto,
    @Req() req: Request,
  ) {
    this.assertWriteScope(req);
    return this.service.issueServiceAccountCredential(this.getTenantId(req), this.uuid(accountId, 'accountId'), dto, this.getActorId(req));
  }

  @Post('service-accounts/:accountId/credentials/:credentialId/rotate')
  async rotateServiceAccountCredential(
    @Param('accountId') accountId: string,
    @Param('credentialId') credentialId: string,
    @Body() dto: RotateServiceAccountCredentialDto,
    @Req() req: Request,
  ) {
    this.assertWriteScope(req);
    return this.service.rotateServiceAccountCredential(
      this.getTenantId(req),
      this.uuid(accountId, 'accountId'),
      this.uuid(credentialId, 'credentialId'),
      dto,
      this.getActorId(req),
    );
  }

  @Post('service-accounts/:accountId/credentials/:credentialId/revoke')
  async revokeServiceAccountCredential(
    @Param('accountId') accountId: string,
    @Param('credentialId') credentialId: string,
    @Body() dto: RevokeServiceAccountCredentialDto,
    @Req() req: Request,
  ) {
    this.assertWriteScope(req);
    return this.service.revokeServiceAccountCredential(
      this.getTenantId(req),
      this.uuid(accountId, 'accountId'),
      this.uuid(credentialId, 'credentialId'),
      dto,
      this.getActorId(req),
    );
  }

  @Post('access-reviews/campaigns')
  async createAccessReviewCampaign(@Body() dto: CreateAccessReviewCampaignDto, @Req() req: Request) {
    this.assertWriteScope(req);
    return this.service.createAccessReviewCampaign(this.getTenantId(req), dto, this.getActorId(req));
  }

  @Patch('access-reviews/campaigns/:campaignId')
  async updateAccessReviewCampaign(
    @Param('campaignId') campaignId: string,
    @Body() dto: UpdateAccessReviewCampaignDto,
    @Req() req: Request,
  ) {
    this.assertWriteScope(req);
    return this.service.updateAccessReviewCampaign(this.getTenantId(req), this.uuid(campaignId, 'campaignId'), dto);
  }

  @Post('access-reviews/campaigns/:campaignId/commands/launch')
  async launchAccessReviewCampaign(@Param('campaignId') campaignId: string, @Req() req: Request) {
    this.assertWriteScope(req);
    return this.service.launchAccessReviewCampaign(this.getTenantId(req), this.uuid(campaignId, 'campaignId'), this.getActorId(req));
  }

  @Post('access-reviews/campaigns/:campaignId/commands/remind')
  async sendAccessReviewReminders(
    @Param('campaignId') campaignId: string,
    @Body() dto: AccessReviewWorkflowCommandDto,
    @Req() req: Request,
  ) {
    this.assertWriteScope(req);
    return this.service.sendAccessReviewReminders(this.getTenantId(req), this.uuid(campaignId, 'campaignId'), dto, this.getActorId(req));
  }

  @Post('access-reviews/campaigns/:campaignId/commands/escalate')
  async escalateAccessReviewCampaign(
    @Param('campaignId') campaignId: string,
    @Body() dto: AccessReviewWorkflowCommandDto,
    @Req() req: Request,
  ) {
    this.assertWriteScope(req);
    return this.service.escalateAccessReviewCampaign(this.getTenantId(req), this.uuid(campaignId, 'campaignId'), dto, this.getActorId(req));
  }

  @Post('access-reviews/campaigns/:campaignId/commands/complete')
  async completeAccessReviewCampaign(@Param('campaignId') campaignId: string, @Req() req: Request) {
    this.assertWriteScope(req);
    return this.service.completeAccessReviewCampaign(this.getTenantId(req), this.uuid(campaignId, 'campaignId'), this.getActorId(req));
  }

  @Post('access-reviews/items')
  async createAccessReviewItem(@Body() dto: CreateAccessReviewItemDto, @Req() req: Request) {
    this.assertWriteScope(req);
    return this.service.createAccessReviewItem(this.getTenantId(req), dto);
  }

  @Patch('access-reviews/items/:itemId')
  async updateAccessReviewItem(
    @Param('itemId') itemId: string,
    @Body() dto: UpdateAccessReviewItemDto,
    @Req() req: Request,
  ) {
    this.assertWriteScope(req);
    return this.service.updateAccessReviewItem(this.getTenantId(req), this.uuid(itemId, 'itemId'), dto, this.getActorId(req));
  }

  @Post('abac-policies')
  async createAbacPolicy(@Body() dto: CreateAbacPolicyDto, @Req() req: Request) {
    this.assertWriteScope(req);
    return this.service.createAbacPolicy(this.getTenantId(req), dto);
  }

  @Patch('abac-policies/:policyId')
  async updateAbacPolicy(@Param('policyId') policyId: string, @Body() dto: UpdateAbacPolicyDto, @Req() req: Request) {
    this.assertWriteScope(req);
    return this.service.updateAbacPolicy(this.getTenantId(req), this.uuid(policyId, 'policyId'), dto);
  }

  @Post('field-access-policies')
  async createFieldAccessPolicy(@Body() dto: CreateFieldAccessPolicyDto, @Req() req: Request) {
    this.assertWriteScope(req);
    return this.service.createFieldAccessPolicy(this.getTenantId(req), dto);
  }

  @Patch('field-access-policies/:policyId')
  async updateFieldAccessPolicy(@Param('policyId') policyId: string, @Body() dto: UpdateFieldAccessPolicyDto, @Req() req: Request) {
    this.assertWriteScope(req);
    return this.service.updateFieldAccessPolicy(this.getTenantId(req), this.uuid(policyId, 'policyId'), dto);
  }

  @Post('sod-rules')
  async createSodRule(@Body() dto: CreateSodRuleDto, @Req() req: Request) {
    this.assertWriteScope(req);
    return this.service.createSodRule(this.getTenantId(req), dto);
  }

  @Patch('sod-rules/:ruleId')
  async updateSodRule(@Param('ruleId') ruleId: string, @Body() dto: UpdateSodRuleDto, @Req() req: Request) {
    this.assertWriteScope(req);
    return this.service.updateSodRule(this.getTenantId(req), this.uuid(ruleId, 'ruleId'), dto);
  }

  @Post('sod-rules/:ruleId/remediations')
  async remediateSodViolation(
    @Param('ruleId') ruleId: string,
    @Body() dto: Omit<RemediateSodViolationDto, 'ruleId'>,
    @Req() req: Request,
  ) {
    this.assertWriteScope(req);
    return this.service.remediateSodViolation(
      this.getTenantId(req),
      { ...dto, ruleId: this.uuid(ruleId, 'ruleId').value },
      this.getActorId(req),
    );
  }

  private assertReadScope(req: Request): void {
    const roles = req.actor?.roles ?? [];
    if (!roles.some((role) => ACCESS_GOVERNANCE_ADMIN_ROLES.has(role))) {
      throw new ForbiddenException('Access governance requires an administrator role');
    }
  }

  private assertWriteScope(req: Request): void {
    this.assertReadScope(req);
  }

  private getTenantId(req: Request): Uuid {
    return new Uuid((req.tenantId as string | undefined) ?? '00000000-0000-0000-0000-000000000001');
  }

  private getActorId(req: Request): Uuid | undefined {
    const actorId = req.actor?.actorId;
    if (actorId instanceof Uuid) return actorId;
    if (typeof actorId === 'string' && Uuid.isValid(actorId)) return new Uuid(actorId);
    return undefined;
  }

  private uuid(value: string, field: string): Uuid {
    if (!Uuid.isValid(value)) throw new BadRequestException(`${field} must be a valid UUID`);
    return new Uuid(value);
  }
}
