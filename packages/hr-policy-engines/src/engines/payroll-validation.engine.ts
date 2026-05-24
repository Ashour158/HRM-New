import { randomUUID } from 'node:crypto';
import { Uuid } from '@hcm/shared-kernel';
import type { DecisionRecord } from '../core/decision-record.js';
import type { EngineContext, PolicyEngine, PolicyEngineDefinition } from '../core/engine-definition.js';
import type { CountryPolicyPack } from '../rule-packs/country-policy-pack.js';

/**
 * Decision codes emitted by the Payroll Validation Engine.
 */
export type PayrollValidationDecisionCode =
  | 'VALID'
  | 'INVALID'
  | 'REQUIRES_REVIEW';

/**
 * Input payload for the Payroll Validation Engine.
 */
export interface PayrollValidationInput {
  readonly payrollCycle: Record<string, unknown>;
  readonly payrollInputs: Record<string, unknown>[];
  readonly workerProfiles: Record<string, unknown>[];
  readonly countryPolicyPack: CountryPolicyPack;
}

/**
 * Payroll Validation Engine.
 *
 * Validates payroll inputs for completeness, correctness, and compliance
 * against the active country policy pack. Consumes the
 * `payroll-input-completeness-rules` rule pack.
 */
export class PayrollValidationEngine implements PolicyEngine<PayrollValidationInput, DecisionRecord> {
  readonly definition: PolicyEngineDefinition = {
    engineName: 'payroll-validation',
    engineVersion: '1.4.0',
    description:
      'Validates payroll cycle inputs for completeness, statutory compliance, '
      + 'and cross-worker consistency before finalization.',
    inputTypes: ['PayrollCycle', 'PayrollInput', 'WorkerProfile'],
    outputDecisionCodes: ['VALID', 'INVALID', 'REQUIRES_REVIEW'],
    associatedRulePacks: ['payroll-input-completeness-rules'],
    associatedTables: ['payroll_cycles', 'payroll_inputs', 'workers'],
    invocationPattern: 'SYNC',
    maxDurationMs: 500,
    requiresCountryPolicyPack: true,
    requiresHumanReview: true,
    auditRequired: true,
  };

  async execute(
    input: PayrollValidationInput,
    context: EngineContext,
  ): Promise<DecisionRecord> {
    // Stub: real implementation validates completeness rules.
    const decisionCode: PayrollValidationDecisionCode = 'VALID';

    const record: DecisionRecord = {
      decisionId: new Uuid(randomUUID()),
      decisionCode,
      engineName: this.definition.engineName,
      engineVersion: this.definition.engineVersion,
      ruleSetId: 'payroll-input-completeness-rules',
      ruleSetVersion: '1.0.0',
      explanation:
        `Payroll validation completed for cycle ${String(input.payrollCycle['cycleId'])}. `
        + `Result: ${decisionCode}.`,
      sourceInputIds: input.payrollInputs.map((_, idx) => `input-${idx}`),
      inputSnapshotHash: '<SHA-256>',
      timestamp: new Date(),
      tenantId: context.tenantId,
      actorId: context.actorId,
      correlationId: context.correlationId,
      effectiveDate: context.effectiveDate,
      countryCode: input.countryPolicyPack.countryCode,
    };

    return record;
  }
}
