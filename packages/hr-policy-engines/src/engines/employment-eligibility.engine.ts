import { randomUUID } from 'node:crypto';
import { Uuid } from '@hcm/shared-kernel';
import type { DecisionRecord } from '../core/decision-record.js';
import type { EngineContext, PolicyEngine, PolicyEngineDefinition } from '../core/engine-definition.js';

/**
 * Decision codes emitted by the Employment Eligibility Engine.
 */
export type EmploymentEligibilityDecisionCode =
  | 'ELIGIBLE'
  | 'NOT_ELIGIBLE'
  | 'REQUIRES_WORK_AUTHORIZATION'
  | 'REQUIRES_BACKGROUND_CHECK';

/**
 * Input payload for the Employment Eligibility Engine.
 */
export interface EmploymentEligibilityInput {
  readonly workerProfile: Record<string, unknown>;
  readonly workAuthorization: Record<string, unknown>;
  readonly countryCode: string;
  readonly legalEntityId: string;
}

function str(value: unknown): string | undefined {
  return typeof value === 'string' ? value.toUpperCase() : undefined;
}

/**
 * Pure, deterministic employment-eligibility evaluation. Replaces the previous
 * hardcoded `ELIGIBLE`: work authorization, background-check status, and worker
 * eligibility flags now drive the outcome, failing safe toward NOT_ELIGIBLE.
 */
export function evaluateEmploymentEligibility(input: EmploymentEligibilityInput): {
  decisionCode: EmploymentEligibilityDecisionCode;
  reason: string;
} {
  const auth = input.workAuthorization ?? {};
  const profile = input.workerProfile ?? {};

  // Hard ineligibility flags on the worker profile.
  const profileStatus = str(profile.eligibilityStatus) ?? str(profile.status);
  if (profileStatus === 'INELIGIBLE' || profileStatus === 'BARRED' || profile.eligible === false) {
    return { decisionCode: 'NOT_ELIGIBLE', reason: 'Worker profile is flagged ineligible' };
  }
  if (profile.minimumWorkingAgeMet === false) {
    return { decisionCode: 'NOT_ELIGIBLE', reason: 'Worker is below the minimum working age' };
  }

  // Work authorization must be present and valid (when required for the country).
  const authRequired = profile.requiresWorkAuthorization !== false;
  if (authRequired) {
    const authStatus = str(auth.status);
    const hasAuth = Object.keys(auth).length > 0 && authStatus !== undefined;
    if (!hasAuth || authStatus === 'NONE' || authStatus === 'MISSING') {
      return { decisionCode: 'REQUIRES_WORK_AUTHORIZATION', reason: 'No valid work authorization on file' };
    }
    if (authStatus === 'EXPIRED' || authStatus === 'REVOKED') {
      return { decisionCode: 'REQUIRES_WORK_AUTHORIZATION', reason: `Work authorization is ${authStatus}` };
    }
    const expiresAt = auth.expiresAt ? new Date(auth.expiresAt as string) : undefined;
    if (expiresAt && !Number.isNaN(expiresAt.getTime()) && expiresAt.getTime() <= Date.now()) {
      return { decisionCode: 'REQUIRES_WORK_AUTHORIZATION', reason: 'Work authorization has expired' };
    }
  }

  // Background check (where mandated) must have passed.
  const bgRequired = profile.backgroundCheckRequired === true || auth.backgroundCheckRequired === true;
  const bgStatus = str(profile.backgroundCheckStatus);
  if (bgRequired && bgStatus !== 'PASSED' && bgStatus !== 'CLEARED') {
    return {
      decisionCode: 'REQUIRES_BACKGROUND_CHECK',
      reason: `Background check not cleared (${bgStatus ?? 'NONE'})`,
    };
  }

  return { decisionCode: 'ELIGIBLE', reason: 'All hiring eligibility criteria satisfied' };
}

/**
 * Employment Eligibility Engine.
 *
 * Evaluates whether a candidate or existing worker is eligible for employment
 * under the prevailing hiring rules. Consumes the
 * `global-hiring-eligibility-rules` rule pack.
 */
export class EmploymentEligibilityEngine implements PolicyEngine<EmploymentEligibilityInput, DecisionRecord> {
  readonly definition: PolicyEngineDefinition = {
    engineName: 'employment-eligibility',
    engineVersion: '1.4.0',
    description:
      'Determines whether a worker profile satisfies hiring eligibility criteria '
      + '(background checks, work authorization, legal-entity restrictions).',
    inputTypes: ['WorkerProfile', 'WorkAuthorization'],
    outputDecisionCodes: [
      'ELIGIBLE',
      'NOT_ELIGIBLE',
      'REQUIRES_WORK_AUTHORIZATION',
      'REQUIRES_BACKGROUND_CHECK',
    ],
    associatedRulePacks: ['global-hiring-eligibility-rules'],
    associatedTables: ['workers', 'work_authorizations', 'legal_entities'],
    invocationPattern: 'SYNC',
    maxDurationMs: 200,
    requiresCountryPolicyPack: false,
    requiresHumanReview: false,
    auditRequired: true,
  };

  async execute(
    input: EmploymentEligibilityInput,
    context: EngineContext,
  ): Promise<DecisionRecord> {
    const { decisionCode, reason } = evaluateEmploymentEligibility(input);

    const record: DecisionRecord = {
      decisionId: new Uuid(randomUUID()),
      decisionCode,
      engineName: this.definition.engineName,
      engineVersion: this.definition.engineVersion,
      ruleSetId: 'global-hiring-eligibility-rules',
      ruleSetVersion: '1.0.0',
      explanation:
        `Employment eligibility evaluated for country ${input.countryCode} `
        + `and legal entity ${input.legalEntityId}. Result: ${decisionCode}; ${reason}.`,
      sourceInputIds: [input.legalEntityId],
      inputSnapshotHash: '<SHA-256>',
      timestamp: new Date(),
      tenantId: context.tenantId,
      actorId: context.actorId,
      correlationId: context.correlationId,
      effectiveDate: context.effectiveDate,
      countryCode: input.countryCode,
      legalEntityId: input.legalEntityId,
    };

    return record;
  }
}
