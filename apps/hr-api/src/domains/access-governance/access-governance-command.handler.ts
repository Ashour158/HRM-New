import { Injectable, OnModuleInit } from '@nestjs/common';
import type { CommandResult, HrCommandEnvelope } from '@hcm/command-contracts';
import { Uuid } from '@hcm/shared-kernel';
import { CommandBus, type CommandHandler as ICommandHandler } from '../../platform/command-bus/command-bus.js';
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

export const ACCESS_GOVERNANCE_COMMAND_NAMES = [
  'CreateAccessGovernanceRole',
  'UpdateAccessGovernanceRole',
  'CreateAccessGovernancePermission',
  'UpdateAccessGovernancePermission',
  'ReplaceAccessGovernanceRolePermissions',
  'AssignAccessGovernanceRolePermission',
  'RemoveAccessGovernanceRolePermission',
  'AssignAccessGovernanceUserRole',
  'RemoveAccessGovernanceUserRole',
  'CreateServiceAccount',
  'UpdateServiceAccount',
  'IssueServiceAccountCredential',
  'RotateServiceAccountCredential',
  'RevokeServiceAccountCredential',
  'CreateAccessReviewCampaign',
  'UpdateAccessReviewCampaign',
  'LaunchAccessReviewCampaign',
  'SendAccessReviewReminders',
  'EscalateAccessReviewCampaign',
  'CompleteAccessReviewCampaign',
  'CreateAccessReviewItem',
  'UpdateAccessReviewItem',
  'CreateAbacPolicy',
  'UpdateAbacPolicy',
  'CreateFieldAccessPolicy',
  'UpdateFieldAccessPolicy',
  'CreateSodRule',
  'UpdateSodRule',
  'RemediateSodViolation',
] as const;

type AccessGovernancePayload = {
  dto?: unknown;
  roleId?: string;
  permissionId?: string;
  userId?: string;
  accountId?: string;
  credentialId?: string;
  campaignId?: string;
  itemId?: string;
  policyId?: string;
  ruleId?: string;
  permissionIds?: string[];
};

@Injectable()
export class AccessGovernanceCommandHandler implements ICommandHandler, OnModuleInit {
  readonly commandName = 'AccessGovernanceCommand';

  constructor(
    private readonly service: AccessGovernanceService,
    private readonly commandBus: CommandBus,
  ) {}

  onModuleInit(): void {
    for (const commandName of ACCESS_GOVERNANCE_COMMAND_NAMES) {
      this.commandBus.registerHandler(commandName, this);
    }
  }

  async handle(command: HrCommandEnvelope<unknown>): Promise<CommandResult<unknown>> {
    const data = await this.execute(command, command.payload as AccessGovernancePayload);
    return {
      success: true,
      data,
      commandId: command.commandId,
      correlationId: command.correlationId,
      aggregateId: this.aggregateId(command, data),
      newState: this.state(data),
      newVersion: 1,
      allowedNextActions: ['ReviewAccessGovernance'],
      fieldAccessDecisions: {},
      eventsEmitted: [command.commandName],
      auditRecordId: Uuid.generate(),
    };
  }

