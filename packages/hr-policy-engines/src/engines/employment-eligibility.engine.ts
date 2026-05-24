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
    // Stub: real implementation loads the rule pack and evaluates conditions.
    const decisionCode: EmploymentEligibilityDecisionCode = 'ELIGIBLE';

    const record: DecisionRecord = {
      decisionId: new Uuid(randomUUID()),
      decisionCode,
      engineName: this.definition.engineName,
      engineVersion: this.definition.engineVersion,
      ruleSetId: 'global-hiring-eligibility-rules',
      ruleSetVersion: '1.0.0',
      explanation:
        `Employment eligibility evaluated for country ${input.countryCode} `
        + `and legal entity ${input.legalEntityId}. Result: ${decisionCode}.`,
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
