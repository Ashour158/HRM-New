import { AggregateRoot, DomainEvent, Uuid, ValidationError } from '@hcm/shared-kernel';

export type Feedback360CycleStatus = 'DRAFT' | 'ACTIVE' | 'IN_PROGRESS' | 'COMPLETED' | 'CLOSED';

export interface Feedback360CycleProps {
  id: Uuid;
  tenantId: Uuid;
  subjectWorkerId: Uuid;
  reviewers?: string[];
  startDate?: Date;
  endDate?: Date;
  status?: Feedback360CycleStatus;
  aggregateVersion?: number;
  createdAt?: Date;
  updatedAt?: Date;
}

export class Feedback360CycleCreated extends DomainEvent {
  constructor(props: { tenantId: Uuid; aggregateId: Uuid; correlationId: Uuid }) {
    super({ eventName: 'Feedback360CycleCreated', tenantId: props.tenantId, aggregateType: 'Feedback360Cycle', aggregateId: props.aggregateId, correlationId: props.correlationId });
  }
}

export class Feedback360CycleActivated extends DomainEvent {
  constructor(props: { tenantId: Uuid; aggregateId: Uuid; correlationId: Uuid }) {
    super({ eventName: 'Feedback360CycleActivated', tenantId: props.tenantId, aggregateType: 'Feedback360Cycle', aggregateId: props.aggregateId, correlationId: props.correlationId });
  }
}

export class Feedback360CycleStarted extends DomainEvent {
  constructor(props: { tenantId: Uuid; aggregateId: Uuid; correlationId: Uuid }) {
    super({ eventName: 'Feedback360CycleStarted', tenantId: props.tenantId, aggregateType: 'Feedback360Cycle', aggregateId: props.aggregateId, correlationId: props.correlationId });
  }
}

export class Feedback360CycleCompleted extends DomainEvent {
  constructor(props: { tenantId: Uuid; aggregateId: Uuid; correlationId: Uuid }) {
    super({ eventName: 'Feedback360CycleCompleted', tenantId: props.tenantId, aggregateType: 'Feedback360Cycle', aggregateId: props.aggregateId, correlationId: props.correlationId });
  }
}

/**
 * Feedback360Cycle aggregate manages 360-degree feedback cycles.
 */
export class Feedback360Cycle extends AggregateRoot {
  private _aggregateVersion = 0;
  readonly tenantId: Uuid;
  subjectWorkerId: Uuid;
  reviewers: string[];
  startDate?: Date;
  endDate?: Date;
  status: Feedback360CycleStatus;
  createdAt: Date;
  updatedAt: Date;

  get version(): number { return this._aggregateVersion; }
  get aggregateVersion(): number { return this._aggregateVersion; }
  incrementVersion(): void { this._aggregateVersion++; }

  constructor(props: Feedback360CycleProps) {
    super(props.id);
    this.tenantId = props.tenantId;
    this.subjectWorkerId = props.subjectWorkerId;
    this.reviewers = props.reviewers ?? [];
    this.startDate = props.startDate;
    this.endDate = props.endDate;
    this.status = props.status ?? 'DRAFT';
    this.createdAt = props.createdAt ?? new Date();
    this.updatedAt = props.updatedAt ?? new Date();
    if (props.aggregateVersion !== undefined) this._aggregateVersion = props.aggregateVersion;
  }

  static create(props: Feedback360CycleProps, correlationId: Uuid): Feedback360Cycle {
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

  start(correlationId: Uuid): void {
    if (this.status !== 'ACTIVE') throw new ValidationError(`Cannot start from ${this.status}`);
    this.status = 'IN_PROGRESS';
    this.addDomainEvent(new Feedback360CycleStarted({ tenantId: this.tenantId, aggregateId: this.id, correlationId }));
    this.incrementVersion();
    this.updatedAt = new Date();
  }

  complete(correlationId: Uuid): void {
    if (this.status !== 'IN_PROGRESS') throw new ValidationError(`Cannot complete from ${this.status}`);
    this.status = 'COMPLETED';
    this.addDomainEvent(new Feedback360CycleCompleted({ tenantId: this.tenantId, aggregateId: this.id, correlationId }));
    this.incrementVersion();
    this.updatedAt = new Date();
  }
}
