import type { HrCommandEnvelope } from '@hcm/command-contracts';
import { CommandPipelineStep } from '@hcm/command-contracts';
import { makeError } from '../command-bus-errors.js';
import {
  aggregateTypeMatches,
  commandActionMatches,
  fieldPathMatchesOverride,
  flattenPayloadPaths,
  policyScopeMatches,
  rolesMatch,
} from '../command-bus.utils.js';
import type { RuntimeSetupResolver } from './runtime-setup.resolver.js';
import type {
  AllowedActionPolicyOverride,
  FieldAccessPolicyOverride,
} from '../../../domains/hcm-setup/hcm-setup.types.js';

/**
 * Applies tenant-configured runtime Policy Center overrides on top of the
 * static RBAC/field-policy gates: allowed-action overrides (hide/deny a
 * command action) and field-access overrides (deny/hide/step-up a payload
 * field), each scoped by aggregate type, roles, and policy scope.
 */
export class RuntimeGovernanceStep {
  constructor(private readonly runtimeSetup: RuntimeSetupResolver) {}

  async evaluate(command: HrCommandEnvelope<unknown>): Promise<void> {
    await this.evaluateAllowedActionOverrides(command);
    await this.evaluateFieldAccessOverrides(command);
  }

  private async evaluateAllowedActionOverrides(command: HrCommandEnvelope<unknown>): Promise<void> {
    if (command.actor.actorType === 'SYSTEM' || command.actor.actorType === 'SERVICE_ACCOUNT') {
      return;
    }

    const governance = await this.runtimeSetup.getGovernance(command);
    if (!governance) return;

    const blockedAction = governance.allowedActionOverrides?.find((candidate) => (
      candidate.effect === 'HIDE' && this.allowedActionOverrideMatches(candidate, command)
    ));
    if (blockedAction) {
      throw makeError(
        command,
        CommandPipelineStep.EVALUATE_COMMAND_AUTHORIZATION_ROLE_SCOPE,
        'RUNTIME_POLICY_ACTION_DENIED',
        blockedAction.reason ?? `Applied access policy hides or denies ${command.commandName} for ${command.aggregateType}`,
        false,
      );
    }
  }

  private async evaluateFieldAccessOverrides(command: HrCommandEnvelope<unknown>): Promise<void> {
    if (command.actor.actorType === 'SYSTEM' || command.actor.actorType === 'SERVICE_ACCOUNT') {
      return;
    }

    const governance = await this.runtimeSetup.getGovernance(command);
    if (!governance) return;

    const payloadPaths = flattenPayloadPaths(command.payload);
    const blockedField = governance.fieldAccessOverrides?.find((candidate) => (
      this.fieldAccessOverrideBlocksWrite(candidate, command, payloadPaths)
    ));
    if (!blockedField) return;

    throw makeError(
      command,
      CommandPipelineStep.EVALUATE_HR_DATA_PRIVACY_FIELD_POLICY,
      'RUNTIME_POLICY_FIELD_DENIED',
      blockedField.reason ?? `Applied field access policy denies mutation of ${blockedField.fieldPath}`,
      false,
    );
  }

  private allowedActionOverrideMatches(
    override: AllowedActionPolicyOverride,
    command: HrCommandEnvelope<unknown>,
  ): boolean {
    return Boolean(
      override.active
      && aggregateTypeMatches(override.aggregateType, command.aggregateType)
      && commandActionMatches(override.action, command)
      && rolesMatch(override.roles, command.actor.roles)
      && policyScopeMatches(override.scope, command),
    );
  }

  private fieldAccessOverrideBlocksWrite(
    override: FieldAccessPolicyOverride,
    command: HrCommandEnvelope<unknown>,
    payloadPaths: string[],
  ): boolean {
    return Boolean(
      override.active
      && this.fieldDecisionBlocksWrite(override, command)
      && aggregateTypeMatches(override.resourceType, command.aggregateType)
      && rolesMatch(override.roles, command.actor.roles)
      && policyScopeMatches(override.scope, command)
      && payloadPaths.some((path) => fieldPathMatchesOverride(path, override.fieldPath)),
    );
  }

  private fieldDecisionBlocksWrite(
    override: FieldAccessPolicyOverride,
    command: HrCommandEnvelope<unknown>,
  ): boolean {
    if (override.decision === 'DENIED' || override.decision === 'HIDDEN') return true;
    if (override.decision === 'REQUIRES_BREAK_GLASS') return !command.actor.breakGlassSessionId;
    if (override.decision === 'REQUIRES_STEP_UP') return !command.actor.mfaAuthenticated;
    return false;
  }
}
