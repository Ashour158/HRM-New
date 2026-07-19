import { randomUUID } from 'node:crypto';
import { Uuid } from '@hcm/shared-kernel';
import type { DecisionRecord } from '../core/decision-record.js';
import type { EngineContext, PolicyEngine, PolicyEngineDefinition } from '../core/engine-definition.js';

/**
 * DEI, Pay Transparency & People Analytics Engine — evaluates an already
 * *computed* pay-gap / people-analytics report for compliance, rather than
 * computing the report itself (that is the responsibility of the owning
 * app's aggregation pipeline, e.g. `apps/hr-api`'s `PayGapCalculationService`
 * feeding `PayGapReport.calculate()`). This engine is the fixed downstream
 * policy check: is the sample large enough to be statistically/legally
 * meaningful, is small-cell suppression actually present, and does the
 * reported gap warrant human review before publication.
 *
 * Replaces the previous metadata-only `dei-pay-transparency-people-analytics`
 * registration that had no execute(). Pure + deterministic; no I/O.
 */
export type DeiPayTransparencyDecisionCode = 'COMPLIANT' | 'NON_COMPLIANT' | 'REQUIRES_REVIEW';

export interface DeiPayTransparencyInput {
  readonly reportType: string;
  readonly meanHourlyGapPct: number;
  readonly medianHourlyGapPct: number;
  readonly totalWorkersIncluded: number;
  /** Quartile/segment breakdown containing `count`/`headcount` cells, as produced by the aggregation pipeline. */
  readonly quartileDistribution: Record<string, unknown>;
  /** Minimum cell size below which a `count`/`headcount` cell must be suppressed. */
  readonly aggregationThreshold: number;
  /** Absolute gap percentage above which the report requires human review before publication (default 5%). */
  readonly materialityThresholdPct?: number;
}

export interface DeiPayTransparencyViolation {
  readonly code: string;
  readonly severity: 'BLOCKING' | 'WARNING';
  readonly message: string;
}

export interface DeiPayTransparencyResult {
  readonly decisionCode: DeiPayTransparencyDecisionCode;
  readonly violations: DeiPayTransparencyViolation[];
}

const DEFAULT_MATERIALITY_THRESHOLD_PCT = 5;
const SUPPRESSIBLE_COUNT_KEYS = new Set(['count', 'headcount']);

/**
 * Recursively scans a quartile/segment distribution for `count`/`headcount`
 * cells that are still raw numbers below the aggregation threshold — i.e.
 * cells that k-anonymity suppression should have replaced but did not. This
 * mirrors (independently, since this package must not depend on the
 * consuming app) the suppression rule applied upstream by the DEI domain's
 * `applyKAnonymitySuppression` utility, acting as a defense-in-depth check:
 * a suppressed cell is a non-numeric sentinel (e.g. `'SUPPRESSED'`) and is
 * therefore never flagged here.
 */
function findUnsuppressedSmallCells(data: unknown, threshold: number, path = ''): string[] {
  if (Array.isArray(data)) {
    return data.flatMap((item, index) => findUnsuppressedSmallCells(item, threshold, `${path}[${index}]`));
  }
  if (data && typeof data === 'object') {
    const obj = data as Record<string, unknown>;
    return Object.entries(obj).flatMap(([key, value]) => {
      const fieldPath = path ? `${path}.${key}` : key;
      if (SUPPRESSIBLE_COUNT_KEYS.has(key) && typeof value === 'number' && value < threshold) {
        return [fieldPath];
      }
      return findUnsuppressedSmallCells(value, threshold, fieldPath);
    });
  }
  return [];
}

/**
 * Deterministically evaluate a computed pay-gap / people-analytics report.
 * BLOCKING violations (sample too small, no quartile data, un-suppressed
 * small cells) -> NON_COMPLIANT; WARNING violations (gap exceeds the
 * materiality threshold) -> REQUIRES_REVIEW; otherwise COMPLIANT.
 */
