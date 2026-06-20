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

/** Roles trusted to see sensitive HR data in the clear. */
const PRIVILEGED_HR_ROLES = new Set([
  'SUPER_ADMIN',
  'PLATFORM_ADMIN',
  'APP_ADMIN',
  'HR_ADMIN',
  'HRBP',
  'PAYROLL_ADMIN',
  'COMPENSATION_ADMIN',
]);

/** Roles permitted to view special-category (health) data. */
const SPECIAL_CATEGORY_ROLES = new Set([
  'SUPER_ADMIN',
  'WELLBEING_ADMIN',
  'EAP_ADMIN',
  'OCCUPATIONAL_HEALTH',
]);

function normalizeClassification(value: string): string {
  return value.trim().toUpperCase().replace(/[\s-]+/g, '_');
}

/**
 * Pure, deterministic field-access resolution. Replaces the previous hardcoded
 * `VISIBLE`: classification + roles + declared purpose now drive the outcome,
 * failing safe (HIDDEN/DENIED) when access is not justified.
 */
export function evaluateFieldAccess(input: FieldAccessInput): {
  decisionCode: FieldAccessDecisionCode;
  reason: string;
} {
  const classification = normalizeClassification(input.dataClassification);
  const roles = new Set(input.actorRoles.map((r) => r.toUpperCase()));
  const hasPrivileged = [...roles].some((r) => PRIVILEGED_HR_ROLES.has(r));
  const hasPurpose = Boolean(input.purpose && input.purpose.trim() && input.purpose.toUpperCase() !== 'NONE');
  const stepUpSatisfied = input.abacContext.mfaAuthenticated === true || input.abacContext.stepUpSatisfied === true;
  const breakGlassActive = Boolean(input.abacContext.breakGlassSessionId) || input.abacContext.breakGlass === true;

  // Public / internal data is broadly visible.
  if (classification === 'PUBLIC' || classification === 'INTERNAL' || classification === 'LOW') {
    return { decisionCode: 'VISIBLE', reason: `${classification} data is visible` };
  }

  // Special-category (health) data: most protected.
  if (classification === 'SPECIAL_CATEGORY') {
    const allowed = [...roles].some((r) => SPECIAL_CATEGORY_ROLES.has(r));
    if (!hasPurpose) return { decisionCode: 'DENIED', reason: 'No legitimate purpose for special-category data' };
    if (!allowed) return { decisionCode: 'REQUIRES_BREAK_GLASS', reason: 'Special-category access requires break-glass' };
    if (breakGlassActive) return { decisionCode: 'VISIBLE', reason: 'Authorised role with active break-glass' };
    if (!stepUpSatisfied) return { decisionCode: 'REQUIRES_STEP_UP', reason: 'Step-up authentication required' };
    return { decisionCode: 'VISIBLE', reason: 'Authorised special-category role with step-up' };
  }

  // Confidential / high-sensitivity / restricted (e.g. salary, SSN).
  if (!hasPurpose) {
    return { decisionCode: 'DENIED', reason: `No declared purpose for ${classification} data` };
  }
  if (hasPrivileged) {
    if ((classification === 'HIGH_SENSITIVITY' || classification === 'RESTRICTED') && !stepUpSatisfied) {
      return { decisionCode: 'REQUIRES_STEP_UP', reason: 'Step-up required for highly sensitive data' };
    }
    return { decisionCode: 'VISIBLE', reason: 'Privileged role with declared purpose' };
  }
  // Non-privileged actors get a masked or hidden view.
  if (classification === 'CONFIDENTIAL') {
    return { decisionCode: 'MASKED', reason: 'Non-privileged actor sees masked confidential data' };
  }
  return { decisionCode: 'HIDDEN', reason: `Non-privileged actor cannot view ${classification} data` };
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
    const { decisionCode, reason } = evaluateFieldAccess(input);

    const record: DecisionRecord = {
      decisionId: new Uuid(randomUUID()),
      decisionCode,
      engineName: this.definition.engineName,
      engineVersion: this.definition.engineVersion,
      ruleSetId: 'field-classification-rules',
      ruleSetVersion: '1.0.0',
      explanation:
        `Field "${input.fieldPath}" (classification: ${input.dataClassification}) `
        + `access evaluated for purpose "${input.purpose}". Result: ${decisionCode}; ${reason}.`,
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
