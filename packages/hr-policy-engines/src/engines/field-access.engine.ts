import { randomUUID } from 'node:crypto';
import { Uuid } from '@hcm/shared-kernel';
import type { DecisionRecord } from '../core/decision-record.js';
import type { EngineContext, PolicyEngine, PolicyEngineDefinition } from '../core/engine-definition.js';

/**
 * Decision codes emitted by the Field Access Policy Engine.
 */
export type FieldAccessDecisionCode =
  | 'VISIBLE'
  | 'MASKED'
  | 'HIDDEN'
  | 'REQUIRES_STEP_UP'
  | 'REQUIRES_BREAK_GLASS'
  | 'DENIED';

/**
 * Input payload for the Field Access Policy Engine.
 */
export interface FieldAccessInput {
  readonly fieldPath: string;
  readonly dataClassification: string;
  readonly actorRoles: string[];
  readonly abacContext: Record<string, unknown>;
  readonly purpose: string;
}

/**
 * Field Access Policy Engine.
 *
 * Determines how a data field should be exposed to an actor based on
 * classification, purpose, roles, and ABAC context. Consumes the
 * `field-classification-rules` rule pack.
 */
export class FieldAccessPolicyEngine implements PolicyEngine<FieldAccessInput, DecisionRecord> {
  readonly definition: PolicyEngineDefinition = {
    engineName: 'field-access-policy',
    engineVersion: '1.4.0',
    description:
      'Resolves field-level visibility (visible, masked, hidden, step-up, break-glass, denied) '
      + 'based on data classification, actor roles, and declared purpose.',
    inputTypes: ['FieldPath', 'DataClassification', 'ActorRole', 'AbacContext', 'Purpose'],
    outputDecisionCodes: [
      'VISIBLE',
      'MASKED',
      'HIDDEN',
      'REQUIRES_STEP_UP',
      'REQUIRES_BREAK_GLASS',
      'DENIED',
    ],
    associatedRulePacks: ['field-classification-rules'],
    associatedTables: ['field_policies', 'data_classifications', 'actor_roles'],
    invocationPattern: 'SYNC',
    maxDurationMs: 50,
    requiresCountryPolicyPack: false,
    requiresHumanReview: false,
    auditRequired: true,
  };

  async execute(
    input: FieldAccessInput,
    context: EngineContext,
  ): Promise<DecisionRecord> {
    // Stub: real implementation evaluates classification + role matrix.
    const decisionCode: FieldAccessDecisionCode = 'VISIBLE';

    const record: DecisionRecord = {
      decisionId: new Uuid(randomUUID()),
      decisionCode,
      engineName: this.definition.engineName,
      engineVersion: this.definition.engineVersion,
      ruleSetId: 'field-classification-rules',
      ruleSetVersion: '1.0.0',
      explanation:
        `Field "${input.fieldPath}" (classification: ${input.dataClassification}) `
        + `access evaluated for purpose "${input.purpose}". Result: ${decisionCode}.`,
      sourceInputIds: [input.fieldPath],
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
