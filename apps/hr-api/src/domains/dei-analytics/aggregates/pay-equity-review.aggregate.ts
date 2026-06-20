import { AggregateRoot, DomainEvent, Uuid, ValidationError } from '@hcm/shared-kernel';
import { applyKAnonymitySuppression, DEFAULT_AGGREGATION_THRESHOLD } from './k-anonymity.js';

export type PayEquityReviewStatus = 'PLANNED' | 'IN_PROGRESS' | 'FINDINGS' | 'REMEDIATION' | 'CLOSED';

export interface PayEquityReviewProps {
  id: Uuid;
  tenantId: Uuid;
  reviewName: string;
  reviewPeriod: string;
  scope?: Record<string, unknown>;
  findings?: Record<string, unknown>;
  remediationActions?: Record<string, unknown>;
  completedActions?: Record<string, unknown>;
  status?: PayEquityReviewStatus;
  aggregateVersion?: number;
  createdAt?: Date;
  updatedAt?: Date;
}

export class PayEquityReviewPlanned extends DomainEvent {
  constructor(props: { tenantId: Uuid; aggregateId: Uuid; correlationId: Uuid }) {
    super({ eventName: 'PayEquityReviewPlanned', tenantId: props.tenantId, aggregateType: 'PayEquityReview', aggregateId: props.aggregateId, correlationId: props.correlationId });
  }
}
export class PayEquityReviewStarted extends DomainEvent {
  constructor(props: { tenantId: Uuid; aggregateId: Uuid; correlationId: Uuid }) {
    super({ eventName: 'PayEquityReviewStarted', tenantId: props.tenantId, aggregateType: 'PayEquityReview', aggregateId: props.aggregateId, correlationId: props.correlationId });
  }
}
export class PayEquityReviewFindings extends DomainEvent {
  constructor(props: { tenantId: Uuid; aggregateId: Uuid; correlationId: Uuid }) {
    super({ eventName: 'PayEquityReviewFindings', tenantId: props.tenantId, aggregateType: 'PayEquityReview', aggregateId: props.aggregateId, correlationId: props.correlationId });
  }
}
export class PayEquityReviewRemediation extends DomainEvent {
  constructor(props: { tenantId: Uuid; aggregateId: Uuid; correlationId: Uuid }) {
    super({ eventName: 'PayEquityReviewRemediation', tenantId: props.tenantId, aggregateType: 'PayEquityReview', aggregateId: props.aggregateId, correlationId: props.correlationId });
  }
}
export class PayEquityReviewClosed extends DomainEvent {
  constructor(props: { tenantId: Uuid; aggregateId: Uuid; correlationId: Uuid }) {
    super({ eventName: 'PayEquityReviewClosed', tenantId: props.tenantId, aggregateType: 'PayEquityReview', aggregateId: props.aggregateId, correlationId: props.correlationId });
  }
}

export class PayEquityReview extends AggregateRoot {
  readonly tenantId: Uuid;
  reviewName: string;
  reviewPeriod: string;
  scope: Record<string, unknown>;
  findings: Record<string, unknown>;
  remediationActions: Record<string, unknown>;
  completedActions: Record<string, unknown>;
  status: PayEquityReviewStatus;
  createdAt: Date;
  updatedAt: Date;

  get aggregateVersion(): number { return this.version; }

  constructor(props: PayEquityReviewProps) {
    super(props.id);
    this.tenantId = props.tenantId;
    this.reviewName = props.reviewName;
    this.reviewPeriod = props.reviewPeriod;
    this.scope = props.scope ?? {};
    this.findings = props.findings ?? {};
    this.remediationActions = props.remediationActions ?? {};
    this.completedActions = props.completedActions ?? {};
    this.status = props.status ?? 'PLANNED';
    this.createdAt = props.createdAt ?? new Date();
    this.updatedAt = props.updatedAt ?? new Date();
    if (props.aggregateVersion !== undefined) this.restoreVersion(props.aggregateVersion);
  }

  static create(props: PayEquityReviewProps, correlationId: Uuid): PayEquityReview {
    const r = new PayEquityReview({ ...props, status: 'PLANNED', createdAt: new Date(), updatedAt: new Date() });
    r.addDomainEvent(new PayEquityReviewPlanned({ tenantId: r.tenantId, aggregateId: r.id, correlationId }));
    return r;
  }

  start(correlationId: Uuid): void {
    if (this.status !== 'PLANNED') throw new ValidationError(`Cannot start from state ${this.status}`);
    this.status = 'IN_PROGRESS';
    this.addDomainEvent(new PayEquityReviewStarted({ tenantId: this.tenantId, aggregateId: this.id, correlationId }));
    this.incrementVersion();
    this.updatedAt = new Date();
  }

  recordFindings(correlationId: Uuid, findings: Record<string, unknown>): void {
    if (this.status !== 'IN_PROGRESS') throw new ValidationError(`Cannot record findings from state ${this.status}`);
    this.findings = applyKAnonymitySuppression(findings, DEFAULT_AGGREGATION_THRESHOLD) as Record<string, unknown>;
    this.status = 'FINDINGS';
    this.addDomainEvent(new PayEquityReviewFindings({ tenantId: this.tenantId, aggregateId: this.id, correlationId }));
    this.incrementVersion();
    this.updatedAt = new Date();
  }

  startRemediation(correlationId: Uuid, actions: Record<string, unknown>): void {
    if (this.status !== 'FINDINGS') throw new ValidationError(`Cannot start remediation from state ${this.status}`);
    this.remediationActions = actions;
    this.status = 'REMEDIATION';
    this.addDomainEvent(new PayEquityReviewRemediation({ tenantId: this.tenantId, aggregateId: this.id, correlationId }));
    this.incrementVersion();
    this.updatedAt = new Date();
  }

  close(correlationId: Uuid, completedActions?: Record<string, unknown>): void {
    if (this.status !== 'REMEDIATION' && this.status !== 'FINDINGS') throw new ValidationError(`Cannot close from state ${this.status}`);
    if (completedActions) this.completedActions = completedActions;
    this.status = 'CLOSED';
    this.addDomainEvent(new PayEquityReviewClosed({ tenantId: this.tenantId, aggregateId: this.id, correlationId }));
    this.incrementVersion();
    this.updatedAt = new Date();
  }
}
