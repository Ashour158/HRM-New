import { AggregateRoot, DomainEvent, Uuid, ValidationError } from '@hcm/shared-kernel';
import type { AdverseImpactAnalysisResult, EeoDemographicDimension } from '@hcm/policy-engines';
import { applyKAnonymitySuppression } from '../../dei-analytics/aggregates/k-anonymity.js';

export type RequisitionAdverseImpactAnalysisStatus = 'ANALYZED' | 'REVIEWED';

export interface RequisitionAdverseImpactAnalysisProps {
  id: Uuid;
  tenantId: Uuid;
  requisitionId: Uuid;
  dimension: EeoDemographicDimension;
  decisionCode: string;
  flaggedStageCount: number;
  smallCellThreshold: number;
  /** k-anonymity-suppressed, group-level stage results. Never individual candidate data. */
  stageResults: Record<string, unknown>;
  status?: RequisitionAdverseImpactAnalysisStatus;
  reviewedBy?: Uuid;
  reviewedAt?: Date;
  reviewNotes?: string;
  aggregateVersion?: number;
  createdAt?: Date;
  updatedAt?: Date;
}

export class RequisitionAdverseImpactAnalysisCreated extends DomainEvent {
  readonly requisitionId: string;
  readonly decisionCode: string;

  constructor(props: { tenantId: Uuid; aggregateId: Uuid; correlationId: Uuid; requisitionId: Uuid; decisionCode: string }) {
    super({
      eventName: 'RequisitionAdverseImpactAnalysisCreated',
      tenantId: props.tenantId,
      aggregateType: 'RequisitionAdverseImpactAnalysis',
      aggregateId: props.aggregateId,
      correlationId: props.correlationId,
    });
    this.requisitionId = props.requisitionId.value;
    this.decisionCode = props.decisionCode;
  }
}

export class RequisitionAdverseImpactAnalysisReviewed extends DomainEvent {
  constructor(props: { tenantId: Uuid; aggregateId: Uuid; correlationId: Uuid }) {
    super({
      eventName: 'RequisitionAdverseImpactAnalysisReviewed',
      tenantId: props.tenantId,
      aggregateType: 'RequisitionAdverseImpactAnalysis',
      aggregateId: props.aggregateId,
      correlationId: props.correlationId,
    });
  }
}

/**
 * RequisitionAdverseImpactAnalysis aggregate root.
 *
 * Persists a single, auditable EEOC 4/5ths-rule adverse-impact analysis run
 * for a job requisition's candidate funnel (see
 * `@hcm/policy-engines` `RecruitingFairnessComplianceEngine`).
 *
 * Lifecycle: ANALYZED → REVIEWED (terminal — a compliance officer / HR admin
 * has acknowledged the findings; matches this engine's
 * `requiresHumanReview: true` declaration).
 *
 * `stageResults` NEVER holds individual candidate or demographic identity
 * data — only group-level counts and rates, with any group below the
 * small-cell threshold suppressed via the platform's shared k-anonymity
 * utility (reused here, not reimplemented — see dei-analytics/aggregates/k-anonymity.ts,
 * already used by DeiReport, PayGapReport, PayEquityReview, and
 * AttritionSegmentReport).
 */
export class RequisitionAdverseImpactAnalysis extends AggregateRoot {
  readonly tenantId: Uuid;
  readonly requisitionId: Uuid;
  readonly dimension: EeoDemographicDimension;
  decisionCode: string;
  flaggedStageCount: number;
  smallCellThreshold: number;
  stageResults: Record<string, unknown>;
  status: RequisitionAdverseImpactAnalysisStatus;
  reviewedBy?: Uuid;
  reviewedAt?: Date;
  reviewNotes?: string;
  createdAt: Date;
  updatedAt: Date;

  get aggregateVersion(): number {
    return this.version;
  }

