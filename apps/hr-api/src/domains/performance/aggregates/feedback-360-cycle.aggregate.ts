import { AggregateRoot, DomainEvent, Uuid, Guard, ValidationError } from '@hcm/shared-kernel';

export type Feedback360CycleStatus = 'DRAFT' | 'ACTIVE' | 'IN_PROGRESS' | 'CLOSED' | 'ARCHIVED' | 'CANCELLED';

export interface Feedback360CycleProps {
  id: Uuid;
  tenantId: Uuid;
  name: string;
  cycleYear: number;
  reviewCycleId?: Uuid;
  startDate: Date;
  endDate: Date;
  selfReviewDeadline?: Date;
  peerReviewDeadline?: Date;
  managerReviewDeadline?: Date;
  status?: Feedback360CycleStatus;
  anonymityEnabled?: boolean;
  minPeerReviews?: number;
  maxPeerReviews?: number;
  aggregateVersion?: number;
  createdAt?: Date;
  updatedAt?: Date;
}

export class Feedback360CycleCreated extends DomainEvent {
  constructor(props: { tenantId: Uuid; aggregateId: Uuid; correlationId: Uuid }) {
    super({ eventName: 'Feedback360CycleCreated', tenantId: props.tenantId, aggregateType: 'PerformanceFeedback360Cycle', aggregateId: props.aggregateId, correlationId: props.correlationId });
  }
}

export class Feedback360CycleActivated extends DomainEvent {
  constructor(props: { tenantId: Uuid; aggregateId: Uuid; correlationId: Uuid }) {
    super({ eventName: 'Feedback360CycleActivated', tenantId: props.tenantId, aggregateType: 'PerformanceFeedback360Cycle', aggregateId: props.aggregateId, correlationId: props.correlationId });
  }
}

export class Feedback360CycleLaunched extends DomainEvent {
  constructor(props: { tenantId: Uuid; aggregateId: Uuid; correlationId: Uuid }) {
    super({ eventName: 'Feedback360CycleLaunched', tenantId: props.tenantId, aggregateType: 'PerformanceFeedback360Cycle', aggregateId: props.aggregateId, correlationId: props.correlationId });
  }
}

export class Feedback360CycleClosed extends DomainEvent {
  constructor(props: { tenantId: Uuid; aggregateId: Uuid; correlationId: Uuid }) {
    super({ eventName: 'Feedback360CycleClosed', tenantId: props.tenantId, aggregateType: 'PerformanceFeedback360Cycle', aggregateId: props.aggregateId, correlationId: props.correlationId });
  }
}

export class Feedback360CycleArchived extends DomainEvent {
  constructor(props: { tenantId: Uuid; aggregateId: Uuid; correlationId: Uuid }) {
    super({ eventName: 'Feedback360CycleArchived', tenantId: props.tenantId, aggregateType: 'PerformanceFeedback360Cycle', aggregateId: props.aggregateId, correlationId: props.correlationId });
  }
}

export class Feedback360Cycle extends AggregateRoot {
  private _aggregateVersion = 0;
  readonly tenantId: Uuid;
  name: string;
  cycleYear: number;
  reviewCycleId?: Uuid;
  startDate: Date;
  endDate: Date;
  selfReviewDeadline?: Date;
  peerReviewDeadline?: Date;
  managerReviewDeadline?: Date;
  status: Feedback360CycleStatus;
  anonymityEnabled: boolean;
  minPeerReviews: number;
  maxPeerReviews: number;
  createdAt: Date;
  updatedAt: Date;

  get version(): number { return this._aggregateVersion; }
  get aggregateVersion(): number { return this._aggregateVersion; }
  incrementVersion(): void { this._aggregateVersion++; }

  constructor(props: Feedback360CycleProps) {
    super(props.id);
    this.tenantId = props.tenantId;
    this.name = props.name;
    this.cycleYear = props.cycleYear;
    this.reviewCycleId = props.reviewCycleId;
    this.startDate = props.startDate;
    this.endDate = props.endDate;
    this.selfReviewDeadline = props.selfReviewDeadline;
    this.peerReviewDeadline = props.peerReviewDeadline;
    this.managerReviewDeadline = props.managerReviewDeadline;
    this.status = props.status ?? 'DRAFT';
    this.anonymityEnabled = props.anonymityEnabled ?? true;
    this.minPeerReviews = props.minPeerReviews ?? 3;
    this.maxPeerReviews = props.maxPeerReviews ?? 5;
    this.createdAt = props.createdAt ?? new Date();
    this.updatedAt = props.updatedAt ?? new Date();
    if (props.aggregateVersion !== undefined) this._aggregateVersion = props.aggregateVersion;
  }

  static create(props: Feedback360CycleProps, correlationId: Uuid): Feedback360Cycle {
    Guard.againstEmptyString(props.name, 'name');
    const ar = new Feedback360Cycle({ ...props, status: 'DRAFT', createdAt: new Date(), updatedAt: new Date() });
    ar.addDomainEvent(new Feedback360CycleCreated({ tenantId: ar.tenantId, aggregateId: ar.id, correlationId }));
    return ar;
  }

  activate(correlationId: Uuid): void {
    if (this.status !== 'DRAFT') throw new ValidationError(`Cannot activate from ${this.status}`);
    this.status = 'ACTIVE';
    this.addDomainEvent(new Feedback360CycleActivated({ tenantId: this.tenantId, aggregateId: this.id, correlationId }));
    this.incrementVersion();
    this.updatedAt = new Date();
  }

  launch(correlationId: Uuid): void {
    if (this.status !== 'ACTIVE') throw new ValidationError(`Cannot launch from ${this.status}`);
    this.status = 'IN_PROGRESS';
    this.addDomainEvent(new Feedback360CycleLaunched({ tenantId: this.tenantId, aggregateId: this.id, correlationId }));
    this.incrementVersion();
    this.updatedAt = new Date();
  }

  close(correlationId: Uuid): void {
    if (this.status !== 'IN_PROGRESS') throw new ValidationError(`Cannot close from ${this.status}`);
    this.status = 'CLOSED';
    this.addDomainEvent(new Feedback360CycleClosed({ tenantId: this.tenantId, aggregateId: this.id, correlationId }));
    this.incrementVersion();
    this.updatedAt = new Date();
  }

  archive(correlationId: Uuid): void {
    if (this.status !== 'CLOSED') throw new ValidationError(`Cannot archive from ${this.status}`);
    this.status = 'ARCHIVED';
    this.addDomainEvent(new Feedback360CycleArchived({ tenantId: this.tenantId, aggregateId: this.id, correlationId }));
    this.incrementVersion();
    this.updatedAt = new Date();
  }
}
