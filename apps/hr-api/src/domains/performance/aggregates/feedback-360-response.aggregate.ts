import { AggregateRoot, DomainEvent, Uuid, Guard, ValidationError } from '@hcm/shared-kernel';

export type Feedback360ResponseStatus = 'PENDING' | 'SUBMITTED' | 'EXPIRED' | 'WITHDRAWN';

export interface Feedback360ResponseProps {
  id: Uuid;
  tenantId: Uuid;
  cycleId: Uuid;
  revieweeId: Uuid;
  reviewerId: Uuid;
  relationshipType: string;
  status?: Feedback360ResponseStatus;
  competencyScores?: Record<string, number>;
  overallRating?: number;
  strengths?: string;
  improvements?: string;
  comments?: string;
  dimensionScores?: Record<string, number>;
  areaComments?: Record<string, string>;
  visibility?: 'NAMED' | 'ANONYMOUS';
  isAnonymous?: boolean;
  submittedAt?: Date;
  withdrawnAt?: Date;
  aggregateVersion?: number;
  createdAt?: Date;
  updatedAt?: Date;
}

export class Feedback360ResponseCreated extends DomainEvent {
  constructor(props: { tenantId: Uuid; aggregateId: Uuid; correlationId: Uuid }) {
    super({ eventName: 'Feedback360ResponseCreated', tenantId: props.tenantId, aggregateType: 'PerformanceFeedback360Response', aggregateId: props.aggregateId, correlationId: props.correlationId });
  }
}

export class Feedback360ResponseSubmitted extends DomainEvent {
  constructor(props: { tenantId: Uuid; aggregateId: Uuid; correlationId: Uuid }) {
    super({ eventName: 'Feedback360ResponseSubmitted', tenantId: props.tenantId, aggregateType: 'PerformanceFeedback360Response', aggregateId: props.aggregateId, correlationId: props.correlationId });
  }
}

export class Feedback360ResponseExpired extends DomainEvent {
  constructor(props: { tenantId: Uuid; aggregateId: Uuid; correlationId: Uuid }) {
    super({ eventName: 'Feedback360ResponseExpired', tenantId: props.tenantId, aggregateType: 'PerformanceFeedback360Response', aggregateId: props.aggregateId, correlationId: props.correlationId });
  }
}

export class Feedback360ResponseWithdrawn extends DomainEvent {
  constructor(props: { tenantId: Uuid; aggregateId: Uuid; correlationId: Uuid }) {
    super({ eventName: 'Feedback360ResponseWithdrawn', tenantId: props.tenantId, aggregateType: 'PerformanceFeedback360Response', aggregateId: props.aggregateId, correlationId: props.correlationId });
  }
}

export class Feedback360Response extends AggregateRoot {
  private _aggregateVersion = 0;
  readonly tenantId: Uuid;
  cycleId: Uuid;
  revieweeId: Uuid;
  reviewerId: Uuid;
  relationshipType: string;
  status: Feedback360ResponseStatus;
  competencyScores?: Record<string, number>;
  overallRating?: number;
  strengths?: string;
  improvements?: string;
  comments?: string;
  dimensionScores?: Record<string, number>;
  areaComments?: Record<string, string>;
  visibility: 'NAMED' | 'ANONYMOUS';
  isAnonymous: boolean;
  submittedAt?: Date;
  withdrawnAt?: Date;
  createdAt: Date;
  updatedAt: Date;

  get version(): number { return this._aggregateVersion; }
  get aggregateVersion(): number { return this._aggregateVersion; }
  incrementVersion(): void { this._aggregateVersion++; }

  constructor(props: Feedback360ResponseProps) {
    super(props.id);
    this.tenantId = props.tenantId;
    this.cycleId = props.cycleId;
    this.revieweeId = props.revieweeId;
    this.reviewerId = props.reviewerId;
    this.relationshipType = props.relationshipType;
    this.status = props.status ?? 'PENDING';
    this.competencyScores = props.competencyScores;
    this.overallRating = props.overallRating;
    this.strengths = props.strengths;
    this.improvements = props.improvements;
    this.comments = props.comments;
    this.dimensionScores = props.dimensionScores;
    this.areaComments = props.areaComments;
    this.visibility = props.visibility ?? (props.isAnonymous === false ? 'NAMED' : 'ANONYMOUS');
    this.isAnonymous = props.isAnonymous ?? true;
    this.submittedAt = props.submittedAt;
    this.withdrawnAt = props.withdrawnAt;
    this.createdAt = props.createdAt ?? new Date();
    this.updatedAt = props.updatedAt ?? new Date();
    if (props.aggregateVersion !== undefined) this._aggregateVersion = props.aggregateVersion;
  }

  static create(props: Feedback360ResponseProps, correlationId: Uuid): Feedback360Response {
    Guard.againstEmptyString(props.relationshipType, 'relationshipType');
    const ar = new Feedback360Response({ ...props, status: 'PENDING', createdAt: new Date(), updatedAt: new Date() });
    ar.addDomainEvent(new Feedback360ResponseCreated({ tenantId: ar.tenantId, aggregateId: ar.id, correlationId }));
    return ar;
  }

  submit(
    scores: Record<string, number>,
    overallRating: number,
    strengths: string,
    improvements: string,
    comments: string,
    correlationId: Uuid,
    options?: { dimensionScores?: Record<string, number>; areaComments?: Record<string, string>; isAnonymous?: boolean },
  ): void {
    if (this.status !== 'PENDING') throw new ValidationError(`Cannot submit from ${this.status}`);
    this.competencyScores = scores;
    this.overallRating = overallRating;
    this.strengths = strengths;
    this.improvements = improvements;
    this.comments = comments;
    this.dimensionScores = options?.dimensionScores ?? scores;
    this.areaComments = options?.areaComments;
    if (options?.isAnonymous !== undefined) {
      this.isAnonymous = options.isAnonymous;
      this.visibility = options.isAnonymous ? 'ANONYMOUS' : 'NAMED';
    }
    this.status = 'SUBMITTED';
    this.submittedAt = new Date();
    this.addDomainEvent(new Feedback360ResponseSubmitted({ tenantId: this.tenantId, aggregateId: this.id, correlationId }));
    this.incrementVersion();
    this.updatedAt = new Date();
  }

  expire(correlationId: Uuid): void {
    if (this.status !== 'PENDING') throw new ValidationError(`Cannot expire from ${this.status}`);
    this.status = 'EXPIRED';
    this.addDomainEvent(new Feedback360ResponseExpired({ tenantId: this.tenantId, aggregateId: this.id, correlationId }));
    this.incrementVersion();
    this.updatedAt = new Date();
  }

  withdraw(correlationId: Uuid): void {
    if (this.status !== 'PENDING') throw new ValidationError(`Cannot withdraw from ${this.status}`);
    this.status = 'WITHDRAWN';
    this.withdrawnAt = new Date();
    this.addDomainEvent(new Feedback360ResponseWithdrawn({ tenantId: this.tenantId, aggregateId: this.id, correlationId }));
    this.incrementVersion();
    this.updatedAt = new Date();
  }
}
