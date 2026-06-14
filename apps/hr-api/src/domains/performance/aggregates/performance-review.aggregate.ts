/**
 * @hrDataClassification CONFIDENTIAL - review, rating, goal, competency, calibration, 360 feedback, PIP, and development-plan fields.
 */
import { AggregateRoot, DomainEvent, Uuid, ValidationError } from '@hcm/shared-kernel';

export type PerformanceReviewStatus = 'DRAFT' | 'SELF_REVIEW' | 'MANAGER_REVIEW' | 'CALIBRATED' | 'FINALIZED' | 'ACKNOWLEDGED' | 'DISPUTED';

export interface PerformanceReviewProps {
  id: Uuid;
  tenantId: Uuid;
  workerId: Uuid;
  reviewCycleId: Uuid;
  managerId: Uuid;
  selfReviewContent?: string;
  managerReviewContent?: string;
  calibratedRating?: number;
  finalRating?: number;
  status?: PerformanceReviewStatus;
  aggregateVersion?: number;
  createdAt?: Date;
  updatedAt?: Date;
}

export class PerformanceReviewDrafted extends DomainEvent {
  constructor(props: { tenantId: Uuid; aggregateId: Uuid; correlationId: Uuid }) {
    super({ eventName: 'PerformanceReviewDrafted', tenantId: props.tenantId, aggregateType: 'PerformanceReview', aggregateId: props.aggregateId, correlationId: props.correlationId });
  }
}

export class PerformanceReviewSelfReviewed extends DomainEvent {
  constructor(props: { tenantId: Uuid; aggregateId: Uuid; correlationId: Uuid }) {
    super({ eventName: 'PerformanceReviewSelfReviewed', tenantId: props.tenantId, aggregateType: 'PerformanceReview', aggregateId: props.aggregateId, correlationId: props.correlationId });
  }
}

export class PerformanceReviewManagerReviewed extends DomainEvent {
  constructor(props: { tenantId: Uuid; aggregateId: Uuid; correlationId: Uuid }) {
    super({ eventName: 'PerformanceReviewManagerReviewed', tenantId: props.tenantId, aggregateType: 'PerformanceReview', aggregateId: props.aggregateId, correlationId: props.correlationId });
  }
}

export class PerformanceReviewCalibrated extends DomainEvent {
  constructor(props: { tenantId: Uuid; aggregateId: Uuid; correlationId: Uuid }) {
    super({ eventName: 'PerformanceReviewCalibrated', tenantId: props.tenantId, aggregateType: 'PerformanceReview', aggregateId: props.aggregateId, correlationId: props.correlationId });
  }
}

export class PerformanceReviewFinalized extends DomainEvent {
  constructor(props: { tenantId: Uuid; aggregateId: Uuid; correlationId: Uuid }) {
    super({ eventName: 'PerformanceReviewFinalized', tenantId: props.tenantId, aggregateType: 'PerformanceReview', aggregateId: props.aggregateId, correlationId: props.correlationId });
  }
}

export class PerformanceReviewAcknowledged extends DomainEvent {
  constructor(props: { tenantId: Uuid; aggregateId: Uuid; correlationId: Uuid }) {
    super({ eventName: 'PerformanceReviewAcknowledged', tenantId: props.tenantId, aggregateType: 'PerformanceReview', aggregateId: props.aggregateId, correlationId: props.correlationId });
  }
}

export class PerformanceReviewDisputed extends DomainEvent {
  constructor(props: { tenantId: Uuid; aggregateId: Uuid; correlationId: Uuid }) {
    super({ eventName: 'PerformanceReviewDisputed', tenantId: props.tenantId, aggregateType: 'PerformanceReview', aggregateId: props.aggregateId, correlationId: props.correlationId });
  }
}

/**
 * PerformanceReview aggregate tracks individual worker performance reviews.
 */
export class PerformanceReview extends AggregateRoot {
  private _aggregateVersion = 0;
  readonly tenantId: Uuid;
  workerId: Uuid;
  reviewCycleId: Uuid;
  managerId: Uuid;
  selfReviewContent?: string;
  managerReviewContent?: string;
  calibratedRating?: number;
  finalRating?: number;
  status: PerformanceReviewStatus;
  createdAt: Date;
  updatedAt: Date;