  private async execute(command: HrCommandEnvelope<unknown>, payload: AccessGovernancePayload): Promise<unknown> {
    switch (command.commandName) {
      case 'CreateAccessGovernanceRole':
        return this.service.createRole(command.tenantId, payload.dto as CreateRoleDto);
      case 'UpdateAccessGovernanceRole':
        return this.service.updateRole(command.tenantId, this.uuid(payload.roleId, 'roleId'), payload.dto as UpdateRoleDto);
      case 'CreateAccessGovernancePermission':
        return this.service.createPermission(command.tenantId, payload.dto as CreatePermissionDto);
      case 'UpdateAccessGovernancePermission':
        return this.service.updatePermission(command.tenantId, this.uuid(payload.permissionId, 'permissionId'), payload.dto as UpdatePermissionDto);
      case 'ReplaceAccessGovernanceRolePermissions':
        return this.service.replaceRolePermissions(command.tenantId, this.uuid(payload.roleId, 'roleId'), (payload.dto as ReplaceRolePermissionsDto | undefined)?.permissionIds ?? payload.permissionIds ?? []);
      case 'AssignAccessGovernanceRolePermission':
        return this.service.assignRolePermission(command.tenantId, this.uuid(payload.roleId, 'roleId'), this.uuid(payload.permissionId, 'permissionId'));
      case 'RemoveAccessGovernanceRolePermission':
        return this.service.removeRolePermission(command.tenantId, this.uuid(payload.roleId, 'roleId'), this.uuid(payload.permissionId, 'permissionId'));
      case 'AssignAccessGovernanceUserRole':
        return this.service.assignUserRole(command.tenantId, payload.dto as AssignUserRoleDto, this.actorId(command));
      case 'RemoveAccessGovernanceUserRole':
        return this.service.removeUserRole(command.tenantId, this.uuid(payload.userId, 'userId'), this.uuid(payload.roleId, 'roleId'));
      case 'CreateServiceAccount':
        return this.service.createServiceAccount(command.tenantId, payload.dto as CreateServiceAccountDto, this.actorId(command));
      case 'UpdateServiceAccount':
        return this.service.updateServiceAccount(command.tenantId, this.uuid(payload.accountId, 'accountId'), payload.dto as UpdateServiceAccountDto);
      case 'IssueServiceAccountCredential':
        return this.service.issueServiceAccountCredential(command.tenantId, this.uuid(payload.accountId, 'accountId'), payload.dto as IssueServiceAccountCredentialDto, this.actorId(command));
      case 'RotateServiceAccountCredential':
        return this.service.rotateServiceAccountCredential(command.tenantId, this.uuid(payload.accountId, 'accountId'), this.uuid(payload.credentialId, 'credentialId'), payload.dto as RotateServiceAccountCredentialDto, this.actorId(command));
      case 'RevokeServiceAccountCredential':
        return this.service.revokeServiceAccountCredential(command.tenantId, this.uuid(payload.accountId, 'accountId'), this.uuid(payload.credentialId, 'credentialId'), payload.dto as RevokeServiceAccountCredentialDto, this.actorId(command));
      case 'CreateAccessReviewCampaign':
        return this.service.createAccessReviewCampaign(command.tenantId, payload.dto as CreateAccessReviewCampaignDto, this.actorId(command));
      case 'UpdateAccessReviewCampaign':
        return this.service.updateAccessReviewCampaign(command.tenantId, this.uuid(payload.campaignId, 'campaignId'), payload.dto as UpdateAccessReviewCampaignDto);
      case 'LaunchAccessReviewCampaign':
        return this.service.launchAccessReviewCampaign(command.tenantId, this.uuid(payload.campaignId, 'campaignId'), this.actorId(command));
      case 'SendAccessReviewReminders':
        return this.service.sendAccessReviewReminders(command.tenantId, this.uuid(payload.campaignId, 'campaignId'), payload.dto as AccessReviewWorkflowCommandDto, this.actorId(command));
      case 'EscalateAccessReviewCampaign':
        return this.service.escalateAccessReviewCampaign(command.tenantId, this.uuid(payload.campaignId, 'campaignId'), payload.dto as AccessReviewWorkflowCommandDto, this.actorId(command));
      case 'CompleteAccessReviewCampaign':
        return this.service.completeAccessReviewCampaign(command.tenantId, this.uuid(payload.campaignId, 'campaignId'), this.actorId(command));
      case 'CreateAccessReviewItem':
        return this.service.createAccessReviewItem(command.tenantId, payload.dto as CreateAccessReviewItemDto);
      case 'UpdateAccessReviewItem':
        return this.service.updateAccessReviewItem(command.tenantId, this.uuid(payload.itemId, 'itemId'), payload.dto as UpdateAccessReviewItemDto, this.actorId(command));
      case 'CreateAbacPolicy':
        return this.service.createAbacPolicy(command.tenantId, payload.dto as CreateAbacPolicyDto);
      case 'UpdateAbacPolicy':
        return this.service.updateAbacPolicy(command.tenantId, this.uuid(payload.policyId, 'policyId'), payload.dto as UpdateAbacPolicyDto);
      case 'CreateFieldAccessPolicy':
        return this.service.createFieldAccessPolicy(command.tenantId, payload.dto as CreateFieldAccessPolicyDto);
      case 'UpdateFieldAccessPolicy':
        return this.service.updateFieldAccessPolicy(command.tenantId, this.uuid(payload.policyId, 'policyId'), payload.dto as UpdateFieldAccessPolicyDto);
      case 'CreateSodRule':
        return this.service.createSodRule(command.tenantId, payload.dto as CreateSodRuleDto);
      case 'UpdateSodRule':
        return this.service.updateSodRule(command.tenantId, this.uuid(payload.ruleId, 'ruleId'), payload.dto as UpdateSodRuleDto);
      case 'RemediateSodViolation':
        return this.service.remediateSodViolation(command.tenantId, payload.dto as RemediateSodViolationDto, this.actorId(command));
      default:
        throw new Error(`Unsupported access governance command ${command.commandName}`);
    }
  }

  private uuid(value: string | undefined, field: string): Uuid {
    if (!value || !Uuid.isValid(value)) {
      throw new Error(`${field} must be a valid UUID`);
    }
    return new Uuid(value);
  }

  private actorId(command: HrCommandEnvelope<unknown>): Uuid {
    return command.actor.actorId;
  }

  private aggregateId(command: HrCommandEnvelope<unknown>, data: unknown): Uuid {
    const record = typeof data === 'object' && data !== null
      ? Array.isArray(data)
        ? data[0] as Record<string, unknown> | undefined
        : data as Record<string, unknown>
      : undefined;
    const id = typeof record?.id === 'string' ? record.id : undefined;
    return id && Uuid.isValid(id) ? new Uuid(id) : command.tenantId;
  }

  private state(data: unknown): string {
    const record = typeof data === 'object' && data !== null
      ? Array.isArray(data)
        ? data[0] as Record<string, unknown> | undefined
        : data as Record<string, unknown>
      : undefined;
    const status = record?.status ?? record?.decision ?? record?.eventType;
    return typeof status === 'string' ? status : 'COMPLETED';
  }
}