export function evaluateDeiPayTransparency(input: DeiPayTransparencyInput): DeiPayTransparencyResult {
  const violations: DeiPayTransparencyViolation[] = [];
  const threshold = input.aggregationThreshold;

  if (!Number.isFinite(input.totalWorkersIncluded) || input.totalWorkersIncluded < threshold) {
    violations.push({
      code: 'INSUFFICIENT_SAMPLE_SIZE',
      severity: 'BLOCKING',
      message: `Report covers ${input.totalWorkersIncluded} worker(s), below the aggregation threshold of ${threshold}; publishing would risk re-identification.`,
    });
  }

  const hasQuartileData = input.quartileDistribution && Object.keys(input.quartileDistribution).length > 0;
  if (!hasQuartileData) {
    violations.push({
      code: 'MISSING_QUARTILE_DISTRIBUTION',
      severity: 'BLOCKING',
      message: 'Report has no quartile distribution; pay-transparency regulations require quartile representation by group.',
    });
  } else {
    const unsuppressed = findUnsuppressedSmallCells(input.quartileDistribution, threshold);
    for (const fieldPath of unsuppressed) {
      violations.push({
        code: 'UNSUPPRESSED_SMALL_CELL',
        severity: 'BLOCKING',
        message: `Cell "${fieldPath}" is below the aggregation threshold of ${threshold} but was not suppressed.`,
      });
    }
  }

  const materialityThresholdPct = input.materialityThresholdPct ?? DEFAULT_MATERIALITY_THRESHOLD_PCT;
  if (Math.abs(input.meanHourlyGapPct) > materialityThresholdPct) {
    violations.push({
      code: 'MEAN_GAP_EXCEEDS_MATERIALITY_THRESHOLD',
      severity: 'WARNING',
      message: `Mean hourly gap ${input.meanHourlyGapPct}% exceeds the ${materialityThresholdPct}% materiality threshold; requires review before publication.`,
    });
  }
  if (Math.abs(input.medianHourlyGapPct) > materialityThresholdPct) {
    violations.push({
      code: 'MEDIAN_GAP_EXCEEDS_MATERIALITY_THRESHOLD',
      severity: 'WARNING',
      message: `Median hourly gap ${input.medianHourlyGapPct}% exceeds the ${materialityThresholdPct}% materiality threshold; requires review before publication.`,
    });
  }

  const hasBlocking = violations.some((v) => v.severity === 'BLOCKING');
  const hasWarning = violations.some((v) => v.severity === 'WARNING');
  const decisionCode: DeiPayTransparencyDecisionCode = hasBlocking
    ? 'NON_COMPLIANT'
    : hasWarning
      ? 'REQUIRES_REVIEW'
      : 'COMPLIANT';

  return { decisionCode, violations };
}

export class DeiPayTransparencyEngine implements PolicyEngine<DeiPayTransparencyInput, DecisionRecord> {
  readonly definition: PolicyEngineDefinition = {
    engineName: 'dei-pay-transparency-people-analytics',
    engineVersion: '1.4.0',
    description:
      'Checks pay-transparency reports and people-analytics outputs for DEI compliance.',
    inputTypes: ['PayTransparencyReport', 'DeiMetric', 'AnalyticsQuery'],
    outputDecisionCodes: ['COMPLIANT', 'NON_COMPLIANT', 'REQUIRES_REVIEW'],
    associatedRulePacks: ['dei-pay-transparency-rules'],
    associatedTables: ['pay_transparency_reports', 'dei_metrics'],
    invocationPattern: 'ASYNC',
    maxDurationMs: 3000,
    requiresCountryPolicyPack: true,
    requiresHumanReview: true,
    auditRequired: true,
  };

  async execute(input: DeiPayTransparencyInput, context: EngineContext): Promise<DecisionRecord> {
    const result = evaluateDeiPayTransparency(input);

    return {
      decisionId: new Uuid(randomUUID()),
      decisionCode: result.decisionCode,
      engineName: this.definition.engineName,
      engineVersion: this.definition.engineVersion,
      ruleSetId: 'dei-pay-transparency-rules',
      ruleSetVersion: '1.0.0',
      explanation:
        `${input.reportType} report covering ${input.totalWorkersIncluded} worker(s) evaluated `
        + `(mean gap=${input.meanHourlyGapPct}%, median gap=${input.medianHourlyGapPct}%). `
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
