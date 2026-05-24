import { AggregateRoot, DomainEvent, Uuid, Guard, ValidationError } from '@hcm/shared-kernel';

export type PerformanceReviewCycleStatus = 'DRAFT' | 'SETUP' | 'ACTIVE' | 'IN_PROGRESS' | 'CALIBRATION' | 'REVIEW' | 'CLOSED' | 'CANCELLED';

export interface PerformanceReviewCycleProps {
  id: Uuid;
  tenantId: Uuid;
  name: string;
  cycleYear: number;
  startDate: Date;
  endDate: Date;
  reviewType: string;
  status?: PerformanceReviewCycleStatus;
  aggregateVersion?: number;
  createdAt?: Date;
  updatedAt?: Date;
}

export class PerformanceReviewCycleCreated extends DomainEvent {
  constructor(props: { tenantId: Uuid; aggregateId: Uuid; correlationId: Uuid }) {
    super({ eventName: 'PerformanceReviewCycleCreated', tenantId: props.tenantId, aggregateType: 'PerformanceReviewCycle', aggregateId: props.aggregateId, correlationId: props.correlationId });
  }
}

export class PerformanceReviewCycleSetup extends DomainEvent {
  constructor(props: { tenantId: Uuid; aggregateId: Uuid; correlationId: Uuid }) {
    super({ eventName: 'PerformanceReviewCycleSetup', tenantId: props.tenantId, aggregateType: 'PerformanceReviewCycle', aggregateId: props.aggregateId, correlationId: props.correlationId });
  }
}

export class PerformanceReviewCycleActivated extends DomainEvent {
  constructor(props: { tenantId: Uuid; aggregateId: Uuid; correlationId: Uuid }) {
    super({ eventName: 'PerformanceReviewCycleActivated', tenantId: props.tenantId, aggregateType: 'PerformanceReviewCycle', aggregateId: props.aggregateId, correlationId: props.correlationId });
  }
}

export class PerformanceReviewCycleStarted extends DomainEvent {
  constructor(props: { tenantId: Uuid; aggregateId: Uuid; correlationId: Uuid }) {
    super({ eventName: 'PerformanceReviewCycleStarted', tenantId: props.tenantId, aggregateType: 'PerformanceReviewCycle', aggregateId: props.aggregateId, correlationId: props.correlationId });
  }
}

export class PerformanceReviewCycleCalibration extends DomainEvent {
  constructor(props: { tenantId: Uuid; aggregateId: Uuid; correlationId: Uuid }) {
    super({ eventName: 'PerformanceReviewCycleCalibration', tenantId: props.tenantId, aggregateType: 'PerformanceReviewCycle', aggregateId: props.aggregateId, correlationId: props.correlationId });
  }
}

export class PerformanceReviewCycleReview extends DomainEvent {
  constructor(props: { tenantId: Uuid; aggregateId: Uuid; correlationId: Uuid }) {
    super({ eventName: 'PerformanceReviewCycleReview', tenantId: props.tenantId, aggregateType: 'PerformanceReviewCycle', aggregateId: props.aggregateId, correlationId: props.correlationId });
  }
}

export class PerformanceReviewCycleClosed extends DomainEvent {
  constructor(props: { tenantId: Uuid; aggregateId: Uuid; correlationId: Uuid }) {
    super({ eventName: 'PerformanceReviewCycleClosed', tenantId: props.tenantId, aggregateType: 'PerformanceReviewCycle', aggregateId: props.aggregateId, correlationId: props.correlationId });
  }
}

/**
 * PerformanceReviewCycle aggregate manages the lifecycle of a performance review cycle.
 */
export class PerformanceReviewCycle extends AggregateRoot {
  private _aggregateVersion = 0;
  readonly tenantId: Uuid;
  name: string;
  cycleYear: number;
  startDate: Date;
  endDate: Date;
  reviewType: string;
  status: PerformanceReviewCycleStatus;
  createdAt: Date;
  updatedAt: Date;

  get version(): number { return this._aggregateVersion; }
  get aggregateVersion(): number { return this._aggregateVersion; }
  incrementVersion(): void { this._aggregateVersion++; }

  constructor(props: PerformanceReviewCycleProps) {
    super(props.id);
    this.tenantId = props.tenantId;
    this.name = props.name;
    this.cycleYear = props.cycleYear;
    this.startDate = props.startDate;
    this.endDate = props.endDate;
    this.reviewType = props.reviewType;
    this.status = props.status ?? 'DRAFT';
    this.createdAt = props.createdAt ?? new Date();
    this.updatedAt = props.updatedAt ?? new Date();
    if (props.aggregateVersion !== undefined) this._aggregateVersion = props.aggregateVersion;
  }

  static create(props: PerformanceReviewCycleProps, correlationId: Uuid): PerformanceReviewCycle {
    Guard.againstEmptyString(props.name, 'name');
    Guard.againstEmptyString(props.reviewType, 'reviewType');
    const ar = new PerformanceReviewCycle({ ...props, status: 'DRAFT', createdAt: new Date(), updatedAt: new Date() });
    ar.addDomainEvent(new PerformanceReviewCycleCreated({ tenantId: ar.tenantId, aggregateId: ar.id, correlationId }));
    return ar;
  }

  setup(correlationId: Uuid): void {
    if (this.status !== 'DRAFT') throw new ValidationError(`Cannot setup from ${this.status}`);
    this.status = 'SETUP';
    this.addDomainEvent(new PerformanceReviewCycleSetup({ tenantId: this.tenantId, aggregateId: this.id, correlationId }));
    this.incrementVersion();
    this.updatedAt = new Date();
  }

  activate(correlationId: Uuid): void {
    if (this.status !== 'SETUP') throw new ValidationError(`Cannot activate from ${this.status}`);
    this.status = 'ACTIVE';
    this.addDomainEvent(new PerformanceReviewCycleActivated({ tenantId: this.tenantId, aggregateId: this.id, correlationId }));
    this.incrementVersion();
    this.updatedAt = new Date();
  }

  start(correlationId: Uuid): void {
    if (this.status !== 'ACTIVE') throw new ValidationError(`Cannot start from ${this.status}`);
    this.status = 'IN_PROGRESS';
    this.addDomainEvent(new PerformanceReviewCycleStarted({ tenantId: this.tenantId, aggregateId: this.id, correlationId }));
    this.incrementVersion();
    this.updatedAt = new Date();
  }

  enterCalibration(correlationId: Uuid): void {
    if (this.status !== 'IN_PROGRESS') throw new ValidationError(`Cannot enter calibration from ${this.status}`);
    this.status = 'CALIBRATION';
    this.addDomainEvent(new PerformanceReviewCycleCalibration({ tenantId: this.tenantId, aggregateId: this.id, correlationId }));
    this.incrementVersion();
    this.updatedAt = new Date();
  }

  enterReview(correlationId: Uuid): void {
    if (this.status !== 'CALIBRATION') throw new ValidationError(`Cannot enter review from ${this.status}`);
    this.status = 'REVIEW';
    this.addDomainEvent(new PerformanceReviewCycleReview({ tenantId: this.tenantId, aggregateId: this.id, correlationId }));
    this.incrementVersion();
    this.updatedAt = new Date();
  }

  close(correlationId: Uuid): void {
    if (this.status !== 'REVIEW') throw new ValidationError(`Cannot close from ${this.status}`);
    this.status = 'CLOSED';
    this.addDomainEvent(new PerformanceReviewCycleClosed({ tenantId: this.tenantId, aggregateId: this.id, correlationId }));
    this.incrementVersion();
    this.updatedAt = new Date();
  }
}
