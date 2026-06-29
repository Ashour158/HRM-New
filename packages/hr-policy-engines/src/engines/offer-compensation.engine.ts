import { randomUUID } from 'node:crypto';
import { Uuid } from '@hcm/shared-kernel';
import type { DecisionRecord } from '../core/decision-record.js';
import type { EngineContext, PolicyEngine, PolicyEngineDefinition } from '../core/engine-definition.js';

/**
 * Offer Compensation Engine — validates a proposed offer package against its
 * compensation band, statutory minimum, and an optional pay-equity benchmark, and
 * computes the standard placement metrics (compa-ratio, range penetration).
 *
 * Replaces the previous metadata-only `offer-compensation` registration that had no
 * execute() — offers were created (recruiting CreateOffer) with no band/equity check.
 * Pure + deterministic; no I/O.
 */
export type OfferCompensationDecisionCode = 'APPROVED' | 'REJECTED' | 'CONDITIONAL';

export interface CompensationBandRange {
  readonly minSalary: number;
  readonly midSalary: number;
  readonly maxSalary: number;
  readonly currency?: string;
}

export interface PayEquityBenchmark {
  /** Median pay of the comparable cohort, same currency as the offer. */
  readonly comparableMedian: number;
  /** Max allowed absolute deviation from the median, as a fraction (e.g. 0.15 = 15%). */
  readonly maxDeviationPct: number;
}

export interface OfferCompensationInput {
  readonly proposedSalary: number;
  readonly currency: string;
  readonly band: CompensationBandRange;
  /** Statutory/legal minimum for the jurisdiction, if known (same currency). */
  readonly statutoryMinimum?: number;
  readonly payEquity?: PayEquityBenchmark;
}

export interface OfferCompensationViolation {
  readonly code: string;
  readonly severity: 'BLOCKING' | 'WARNING';
  readonly message: string;
}

export interface OfferCompensationResult {
  readonly decisionCode: OfferCompensationDecisionCode;
  /** proposedSalary / midSalary, rounded to 4 dp (undefined when midSalary <= 0). */
  readonly compaRatio?: number;
  /** (proposedSalary - min) / (max - min), 0..1+ (undefined when max <= min). */
  readonly rangePenetration?: number;
  readonly violations: OfferCompensationViolation[];
}

function round(value: number, dp: number): number {
  const f = 10 ** dp;
  return Math.round(value * f) / f;
}

/**
 * Deterministically evaluate an offer against its band. BLOCKING violations
 * (invalid band, currency mismatch, below statutory minimum) → REJECTED; WARNING
 * violations (outside band, pay-equity deviation) → CONDITIONAL (human approval);
 * otherwise APPROVED.
 */
