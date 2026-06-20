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

export interface PayrollValidationViolation {
  readonly code: string;
  readonly severity: 'ERROR' | 'WARNING';
  readonly message: string;
}

export interface PayrollValidationResult {
  readonly decisionCode: PayrollValidationDecisionCode;
  readonly violations: PayrollValidationViolation[];
}

function num(value: unknown): number | undefined {
  return typeof value === 'number' && !Number.isNaN(value) ? value : undefined;
}

function idOf(record: Record<string, unknown>): string | undefined {
  const v = record.workerId ?? record.worker_id;
  if (typeof v === 'string') return v;
  if (v && typeof v === 'object' && typeof (v as { value?: unknown }).value === 'string') {
    return (v as { value: string }).value;
  }
  return undefined;
}

/**
 * Pure, deterministic payroll-input validation. Replaces the previous hardcoded
 * `VALID`: completeness (every worker has an input), per-input required fields,
 * non-negative gross, and country/pack consistency now drive the outcome.
 */
export function evaluatePayrollValidation(input: PayrollValidationInput): PayrollValidationResult {
  const violations: PayrollValidationViolation[] = [];
  const inputs = input.payrollInputs ?? [];
  const workers = input.workerProfiles ?? [];

  if (inputs.length === 0) {
    violations.push({ code: 'NO_PAYROLL_INPUTS', severity: 'ERROR', message: 'Payroll cycle has no inputs.' });
  }

  // Completeness: every worker in the cycle must have a payroll input.
  const inputWorkerIds = new Set(inputs.map((i) => idOf(i)).filter((v): v is string => Boolean(v)));
  for (const w of workers) {
    const wid = idOf(w);
    if (wid && !inputWorkerIds.has(wid)) {
      violations.push({
        code: 'MISSING_WORKER_INPUT',
        severity: 'ERROR',
        message: `Worker ${wid} has no payroll input.`,
      });
    }
  }

  // Per-input field-level validation.
  inputs.forEach((row, idx) => {
    if (!idOf(row)) {
      violations.push({ code: 'INPUT_MISSING_WORKER', severity: 'ERROR', message: `Input #${idx} has no workerId.` });
    }
    const gross = num(row.grossAmount ?? row.gross ?? row.grossPay);
    if (gross === undefined) {
      violations.push({ code: 'INPUT_MISSING_GROSS', severity: 'ERROR', message: `Input #${idx} has no gross amount.` });
    } else if (gross < 0) {
      violations.push({ code: 'INPUT_NEGATIVE_GROSS', severity: 'ERROR', message: `Input #${idx} has a negative gross amount.` });
    }
  });

  // Country-policy consistency.
  const cycleCountry = typeof input.payrollCycle?.countryCode === 'string'
    ? (input.payrollCycle.countryCode as string)
    : undefined;
  if (cycleCountry && input.countryPolicyPack?.countryCode && cycleCountry !== input.countryPolicyPack.countryCode) {
    violations.push({
      code: 'COUNTRY_MISMATCH',
      severity: 'ERROR',
      message: `Cycle country ${cycleCountry} does not match policy pack ${input.countryPolicyPack.countryCode}.`,
    });
  }
  if (input.countryPolicyPack && input.countryPolicyPack.status !== 'PUBLISHED') {
    violations.push({
      code: 'POLICY_PACK_NOT_PUBLISHED',
      severity: 'WARNING',
      message: `Country policy pack is ${input.countryPolicyPack.status}, not PUBLISHED.`,
    });
  }

  const hasError = violations.some((v) => v.severity === 'ERROR');
  const hasWarning = violations.some((v) => v.severity === 'WARNING');
  const decisionCode: PayrollValidationDecisionCode = hasError
    ? 'INVALID'
    : hasWarning
      ? 'REQUIRES_REVIEW'
      : 'VALID';
  return { decisionCode, violations };
}
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
    const { decisionCode, violations } = evaluatePayrollValidation(input);

    const record: DecisionRecord = {
      decisionId: new Uuid(randomUUID()),
      decisionCode,
      engineName: this.definition.engineName,
      engineVersion: this.definition.engineVersion,
      ruleSetId: 'payroll-input-completeness-rules',
      ruleSetVersion: '1.0.0',
      explanation:
        `Payroll validation completed for cycle ${String(input.payrollCycle['cycleId'])}. `
        + `Result: ${decisionCode}`
        + (violations.length ? `; ${violations.map((v) => v.code).join(', ')}.` : '.'),
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
