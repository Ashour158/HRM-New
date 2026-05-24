import { randomUUID } from 'node:crypto';
import { Uuid } from '@hcm/shared-kernel';
import type { DecisionRecord } from '../core/decision-record.js';
import type { EngineContext, PolicyEngine, PolicyEngineDefinition } from '../core/engine-definition.js';

/**
 * Decision codes emitted by the Self-Service Authority Engine.
 */
export type SelfServiceAllowlistDecisionCode =
  | 'ALLOWED'
  | 'REQUIRES_APPROVAL'
  | 'FORBIDDEN';

/**
 * Input payload for the Self-Service Authority Engine.
 */
export interface SelfServiceAuthorityInput {
  readonly actorType: string;
  readonly commandName: string;
  readonly actorRoles: string[];
  readonly abacContext: Record<string, unknown>;
}

/**
 * Self-Service Authority Engine.
 *
 * Decides whether a self-service command initiated by an employee,
 * manager, or administrator is allowed, requires approval, or is
 * forbidden. Consumes the `employee-self-service-rules` rule pack.
 */
export class SelfServiceAuthorityEngine implements PolicyEngine<SelfServiceAuthorityInput, DecisionRecord> {
  readonly definition: PolicyEngineDefinition = {
    engineName: 'self-service-authority',
    engineVersion: '1.4.0',
    description:
      'Determines if a self-service action is permitted, requires elevated approval, '
      + 'or is forbidden based on actor role and ABAC context.',
    inputTypes: ['ActorType', 'CommandName', 'ActorRole', 'AbacContext'],
    outputDecisionCodes: ['ALLOWED', 'REQUIRES_APPROVAL', 'FORBIDDEN'],
    associatedRulePacks: ['employee-self-service-rules'],
    associatedTables: ['self_service_rules', 'actor_roles', 'approval_workflows'],
    invocationPattern: 'SYNC',
    maxDurationMs: 100,
    requiresCountryPolicyPack: false,
    requiresHumanReview: false,
    auditRequired: true,
  };

  async execute(
    input: SelfServiceAuthorityInput,
    context: EngineContext,
  ): Promise<DecisionRecord> {
    // Stub: real implementation evaluates role + ABAC constraints.
    const decisionCode: SelfServiceAllowlistDecisionCode = 'ALLOWED';

    const record: DecisionRecord = {
      decisionId: new Uuid(randomUUID()),
      decisionCode,
      engineName: this.definition.engineName,
      engineVersion: this.definition.engineVersion,
      ruleSetId: 'employee-self-service-rules',
      ruleSetVersion: '1.0.0',
      explanation:
        `Self-service command "${input.commandName}" evaluated for actor type "${input.actorType}". `
        + `Result: ${decisionCode}.`,
      sourceInputIds: [input.commandName],
      inputSnapshotHash: '<SHA-256>',
      timestamp: new Date(),
      tenantId: context.tenantId,
      actorId: context.actorId,
      correlationId: context.correlationId,
      effectiveDate: context.effectiveDate,
    };

    return record;
  }
}
