import { AggregateRoot, DomainEvent, Uuid, ValidationError } from '@hcm/shared-kernel';

export type LearningAssignmentStatus = 'ASSIGNED' | 'IN_PROGRESS' | 'COMPLETED' | 'EXPIRED' | 'CANCELLED';

export interface LearningAssignmentProps {
  id: Uuid;
  tenantId: Uuid;
  workerId: Uuid;
  courseId: Uuid;
  assignedBy: Uuid;
  assignedAt?: Date;
  dueDate?: Date;
  completedAt?: Date;
  score?: number;
  status?: LearningAssignmentStatus;
  aggregateVersion?: number;
  createdAt?: Date;
  updatedAt?: Date;
}

export class LearningAssignmentAssigned extends DomainEvent {
  constructor(props: { tenantId: Uuid; aggregateId: Uuid; correlationId: Uuid }) {
    super({ eventName: 'LearningAssignmentAssigned', tenantId: props.tenantId, aggregateType: 'LearningAssignment', aggregateId: props.aggregateId, correlationId: props.correlationId });
  }
}

export class LearningAssignmentStarted extends DomainEvent {
  constructor(props: { tenantId: Uuid; aggregateId: Uuid; correlationId: Uuid }) {
    super({ eventName: 'LearningAssignmentStarted', tenantId: props.tenantId, aggregateType: 'LearningAssignment', aggregateId: props.aggregateId, correlationId: props.correlationId });
  }
}

export class LearningAssignmentCompleted extends DomainEvent {
  constructor(props: { tenantId: Uuid; aggregateId: Uuid; correlationId: Uuid }) {
    super({ eventName: 'LearningAssignmentCompleted', tenantId: props.tenantId, aggregateType: 'LearningAssignment', aggregateId: props.aggregateId, correlationId: props.correlationId });
  }
}

export class LearningAssignmentExpired extends DomainEvent {
  constructor(props: { tenantId: Uuid; aggregateId: Uuid; correlationId: Uuid }) {
    super({ eventName: 'LearningAssignmentExpired', tenantId: props.tenantId, aggregateType: 'LearningAssignment', aggregateId: props.aggregateId, correlationId: props.correlationId });
  }
}

export class LearningAssignmentCancelled extends DomainEvent {
  constructor(props: { tenantId: Uuid; aggregateId: Uuid; correlationId: Uuid }) {
    super({ eventName: 'LearningAssignmentCancelled', tenantId: props.tenantId, aggregateType: 'LearningAssignment', aggregateId: props.aggregateId, correlationId: props.correlationId });
  }
}

/**
 * LearningAssignment aggregate tracks course assignments to workers.
 */
export class LearningAssignment extends AggregateRoot {
  private _aggregateVersion = 0;
  readonly tenantId: Uuid;
  workerId: Uuid;
  courseId: Uuid;
  assignedBy: Uuid;
  assignedAt: Date;
  dueDate?: Date;
  completedAt?: Date;
  score?: number;
  status: LearningAssignmentStatus;
  createdAt: Date;
  updatedAt: Date;

  get version(): number { return this._aggregateVersion; }
  get aggregateVersion(): number { return this._aggregateVersion; }
  incrementVersion(): void { this._aggregateVersion++; }

  constructor(props: LearningAssignmentProps) {
    super(props.id);
    this.tenantId = props.tenantId;
    this.workerId = props.workerId;
    this.courseId = props.courseId;
    this.assignedBy = props.assignedBy;
    this.assignedAt = props.assignedAt ?? new Date();
    this.dueDate = props.dueDate;
    this.completedAt = props.completedAt;
    this.score = props.score;
    this.status = props.status ?? 'ASSIGNED';
    this.createdAt = props.createdAt ?? new Date();
    this.updatedAt = props.updatedAt ?? new Date();
    if (props.aggregateVersion !== undefined) this._aggregateVersion = props.aggregateVersion;
  }

  static create(props: LearningAssignmentProps, correlationId: Uuid): LearningAssignment {
    const ar = new LearningAssignment({ ...props, status: 'ASSIGNED', assignedAt: new Date(), createdAt: new Date(), updatedAt: new Date() });
    ar.addDomainEvent(new LearningAssignmentAssigned({ tenantId: ar.tenantId, aggregateId: ar.id, correlationId }));
    return ar;
  }

  start(correlationId: Uuid): void {
    if (this.status !== 'ASSIGNED') throw new ValidationError(`Cannot start from ${this.status}`);
    this.status = 'IN_PROGRESS';
    this.addDomainEvent(new LearningAssignmentStarted({ tenantId: this.tenantId, aggregateId: this.id, correlationId }));
    this.incrementVersion();
    this.updatedAt = new Date();
  }

  complete(score: number, correlationId: Uuid): void {
    if (this.status !== 'ASSIGNED' && this.status !== 'IN_PROGRESS') throw new ValidationError(`Cannot complete from ${this.status}`);
    this.score = score;
    this.completedAt = new Date();
    this.status = 'COMPLETED';
    this.addDomainEvent(new LearningAssignmentCompleted({ tenantId: this.tenantId, aggregateId: this.id, correlationId }));
    this.incrementVersion();
    this.updatedAt = new Date();
  }

  expire(correlationId: Uuid): void {
    if (this.status === 'COMPLETED' || this.status === 'EXPIRED' || this.status === 'CANCELLED') throw new ValidationError(`Cannot expire from ${this.status}`);
    this.status = 'EXPIRED';
    this.addDomainEvent(new LearningAssignmentExpired({ tenantId: this.tenantId, aggregateId: this.id, correlationId }));
    this.incrementVersion();
    this.updatedAt = new Date();
  }

  cancel(correlationId: Uuid): void {
    if (this.status === 'COMPLETED' || this.status === 'EXPIRED' || this.status === 'CANCELLED') throw new ValidationError(`Cannot cancel from ${this.status}`);
    this.status = 'CANCELLED';
    this.addDomainEvent(new LearningAssignmentCancelled({ tenantId: this.tenantId, aggregateId: this.id, correlationId }));
    this.incrementVersion();
    this.updatedAt = new Date();
  }
}