  constructor(props: RequisitionAdverseImpactAnalysisProps) {
    super(props.id);
    this.tenantId = props.tenantId;
    this.requisitionId = props.requisitionId;
    this.dimension = props.dimension;
    this.decisionCode = props.decisionCode;
    this.flaggedStageCount = props.flaggedStageCount;
    this.smallCellThreshold = props.smallCellThreshold;
    this.stageResults = props.stageResults;
    this.status = props.status ?? 'ANALYZED';
    this.reviewedBy = props.reviewedBy;
    this.reviewedAt = props.reviewedAt;
    this.reviewNotes = props.reviewNotes;
    this.createdAt = props.createdAt ?? new Date();
    this.updatedAt = props.updatedAt ?? new Date();
    if (props.aggregateVersion !== undefined) this.restoreVersion(props.aggregateVersion);
  }

  /**
   * Create a new analysis record from a completed engine evaluation. The raw
   * engine result is reshaped so any `count` leaves below the small-cell
   * threshold get suppressed by {@link applyKAnonymitySuppression} before
   * this ever touches storage or an API response.
   */
  static analyze(
    props: {
      id: Uuid;
      tenantId: Uuid;
      requisitionId: Uuid;
      result: AdverseImpactAnalysisResult;
    },
    correlationId: Uuid,
  ): RequisitionAdverseImpactAnalysis {
    const suppressible = toSuppressibleStageResults(props.result);
    const stageResults = applyKAnonymitySuppression(
      suppressible,
      props.result.smallCellThreshold,
    ) as Record<string, unknown>;

    const analysis = new RequisitionAdverseImpactAnalysis({
      id: props.id,
      tenantId: props.tenantId,
      requisitionId: props.requisitionId,
      dimension: props.result.dimension,
      decisionCode: props.result.decisionCode,
      flaggedStageCount: props.result.flaggedStageCount,
      smallCellThreshold: props.result.smallCellThreshold,
      stageResults,
      status: 'ANALYZED',
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    analysis.addDomainEvent(
      new RequisitionAdverseImpactAnalysisCreated({
        tenantId: analysis.tenantId,
        aggregateId: analysis.id,
        correlationId,
        requisitionId: analysis.requisitionId,
        decisionCode: analysis.decisionCode,
      }),
    );

    return analysis;
  }

  /**
   * Mark the analysis as reviewed by a compliance officer / HR admin.
   * ANALYZED → REVIEWED (terminal)
   */
  review(reviewedBy: Uuid, correlationId: Uuid, reviewNotes?: string): void {
    if (this.status !== 'ANALYZED') {
      throw new ValidationError(`Cannot review adverse-impact analysis from state ${this.status}`);
    }
    this.status = 'REVIEWED';
    this.reviewedBy = reviewedBy;
    this.reviewedAt = new Date();
    this.reviewNotes = reviewNotes;
    this.addDomainEvent(
      new RequisitionAdverseImpactAnalysisReviewed({
        tenantId: this.tenantId,
        aggregateId: this.id,
        correlationId,
      }),
    );
    this.incrementVersion();
    this.updatedAt = new Date();
  }
}

/**
 * Reshape the engine's typed result into a plain JSON structure whose raw
 * count leaves are wrapped as `{ count: n }` so the shared, generic
 * `applyKAnonymitySuppression` recursor (which matches on the literal key
 * name `count`/`headcount`) suppresses them without any bespoke logic here.
 */
function toSuppressibleStageResults(result: AdverseImpactAnalysisResult): Record<string, unknown> {
  return {
    dimension: result.dimension,
    smallCellThreshold: result.smallCellThreshold,
    stages: result.stages.map((stage) => ({
      stageName: stage.stageName,
      benchmarkGroup: stage.benchmarkGroup,
      benchmarkSelectionRate: stage.benchmarkSelectionRate,
      sufficientDataForComparison: stage.sufficientDataForComparison,
      flaggedGroups: stage.flaggedGroups,
      groups: stage.groups.map((group) => ({
        group: group.group,
        consideredCount: { count: group.consideredCount },
        advancedCount: { count: group.advancedCount },
        insufficientData: group.insufficientData,
        selectionRate: group.selectionRate,
        impactRatio: group.impactRatio,
        adverseImpactFlag: group.adverseImpactFlag,
      })),
    })),
  };
}
