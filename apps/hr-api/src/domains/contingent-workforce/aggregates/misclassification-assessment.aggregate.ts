import { AggregateRoot, DomainEvent, Uuid, Guard, ValidationError } from '@hcm/shared-kernel';

export type MisclassificationAssessmentStatus = 'PENDING' | 'IN_PROGRESS' | 'REVIEW_REQUIRED' | 'CLEARED' | 'FLAGGED';

export interface MisclassificationAssessmentProps {
  id: Uuid;
  tenantId: Uuid;
  workerId: Uuid;
  assessmentDate: Date;
  riskScore?: number;
  riskFactors?: string[];
  reviewedBy?: Uuid;
  reviewedAt?: Date;
  status?: MisclassificationAssessmentStatus;
  aggregateVersion?: number;
  createdAt?: Date;
  updatedAt?: Date;
}

export class MisclassificationAssessmentStarted extends DomainEvent {
  constructor(props: { tenantId: Uuid; aggregateId: Uuid; correlationId: Uuid }) {
    super({ eventName: 'MisclassificationAssessmentStarted', tenantId: props.tenantId, aggregateType: 'MisclassificationAssessment', aggregateId: props.aggregateId, correlationId: props.correlationId });
  }
}

export class MisclassificationReviewRequired extends DomainEvent {
  constructor(props: { tenantId: Uuid; aggregateId: Uuid; correlationId: Uuid }) {
    super({ eventName: 'MisclassificationReviewRequired', tenantId: props.tenantId, aggregateType: 'MisclassificationAssessment', aggregateId: props.aggregateId, correlationId: props.correlationId });
  }
}

export class MisclassificationCleared extends DomainEvent {
  constructor(props: { tenantId: Uuid; aggregateId: Uuid; correlationId: Uuid }) {
    super({ eventName: 'MisclassificationCleared', tenantId: props.tenantId, aggregateType: 'MisclassificationAssessment', aggregateId: props.aggregateId, correlationId: props.correlationId });
  }
}

export class MisclassificationFlagged extends DomainEvent {
  constructor(props: { tenantId: Uuid; aggregateId: Uuid; correlationId: Uuid }) {
    super({ eventName: 'MisclassificationFlagged', tenantId: props.tenantId, aggregateType: 'MisclassificationAssessment', aggregateId: props.aggregateId, correlationId: props.correlationId });
  }
}

export class MisclassificationAssessment extends AggregateRoot {
  private _aggregateVersion = 0;
  readonly tenantId: Uuid;
  workerId: Uuid;
  assessmentDate: Date;
  riskScore?: number;
  riskFactors?: string[];
  reviewedBy?: Uuid;
  reviewedAt?: Date;
  status: MisclassificationAssessmentStatus;
  createdAt: Date;
  updatedAt: Date;

  get version(): number { return this._aggregateVersion; }
  get aggregateVersion(): number { return this._aggregateVersion; }
  incrementVersion(): void { this._aggregateVersion++; }

  constructor(props: MisclassificationAssessmentProps) {
    super(props.id);
    this.tenantId = props.tenantId;
    this.workerId = props.workerId;
    this.assessmentDate = props.assessmentDate;
    this.riskScore = props.riskScore;
    this.riskFactors = props.riskFactors;
    this.reviewedBy = props.reviewedBy;
    this.reviewedAt = props.reviewedAt;
    this.status = props.status ?? 'PENDING';
    this.createdAt = props.createdAt ?? new Date();
    this.updatedAt = props.updatedAt ?? new Date();
    if (props.aggregateVersion !== undefined) this._aggregateVersion = props.aggregateVersion;
  }

  static create(props: MisclassificationAssessmentProps, correlationId: Uuid): MisclassificationAssessment {
    Guard.againstNullOrUndefined(props.assessmentDate, 'assessmentDate');
    const ma = new MisclassificationAssessment({ ...props, status: 'PENDING', createdAt: new Date(), updatedAt: new Date() });
    ma.addDomainEvent(new MisclassificationAssessmentStarted({ tenantId: ma.tenantId, aggregateId: ma.id, correlationId }));
    return ma;
  }

  start(correlationId: Uuid): void {
    if (this.status !== 'PENDING') throw new ValidationError(`Cannot start from ${this.status}`);
    this.status = 'IN_PROGRESS';
    this.addDomainEvent(new MisclassificationAssessmentStarted({ tenantId: this.tenantId, aggregateId: this.id, correlationId }));
    this.incrementVersion();
    this.updatedAt = new Date();
  }

  markReviewRequired(correlationId: Uuid): void {
    if (this.status !== 'IN_PROGRESS') throw new ValidationError(`Cannot mark review required from ${this.status}`);
    this.status = 'REVIEW_REQUIRED';
    this.addDomainEvent(new MisclassificationReviewRequired({ tenantId: this.tenantId, aggregateId: this.id, correlationId }));
    this.incrementVersion();
    this.updatedAt = new Date();
  }

  clear(correlationId: Uuid): void {
    if (this.status !== 'IN_PROGRESS' && this.status !== 'REVIEW_REQUIRED') throw new ValidationError(`Cannot clear from ${this.status}`);
    this.status = 'CLEARED';
    this.reviewedAt = new Date();
    this.addDomainEvent(new MisclassificationCleared({ tenantId: this.tenantId, aggregateId: this.id, correlationId }));
    this.incrementVersion();
    this.updatedAt = new Date();
  }

  flag(correlationId: Uuid): void {
    if (this.status !== 'IN_PROGRESS' && this.status !== 'REVIEW_REQUIRED') throw new ValidationError(`Cannot flag from ${this.status}`);
    this.status = 'FLAGGED';
    this.reviewedAt = new Date();
    this.addDomainEvent(new MisclassificationFlagged({ tenantId: this.tenantId, aggregateId: this.id, correlationId }));
    this.incrementVersion();
    this.updatedAt = new Date();
  }
}
