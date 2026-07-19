import { AggregateRoot, DomainEvent, Uuid, ValidationError } from '@hcm/shared-kernel';
import { computeAdverseImpactBiasTest, FOUR_FIFTHS_THRESHOLD, type BiasTestDecisionCode, type BiasTestGroupOutcome } from '../bias-metrics.js';

export type HrAiBiasTestStatus = 'PLANNED' | 'IN_PROGRESS' | 'COMPLETED' | 'FAILED';

export interface HrAiBiasTestProps {
  id: Uuid;
  tenantId: Uuid;
  useCaseId: Uuid;
  testType: string;
  testData?: Record<string, unknown>;
  metrics?: Record<string, unknown>;
  threshold?: number;
  passed?: boolean;
  executedAt?: Date;
  status?: HrAiBiasTestStatus;
  aggregateVersion?: number;
  createdAt?: Date;
  updatedAt?: Date;
}

export class HrAiBiasTestPlanned extends DomainEvent {
  constructor(props: { tenantId: Uuid; aggregateId: Uuid; correlationId: Uuid }) {
    super({ eventName: 'HrAiBiasTestPlanned', tenantId: props.tenantId, aggregateType: 'HrAiBiasTest', aggregateId: props.aggregateId, correlationId: props.correlationId });
  }
}
export class HrAiBiasTestStarted extends DomainEvent {
  constructor(props: { tenantId: Uuid; aggregateId: Uuid; correlationId: Uuid }) {
    super({ eventName: 'HrAiBiasTestStarted', tenantId: props.tenantId, aggregateType: 'HrAiBiasTest', aggregateId: props.aggregateId, correlationId: props.correlationId });
  }
}
export class HrAiBiasTestCompleted extends DomainEvent {
  readonly passed: boolean;
  readonly decisionCode: BiasTestDecisionCode;
  constructor(props: { tenantId: Uuid; aggregateId: Uuid; correlationId: Uuid; passed: boolean; decisionCode: BiasTestDecisionCode }) {
    super({ eventName: 'HrAiBiasTestCompleted', tenantId: props.tenantId, aggregateType: 'HrAiBiasTest', aggregateId: props.aggregateId, correlationId: props.correlationId });
    this.passed = props.passed;
    this.decisionCode = props.decisionCode;
  }
}
export class HrAiBiasTestFailed extends DomainEvent {
  readonly reason: string;
  constructor(props: { tenantId: Uuid; aggregateId: Uuid; correlationId: Uuid; reason: string }) {
    super({ eventName: 'HrAiBiasTestFailed', tenantId: props.tenantId, aggregateType: 'HrAiBiasTest', aggregateId: props.aggregateId, correlationId: props.correlationId });
    this.reason = props.reason;
  }
}

export class HrAiBiasTest extends AggregateRoot {
  readonly tenantId: Uuid;
  useCaseId: Uuid;
  testType: string;
  testData: Record<string, unknown>;
  metrics: Record<string, unknown>;
  threshold: number;
  passed: boolean;
  executedAt?: Date;
  status: HrAiBiasTestStatus;
  createdAt: Date;
  updatedAt: Date;

  get aggregateVersion(): number { return this.version; }

  constructor(props: HrAiBiasTestProps) {
    super(props.id);
    this.tenantId = props.tenantId;
    this.useCaseId = props.useCaseId;
    this.testType = props.testType;
    this.testData = props.testData ?? {};
    this.metrics = props.metrics ?? {};
    // The four-fifths (adverse impact ratio) rule is the standard EEOC screen: a
    // group's selection-rate ratio below 80% of the most-favored group's rate is
    // flagged. (Previously defaulted to 0.05, a leftover from when this field fed
    // no real computation.)
    this.threshold = props.threshold ?? FOUR_FIFTHS_THRESHOLD;
    this.passed = props.passed ?? false;
    this.executedAt = props.executedAt;
    this.status = props.status ?? 'PLANNED';
    this.createdAt = props.createdAt ?? new Date();
    this.updatedAt = props.updatedAt ?? new Date();
    if (props.aggregateVersion !== undefined) this.restoreVersion(props.aggregateVersion);
  }

  static create(props: HrAiBiasTestProps, correlationId: Uuid): HrAiBiasTest {
    const bt = new HrAiBiasTest({ ...props, status: 'PLANNED', createdAt: new Date(), updatedAt: new Date() });
    bt.addDomainEvent(new HrAiBiasTestPlanned({ tenantId: bt.tenantId, aggregateId: bt.id, correlationId }));
    return bt;
  }

  start(correlationId: Uuid): void {
    if (this.status !== 'PLANNED') throw new ValidationError(`Cannot start from state ${this.status}`);
    this.status = 'IN_PROGRESS';
    this.addDomainEvent(new HrAiBiasTestStarted({ tenantId: this.tenantId, aggregateId: this.id, correlationId }));
    this.incrementVersion();
    this.updatedAt = new Date();
  }

  /**
   * Complete the test by independently computing the four-fifths adverse-impact
   * ratio from the submitted per-group outcome counts. `passed`/`metrics` are no
   * longer caller-supplied — the caller can only submit raw outcome data, and
   * the domain determines the verdict. Small subgroups are excluded from the
   * determination and their counts suppressed (see bias-metrics.ts).
   */
  complete(correlationId: Uuid, outcomeData: BiasTestGroupOutcome[]): void {
    if (this.status !== 'IN_PROGRESS') throw new ValidationError(`Cannot complete from state ${this.status}`);
    const computation = computeAdverseImpactBiasTest(outcomeData, { impactRatioThreshold: this.threshold });
    this.status = 'COMPLETED';
    this.passed = computation.passed;
    this.testData = { ...this.testData, outcomeData };
    this.metrics = computation as unknown as Record<string, unknown>;
    this.executedAt = new Date();
    this.addDomainEvent(new HrAiBiasTestCompleted({
      tenantId: this.tenantId,
      aggregateId: this.id,
      correlationId,
      passed: this.passed,
      decisionCode: computation.decisionCode,
    }));
    this.incrementVersion();
    this.updatedAt = new Date();
  }

  fail(correlationId: Uuid, reason: string): void {
    if (!['PLANNED', 'IN_PROGRESS'].includes(this.status)) throw new ValidationError(`Cannot fail from state ${this.status}`);
    this.status = 'FAILED';
    this.addDomainEvent(new HrAiBiasTestFailed({ tenantId: this.tenantId, aggregateId: this.id, correlationId, reason }));
    this.incrementVersion();
    this.updatedAt = new Date();
  }
}
