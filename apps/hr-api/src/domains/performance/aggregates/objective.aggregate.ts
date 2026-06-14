/**
 * @hrDataClassification CONFIDENTIAL - review, rating, goal, competency, calibration, 360 feedback, PIP, and development-plan fields.
 */
import { AggregateRoot, DomainEvent, Uuid, Guard, ValidationError } from '@hcm/shared-kernel';

export type ObjectiveStatus = 'DRAFT' | 'ACTIVE' | 'IN_PROGRESS' | 'ACHIEVED' | 'PARTIAL' | 'MISSED' | 'CANCELLED';

export interface ObjectiveProps {
  id: Uuid;
  tenantId: Uuid;
  ownerId: Uuid;
  orgUnitId?: Uuid;
  parentObjectiveId?: Uuid;
  reviewCycleId?: Uuid;
  title: string;
  description?: string;
  period: string;
  confidenceScore?: number;
  progress?: number;
  status?: ObjectiveStatus;
  alignmentType?: string;
  aggregateVersion?: number;
  createdAt?: Date;
  updatedAt?: Date;
}

export class ObjectiveCreated extends DomainEvent {
  constructor(props: { tenantId: Uuid; aggregateId: Uuid; correlationId: Uuid }) {
    super({ eventName: 'ObjectiveCreated', tenantId: props.tenantId, aggregateType: 'Objective', aggregateId: props.aggregateId, correlationId: props.correlationId });
  }
}

export class ObjectiveActivated extends DomainEvent {
  constructor(props: { tenantId: Uuid; aggregateId: Uuid; correlationId: Uuid }) {
    super({ eventName: 'ObjectiveActivated', tenantId: props.tenantId, aggregateType: 'Objective', aggregateId: props.aggregateId, correlationId: props.correlationId });
  }
}

export class ObjectiveProgressUpdated extends DomainEvent {
  constructor(props: { tenantId: Uuid; aggregateId: Uuid; correlationId: Uuid }) {
    super({ eventName: 'ObjectiveProgressUpdated', tenantId: props.tenantId, aggregateType: 'Objective', aggregateId: props.aggregateId, correlationId: props.correlationId });
  }
}

export class ObjectiveAchieved extends DomainEvent {
  constructor(props: { tenantId: Uuid; aggregateId: Uuid; correlationId: Uuid }) {
    super({ eventName: 'ObjectiveAchieved', tenantId: props.tenantId, aggregateType: 'Objective', aggregateId: props.aggregateId, correlationId: props.correlationId });
  }
}

export class ObjectiveCancelled extends DomainEvent {
  constructor(props: { tenantId: Uuid; aggregateId: Uuid; correlationId: Uuid }) {
    super({ eventName: 'ObjectiveCancelled', tenantId: props.tenantId, aggregateType: 'Objective', aggregateId: props.aggregateId, correlationId: props.correlationId });
  }
}

export class Objective extends AggregateRoot {
  private _aggregateVersion = 0;
  readonly tenantId: Uuid;
  ownerId: Uuid;
  orgUnitId?: Uuid;
  parentObjectiveId?: Uuid;
  reviewCycleId?: Uuid;
  title: string;
  description?: string;
  period: string;
  confidenceScore?: number;
  progress: number;
  status: ObjectiveStatus;
  alignmentType?: string;
  createdAt: Date;
  updatedAt: Date;

  get version(): number { return this._aggregateVersion; }
  get aggregateVersion(): number { return this._aggregateVersion; }
  incrementVersion(): void { this._aggregateVersion++; }

  constructor(props: ObjectiveProps) {
    super(props.id);
    this.tenantId = props.tenantId;
    this.ownerId = props.ownerId;
    this.orgUnitId = props.orgUnitId;
    this.parentObjectiveId = props.parentObjectiveId;
    this.reviewCycleId = props.reviewCycleId;
    this.title = props.title;
    this.description = props.description;
    this.period = props.period;
    this.confidenceScore = props.confidenceScore;
    this.progress = props.progress ?? 0;
    this.status = props.status ?? 'DRAFT';
    this.alignmentType = props.alignmentType;
    this.createdAt = props.createdAt ?? new Date();
    this.updatedAt = props.updatedAt ?? new Date();
    if (props.aggregateVersion !== undefined) this._aggregateVersion = props.aggregateVersion;
  }

  static create(props: ObjectiveProps, correlationId: Uuid): Objective {
    Guard.againstEmptyString(props.title, 'title');
    Guard.againstEmptyString(props.period, 'period');
    const ar = new Objective({ ...props, status: 'DRAFT', progress: 0, createdAt: new Date(), updatedAt: new Date() });
    ar.addDomainEvent(new ObjectiveCreated({ tenantId: ar.tenantId, aggregateId: ar.id, correlationId }));
    return ar;
  }

  activate(correlationId: Uuid): void {
    if (this.status !== 'DRAFT') throw new ValidationError(`Cannot activate from ${this.status}`);
    this.status = 'ACTIVE';
    this.addDomainEvent(new ObjectiveActivated({ tenantId: this.tenantId, aggregateId: this.id, correlationId }));
    this.incrementVersion();
    this.updatedAt = new Date();
  }

  updateProgress(progress: number, confidenceScore: number, correlationId: Uuid): void {
    if (this.status !== 'ACTIVE' && this.status !== 'IN_PROGRESS') throw new ValidationError(`Cannot update progress from ${this.status}`);
    this.progress = Math.min(100, Math.max(0, progress));
    this.confidenceScore = Math.min(1, Math.max(0, confidenceScore));
    if (this.progress >= 100) {
      this.status = 'ACHIEVED';
      this.addDomainEvent(new ObjectiveAchieved({ tenantId: this.tenantId, aggregateId: this.id, correlationId }));
    } else {
      this.status = 'IN_PROGRESS';
      this.addDomainEvent(new ObjectiveProgressUpdated({ tenantId: this.tenantId, aggregateId: this.id, correlationId }));
    }
    this.incrementVersion();
    this.updatedAt = new Date();
  }

  markAchieved(correlationId: Uuid): void {
    if (this.status !== 'ACTIVE' && this.status !== 'IN_PROGRESS') throw new ValidationError(`Cannot mark achieved from ${this.status}`);
    this.status = 'ACHIEVED';
    this.progress = 100;
    this.addDomainEvent(new ObjectiveAchieved({ tenantId: this.tenantId, aggregateId: this.id, correlationId }));
    this.incrementVersion();
    this.updatedAt = new Date();
  }

  cancel(correlationId: Uuid): void {
    if (this.status === 'ACHIEVED' || this.status === 'CANCELLED') throw new ValidationError(`Cannot cancel from ${this.status}`);
    this.status = 'CANCELLED';
    this.addDomainEvent(new ObjectiveCancelled({ tenantId: this.tenantId, aggregateId: this.id, correlationId }));
    this.incrementVersion();
    this.updatedAt = new Date();
  }
}