  get version(): number { return this._aggregateVersion; }
  get aggregateVersion(): number { return this._aggregateVersion; }
  incrementVersion(): void { this._aggregateVersion++; }

  constructor(props: PerformanceReviewProps) {
    super(props.id);
    this.tenantId = props.tenantId;
    this.workerId = props.workerId;
    this.reviewCycleId = props.reviewCycleId;
    this.managerId = props.managerId;
    this.selfReviewContent = props.selfReviewContent;
    this.managerReviewContent = props.managerReviewContent;
    this.calibratedRating = props.calibratedRating;
    this.finalRating = props.finalRating;
    this.status = props.status ?? 'DRAFT';
    this.createdAt = props.createdAt ?? new Date();
    this.updatedAt = props.updatedAt ?? new Date();
    if (props.aggregateVersion !== undefined) this._aggregateVersion = props.aggregateVersion;
  }

  static create(props: PerformanceReviewProps, correlationId: Uuid): PerformanceReview {
    const ar = new PerformanceReview({ ...props, status: 'DRAFT', createdAt: new Date(), updatedAt: new Date() });
    ar.addDomainEvent(new PerformanceReviewDrafted({ tenantId: ar.tenantId, aggregateId: ar.id, correlationId }));
    return ar;
  }

  submitSelfReview(content: string, correlationId: Uuid): void {
    if (this.status !== 'DRAFT') throw new ValidationError(`Cannot self-review from ${this.status}`);
    this.selfReviewContent = content;
    this.status = 'SELF_REVIEW';
    this.addDomainEvent(new PerformanceReviewSelfReviewed({ tenantId: this.tenantId, aggregateId: this.id, correlationId }));
    this.incrementVersion();
    this.updatedAt = new Date();
  }

  submitManagerReview(content: string, correlationId: Uuid): void {
    if (this.status !== 'SELF_REVIEW') throw new ValidationError(`Cannot manager-review from ${this.status}`);
    this.managerReviewContent = content;
    this.status = 'MANAGER_REVIEW';
    this.addDomainEvent(new PerformanceReviewManagerReviewed({ tenantId: this.tenantId, aggregateId: this.id, correlationId }));
    this.incrementVersion();
    this.updatedAt = new Date();
  }

  calibrate(rating: number, correlationId: Uuid): void {
    if (this.status !== 'MANAGER_REVIEW') throw new ValidationError(`Cannot calibrate from ${this.status}`);
    this.calibratedRating = rating;
    this.status = 'CALIBRATED';
    this.addDomainEvent(new PerformanceReviewCalibrated({ tenantId: this.tenantId, aggregateId: this.id, correlationId }));
    this.incrementVersion();
    this.updatedAt = new Date();
  }

  finalize(rating: number, correlationId: Uuid): void {
    if (this.status !== 'CALIBRATED') throw new ValidationError(`Cannot finalize from ${this.status}`);
    this.finalRating = rating;
    this.status = 'FINALIZED';
    this.addDomainEvent(new PerformanceReviewFinalized({ tenantId: this.tenantId, aggregateId: this.id, correlationId }));
    this.incrementVersion();
    this.updatedAt = new Date();
  }

  acknowledge(correlationId: Uuid): void {
    if (this.status !== 'FINALIZED') throw new ValidationError(`Cannot acknowledge from ${this.status}`);
    this.status = 'ACKNOWLEDGED';
    this.addDomainEvent(new PerformanceReviewAcknowledged({ tenantId: this.tenantId, aggregateId: this.id, correlationId }));
    this.incrementVersion();
    this.updatedAt = new Date();
  }

  dispute(correlationId: Uuid): void {
    if (this.status !== 'FINALIZED') throw new ValidationError(`Cannot dispute from ${this.status}`);
    this.status = 'DISPUTED';
    this.addDomainEvent(new PerformanceReviewDisputed({ tenantId: this.tenantId, aggregateId: this.id, correlationId }));
    this.incrementVersion();
    this.updatedAt = new Date();
  }
}