export function evaluateOfferCompensation(input: OfferCompensationInput): OfferCompensationResult {
  const violations: OfferCompensationViolation[] = [];
  const { proposedSalary, band } = input;

  const bandValid =
    Number.isFinite(band.minSalary) &&
    Number.isFinite(band.midSalary) &&
    Number.isFinite(band.maxSalary) &&
    band.minSalary <= band.midSalary &&
    band.midSalary <= band.maxSalary &&
    band.minSalary >= 0;

  if (!bandValid) {
    violations.push({ code: 'INVALID_BAND', severity: 'BLOCKING', message: 'Compensation band is missing or non-monotonic (min <= mid <= max required).' });
  }

  if (!Number.isFinite(proposedSalary) || proposedSalary <= 0) {
    violations.push({ code: 'INVALID_SALARY', severity: 'BLOCKING', message: 'Proposed salary must be a positive number.' });
  }

  if (band.currency && input.currency && band.currency !== input.currency) {
    violations.push({ code: 'CURRENCY_MISMATCH', severity: 'BLOCKING', message: `Offer currency ${input.currency} does not match band currency ${band.currency}.` });
  }

  if (input.statutoryMinimum !== undefined && proposedSalary < input.statutoryMinimum) {
    violations.push({ code: 'BELOW_STATUTORY_MINIMUM', severity: 'BLOCKING', message: `Proposed salary ${proposedSalary} is below the statutory minimum ${input.statutoryMinimum}.` });
  }

  const compaRatio = bandValid && band.midSalary > 0 ? round(proposedSalary / band.midSalary, 4) : undefined;
  const rangePenetration =
    bandValid && band.maxSalary > band.minSalary
      ? round((proposedSalary - band.minSalary) / (band.maxSalary - band.minSalary), 4)
      : undefined;

  if (bandValid) {
    if (proposedSalary < band.minSalary) {
      violations.push({ code: 'BELOW_BAND_MINIMUM', severity: 'WARNING', message: `Proposed salary ${proposedSalary} is below band minimum ${band.minSalary}; requires approval.` });
    } else if (proposedSalary > band.maxSalary) {
      violations.push({ code: 'ABOVE_BAND_MAXIMUM', severity: 'WARNING', message: `Proposed salary ${proposedSalary} exceeds band maximum ${band.maxSalary}; requires approval.` });
    }
  }

  if (input.payEquity && input.payEquity.comparableMedian > 0) {
    const deviation = Math.abs(proposedSalary - input.payEquity.comparableMedian) / input.payEquity.comparableMedian;
    if (deviation > input.payEquity.maxDeviationPct) {
      violations.push({
        code: 'PAY_EQUITY_DEVIATION',
        severity: 'WARNING',
        message: `Proposed salary deviates ${round(deviation * 100, 2)}% from the comparable median, beyond the ${round(input.payEquity.maxDeviationPct * 100, 2)}% threshold.`,
      });
    }
  }

  const hasBlocking = violations.some((v) => v.severity === 'BLOCKING');
  const hasWarning = violations.some((v) => v.severity === 'WARNING');
  const decisionCode: OfferCompensationDecisionCode = hasBlocking ? 'REJECTED' : hasWarning ? 'CONDITIONAL' : 'APPROVED';

  return { decisionCode, compaRatio, rangePenetration, violations };
}

export class OfferCompensationEngine implements PolicyEngine<OfferCompensationInput, DecisionRecord> {
  readonly definition: PolicyEngineDefinition = {
    engineName: 'offer-compensation',
    engineVersion: '1.4.0',
    description:
      'Validates offer packages against compensation bands, pay-equity policies, '
      + 'and statutory minimums; computes compa-ratio and range penetration.',
    inputTypes: ['OfferPackage', 'CompensationBand', 'PayEquityReport'],
    outputDecisionCodes: ['APPROVED', 'REJECTED', 'CONDITIONAL'],
    associatedRulePacks: ['compensation-band-rules', 'pay-equity-rules'],
    associatedTables: ['offers', 'compensation_bands', 'pay_equity_reports'],
    invocationPattern: 'SYNC',
    maxDurationMs: 300,
    requiresCountryPolicyPack: true,
    requiresHumanReview: true,
    auditRequired: true,
  };

  async execute(input: OfferCompensationInput, context: EngineContext): Promise<DecisionRecord> {
    const result = evaluateOfferCompensation(input);
    return {
      decisionId: new Uuid(randomUUID()),
      decisionCode: result.decisionCode,
      engineName: this.definition.engineName,
      engineVersion: this.definition.engineVersion,
      ruleSetId: 'compensation-band-rules',
      ruleSetVersion: '1.0.0',
      explanation:
        `Offer ${input.proposedSalary} ${input.currency} evaluated against band `
        + `[${input.band.minSalary}/${input.band.midSalary}/${input.band.maxSalary}]. `
        + `compa-ratio=${result.compaRatio ?? 'n/a'}, penetration=${result.rangePenetration ?? 'n/a'}. `
        + `Result: ${result.decisionCode}`
        + (result.violations.length ? `; ${result.violations.map((v) => v.code).join(', ')}.` : '.'),
      sourceInputIds: [],
      inputSnapshotHash: '<SHA-256>',
      timestamp: new Date(),
      tenantId: context.tenantId,
      actorId: context.actorId,
      correlationId: context.correlationId,
      effectiveDate: context.effectiveDate,
      countryCode: context.countryCode,
    };
  }
}
