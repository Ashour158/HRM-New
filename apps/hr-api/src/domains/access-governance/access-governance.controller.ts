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
import { randomUUID } from 'node:crypto';
import { createCommand, type CommandOutcome } from '@hcm/command-contracts';
import { Uuid } from '@hcm/shared-kernel';
import { AuthGuard } from '../../guards/auth.guard.js';
import { CommandBus } from '../../platform/command-bus/command-bus.js';
import { actorClientType, requireActor, requireTenantId } from '../../platform/http/request-context.js';
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
  constructor(
    private readonly service: AccessGovernanceService,
    private readonly commandBus: CommandBus,
  ) {}

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
    return this.executeAccessCommand(req, 'CreateAccessGovernanceRole', 'AccessGovernanceRole', { dto });
  }

  @Patch('roles/:roleId')
  async updateRole(@Param('roleId') roleId: string, @Body() dto: UpdateRoleDto, @Req() req: Request) {
    this.assertWriteScope(req);
    this.uuid(roleId, 'roleId');
    return this.executeAccessCommand(req, 'UpdateAccessGovernanceRole', 'AccessGovernanceRole', { roleId, dto });
  }

  @Post('permissions')
  async createPermission(@Body() dto: CreatePermissionDto, @Req() req: Request) {
    this.assertWriteScope(req);
    return this.executeAccessCommand(req, 'CreateAccessGovernancePermission', 'AccessGovernancePermission', { dto });
  }

  @Patch('permissions/:permissionId')
  async updatePermission(@Param('permissionId') permissionId: string, @Body() dto: UpdatePermissionDto, @Req() req: Request) {
    this.assertWriteScope(req);
    this.uuid(permissionId, 'permissionId');
    return this.executeAccessCommand(req, 'UpdateAccessGovernancePermission', 'AccessGovernancePermission', { permissionId, dto });
  }

  @Put('roles/:roleId/permissions')
  async replaceRolePermissions(
    @Param('roleId') roleId: string,
    @Body() dto: ReplaceRolePermissionsDto,
    @Req() req: Request,
  ) {
    this.assertWriteScope(req);
    this.uuid(roleId, 'roleId');
    return this.executeAccessCommand(req, 'ReplaceAccessGovernanceRolePermissions', 'AccessGovernanceRole', { roleId, dto });
  }

  @Post('roles/:roleId/permissions/:permissionId')
  async assignRolePermission(
    @Param('roleId') roleId: string,
    @Param('permissionId') permissionId: string,
    @Req() req: Request,
  ) {
    this.assertWriteScope(req);
    this.uuid(roleId, 'roleId');
    this.uuid(permissionId, 'permissionId');
    return this.executeAccessCommand(req, 'AssignAccessGovernanceRolePermission', 'AccessGovernanceRole', { roleId, permissionId });
  }

  @Delete('roles/:roleId/permissions/:permissionId')
  async removeRolePermission(
    @Param('roleId') roleId: string,
    @Param('permissionId') permissionId: string,
    @Req() req: Request,
  ) {
    this.assertWriteScope(req);
    this.uuid(roleId, 'roleId');
    this.uuid(permissionId, 'permissionId');
    return this.executeAccessCommand(req, 'RemoveAccessGovernanceRolePermission', 'AccessGovernanceRole', { roleId, permissionId });
  }

  @Post('user-roles')
  async assignUserRole(@Body() dto: AssignUserRoleDto, @Req() req: Request) {
    this.assertWriteScope(req);
    return this.executeAccessCommand(req, 'AssignAccessGovernanceUserRole', 'AccessGovernanceUserRole', { dto });
  }

  @Delete('user-roles/:userId/:roleId')
  async removeUserRole(@Param('userId') userId: string, @Param('roleId') roleId: string, @Req() req: Request) {
    this.assertWriteScope(req);
    this.uuid(userId, 'userId');
    this.uuid(roleId, 'roleId');
    return this.executeAccessCommand(req, 'RemoveAccessGovernanceUserRole', 'AccessGovernanceUserRole', { userId, roleId });
  }

  @Post('service-accounts')
  async createServiceAccount(@Body() dto: CreateServiceAccountDto, @Req() req: Request) {
    this.assertWriteScope(req);
    return this.executeAccessCommand(req, 'CreateServiceAccount', 'ServiceAccount', { dto });
  }

  @Patch('service-accounts/:accountId')
  async updateServiceAccount(@Param('accountId') accountId: string, @Body() dto: UpdateServiceAccountDto, @Req() req: Request) {
    this.assertWriteScope(req);
    this.uuid(accountId, 'accountId');
    return this.executeAccessCommand(req, 'UpdateServiceAccount', 'ServiceAccount', { accountId, dto });
  }

  @Post('service-accounts/:accountId/credentials/issue')
  async issueServiceAccountCredential(
    @Param('accountId') accountId: string,
    @Body() dto: IssueServiceAccountCredentialDto,
    @Req() req: Request,
  ) {
    this.assertWriteScope(req);
    this.uuid(accountId, 'accountId');
    return this.executeAccessCommand(req, 'IssueServiceAccountCredential', 'ServiceAccount', { accountId, dto });
  }

  @Post('service-accounts/:accountId/credentials/:credentialId/rotate')
  async rotateServiceAccountCredential(
    @Param('accountId') accountId: string,
    @Param('credentialId') credentialId: string,
    @Body() dto: RotateServiceAccountCredentialDto,
    @Req() req: Request,
  ) {
    this.assertWriteScope(req);
    this.uuid(accountId, 'accountId');
    this.uuid(credentialId, 'credentialId');
    return this.executeAccessCommand(req, 'RotateServiceAccountCredential', 'ServiceAccount', { accountId, credentialId, dto });
  }

  @Post('service-accounts/:accountId/credentials/:credentialId/revoke')
  async revokeServiceAccountCredential(
    @Param('accountId') accountId: string,
    @Param('credentialId') credentialId: string,
    @Body() dto: RevokeServiceAccountCredentialDto,
    @Req() req: Request,
  ) {
    this.assertWriteScope(req);
    this.uuid(accountId, 'accountId');
    this.uuid(credentialId, 'credentialId');
    return this.executeAccessCommand(req, 'RevokeServiceAccountCredential', 'ServiceAccount', { accountId, credentialId, dto });
  }

  @Post('access-reviews/campaigns')
  async createAccessReviewCampaign(@Body() dto: CreateAccessReviewCampaignDto, @Req() req: Request) {
    this.assertWriteScope(req);
    return this.executeAccessCommand(req, 'CreateAccessReviewCampaign', 'AccessReviewCampaign', { dto });
  }

  @Patch('access-reviews/campaigns/:campaignId')
  async updateAccessReviewCampaign(
    @Param('campaignId') campaignId: string,
    @Body() dto: UpdateAccessReviewCampaignDto,
    @Req() req: Request,
  ) {
    this.assertWriteScope(req);
    this.uuid(campaignId, 'campaignId');
    return this.executeAccessCommand(req, 'UpdateAccessReviewCampaign', 'AccessReviewCampaign', { campaignId, dto });
  }

  @Post('access-reviews/campaigns/:campaignId/commands/launch')
  async launchAccessReviewCampaign(@Param('campaignId') campaignId: string, @Req() req: Request) {
    this.assertWriteScope(req);
    this.uuid(campaignId, 'campaignId');
    return this.executeAccessCommand(req, 'LaunchAccessReviewCampaign', 'AccessReviewCampaign', { campaignId });
  }

  @Post('access-reviews/campaigns/:campaignId/commands/remind')
  async sendAccessReviewReminders(
    @Param('campaignId') campaignId: string,
    @Body() dto: AccessReviewWorkflowCommandDto,
    @Req() req: Request,
  ) {
    this.assertWriteScope(req);
    this.uuid(campaignId, 'campaignId');
    return this.executeAccessCommand(req, 'SendAccessReviewReminders', 'AccessReviewCampaign', { campaignId, dto });
  }

  @Post('access-reviews/campaigns/:campaignId/commands/escalate')
  async escalateAccessReviewCampaign(
    @Param('campaignId') campaignId: string,
    @Body() dto: AccessReviewWorkflowCommandDto,
    @Req() req: Request,
  ) {
    this.assertWriteScope(req);
    this.uuid(campaignId, 'campaignId');
    return this.executeAccessCommand(req, 'EscalateAccessReviewCampaign', 'AccessReviewCampaign', { campaignId, dto });
  }

  @Post('access-reviews/campaigns/:campaignId/commands/complete')
  async completeAccessReviewCampaign(@Param('campaignId') campaignId: string, @Req() req: Request) {
    this.assertWriteScope(req);
    this.uuid(campaignId, 'campaignId');
    return this.executeAccessCommand(req, 'CompleteAccessReviewCampaign', 'AccessReviewCampaign', { campaignId });
  }

  @Post('access-reviews/items')
  async createAccessReviewItem(@Body() dto: CreateAccessReviewItemDto, @Req() req: Request) {
    this.assertWriteScope(req);
    return this.executeAccessCommand(req, 'CreateAccessReviewItem', 'AccessReviewItem', { dto });
  }

  @Patch('access-reviews/items/:itemId')
  async updateAccessReviewItem(
    @Param('itemId') itemId: string,
    @Body() dto: UpdateAccessReviewItemDto,
    @Req() req: Request,
  ) {
    this.assertWriteScope(req);
    this.uuid(itemId, 'itemId');
    return this.executeAccessCommand(req, 'UpdateAccessReviewItem', 'AccessReviewItem', { itemId, dto });
  }

  @Post('abac-policies')
  async createAbacPolicy(@Body() dto: CreateAbacPolicyDto, @Req() req: Request) {
    this.assertWriteScope(req);
    return this.executeAccessCommand(req, 'CreateAbacPolicy', 'AccessGovernanceAbacPolicy', { dto });
  }

  @Patch('abac-policies/:policyId')
  async updateAbacPolicy(@Param('policyId') policyId: string, @Body() dto: UpdateAbacPolicyDto, @Req() req: Request) {
    this.assertWriteScope(req);
    this.uuid(policyId, 'policyId');
    return this.executeAccessCommand(req, 'UpdateAbacPolicy', 'AccessGovernanceAbacPolicy', { policyId, dto });
  }

  @Post('field-access-policies')
  async createFieldAccessPolicy(@Body() dto: CreateFieldAccessPolicyDto, @Req() req: Request) {
    this.assertWriteScope(req);
    return this.executeAccessCommand(req, 'CreateFieldAccessPolicy', 'AccessGovernanceFieldPolicy', { dto });
  }

  @Patch('field-access-policies/:policyId')
  async updateFieldAccessPolicy(@Param('policyId') policyId: string, @Body() dto: UpdateFieldAccessPolicyDto, @Req() req: Request) {
    this.assertWriteScope(req);
    this.uuid(policyId, 'policyId');
    return this.executeAccessCommand(req, 'UpdateFieldAccessPolicy', 'AccessGovernanceFieldPolicy', { policyId, dto });
  }

  @Post('sod-rules')
  async createSodRule(@Body() dto: CreateSodRuleDto, @Req() req: Request) {
    this.assertWriteScope(req);
    return this.executeAccessCommand(req, 'CreateSodRule', 'AccessGovernanceSodRule', { dto });
  }

  @Patch('sod-rules/:ruleId')
  async updateSodRule(@Param('ruleId') ruleId: string, @Body() dto: UpdateSodRuleDto, @Req() req: Request) {
    this.assertWriteScope(req);
    this.uuid(ruleId, 'ruleId');
    return this.executeAccessCommand(req, 'UpdateSodRule', 'AccessGovernanceSodRule', { ruleId, dto });
  }

  @Post('sod-rules/:ruleId/remediations')
  async remediateSodViolation(
    @Param('ruleId') ruleId: string,
    @Body() dto: Omit<RemediateSodViolationDto, 'ruleId'>,
    @Req() req: Request,
  ) {
    this.assertWriteScope(req);
    this.uuid(ruleId, 'ruleId');
    return this.executeAccessCommand(req, 'RemediateSodViolation', 'AccessGovernanceSodRule', {
      ruleId,
      dto: { ...dto, ruleId },
    });
  }

  private async executeAccessCommand<TPayload, TResult>(
    req: Request,
    commandName: string,
    aggregateType: string,
    payload: TPayload,
  ): Promise<TResult> {
    const tenantId = this.getTenantId(req);
    const actor = requireActor(req, 'Access governance');
    const result = await this.commandBus.execute(createCommand(
      commandName,
      tenantId,
      actor,
      payload,
      {
        aggregateType,
        idempotencyKey: randomUUID(),
        correlationId: Uuid.generate(),
        reason: 'Manage access governance from System Console',
        metadata: {
          clientType: actorClientType(actor),
          hrDataSensitivity: 'RESTRICTED',
        },
      },
    )) as CommandOutcome<TResult>;
    if (!result.success) {
      throw new BadRequestException(result.errorMessage);
    }
    return result.data;
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
    return requireTenantId(req, 'Access governance');
  }

  private uuid(value: string, field: string): Uuid {
    if (!Uuid.isValid(value)) throw new BadRequestException(`${field} must be a valid UUID`);
    return new Uuid(value);
  }
}
