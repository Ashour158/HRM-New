/**
 * @hrDataClassification CONFIDENTIAL - review, rating, goal, competency, calibration, 360 feedback, PIP, and development-plan fields.
 */
import { AggregateRoot, DomainEvent, Uuid, Guard, ValidationError } from '@hcm/shared-kernel';

export type GoalStatus = 'DRAFT' | 'ACTIVE' | 'IN_PROGRESS' | 'ACHIEVED' | 'MISSED' | 'CANCELLED';

export interface GoalProps {
  id: Uuid;
  tenantId: Uuid;
  workerId: Uuid;
  title: string;
  description?: string;
  targetValue?: number;
  currentValue?: number;
  unit?: string;
  startDate?: Date;
  dueDate?: Date;
  smartCriteria?: {
    specific?: string;
    measurable?: string;
    achievable?: string;
    relevant?: string;
    timeBound?: string;
  };
  metricName?: string;
  baselineValue?: number;
  weight?: number;
  reviewCadence?: string;
  evidenceRequired?: boolean;
  status?: GoalStatus;
  aggregateVersion?: number;
  createdAt?: Date;
  updatedAt?: Date;
}

export class GoalCreated extends DomainEvent {
  constructor(props: { tenantId: Uuid; aggregateId: Uuid; correlationId: Uuid }) {
    super({ eventName: 'GoalCreated', tenantId: props.tenantId, aggregateType: 'Goal', aggregateId: props.aggregateId, correlationId: props.correlationId });
  }
}

export class GoalActivated extends DomainEvent {
  constructor(props: { tenantId: Uuid; aggregateId: Uuid; correlationId: Uuid }) {
    super({ eventName: 'GoalActivated', tenantId: props.tenantId, aggregateType: 'Goal', aggregateId: props.aggregateId, correlationId: props.correlationId });
  }
}

export class GoalProgressUpdated extends DomainEvent {
  constructor(props: { tenantId: Uuid; aggregateId: Uuid; correlationId: Uuid }) {
    super({ eventName: 'GoalProgressUpdated', tenantId: props.tenantId, aggregateType: 'Goal', aggregateId: props.aggregateId, correlationId: props.correlationId });
  }
}

export class GoalAchieved extends DomainEvent {
  constructor(props: { tenantId: Uuid; aggregateId: Uuid; correlationId: Uuid }) {
    super({ eventName: 'GoalAchieved', tenantId: props.tenantId, aggregateType: 'Goal', aggregateId: props.aggregateId, correlationId: props.correlationId });
  }
}

export class GoalMissed extends DomainEvent {
  constructor(props: { tenantId: Uuid; aggregateId: Uuid; correlationId: Uuid }) {
    super({ eventName: 'GoalMissed', tenantId: props.tenantId, aggregateType: 'Goal', aggregateId: props.aggregateId, correlationId: props.correlationId });
  }
}

export class GoalCancelled extends DomainEvent {
  constructor(props: { tenantId: Uuid; aggregateId: Uuid; correlationId: Uuid }) {
    super({ eventName: 'GoalCancelled', tenantId: props.tenantId, aggregateType: 'Goal', aggregateId: props.aggregateId, correlationId: props.correlationId });
  }
}

/**
 * Goal aggregate tracks individual worker goals.
 */
export class Goal extends AggregateRoot {
  private _aggregateVersion = 0;
  readonly tenantId: Uuid;
  workerId: Uuid;
  title: string;
  description?: string;
  targetValue?: number;
  currentValue?: number;
  unit?: string;
  startDate?: Date;
  dueDate?: Date;
  smartCriteria: {
    specific?: string;
    measurable?: string;
    achievable?: string;
    relevant?: string;
    timeBound?: string;
  };
  metricName?: string;
  baselineValue?: number;
  weight?: number;
  reviewCadence?: string;
  evidenceRequired: boolean;
  status: GoalStatus;
  createdAt: Date;
  updatedAt: Date;

  get version(): number { return this._aggregateVersion; }
  get aggregateVersion(): number { return this._aggregateVersion; }
  incrementVersion(): void { this._aggregateVersion++; }

  constructor(props: GoalProps) {
    super(props.id);
    this.tenantId = props.tenantId;
    this.workerId = props.workerId;
    this.title = props.title;
    this.description = props.description;
    this.targetValue = props.targetValue;
    this.currentValue = props.currentValue;
    this.unit = props.unit;
    this.startDate = props.startDate;
    this.dueDate = props.dueDate;
    this.smartCriteria = props.smartCriteria ?? {};
    this.metricName = props.metricName;
    this.baselineValue = props.baselineValue;
    this.weight = props.weight;
    this.reviewCadence = props.reviewCadence;
    this.evidenceRequired = props.evidenceRequired ?? false;
    this.status = props.status ?? 'DRAFT';
    this.createdAt = props.createdAt ?? new Date();
    this.updatedAt = props.updatedAt ?? new Date();
    if (props.aggregateVersion !== undefined) this._aggregateVersion = props.aggregateVersion;
  }

  static create(props: GoalProps, correlationId: Uuid): Goal {
    Guard.againstEmptyString(props.title, 'title');
    const ar = new Goal({ ...props, status: 'DRAFT', createdAt: new Date(), updatedAt: new Date() });
    ar.addDomainEvent(new GoalCreated({ tenantId: ar.tenantId, aggregateId: ar.id, correlationId }));
    return ar;
  }

  activate(correlationId: Uuid): void {
    if (this.status !== 'DRAFT') throw new ValidationError(`Cannot activate from ${this.status}`);
    this.status = 'ACTIVE';
    this.addDomainEvent(new GoalActivated({ tenantId: this.tenantId, aggregateId: this.id, correlationId }));
    this.incrementVersion();
    this.updatedAt = new Date();
  }

  updateProgress(currentValue: number, correlationId: Uuid): void {
    if (this.status !== 'ACTIVE' && this.status !== 'IN_PROGRESS') throw new ValidationError(`Cannot update progress from ${this.status}`);
    this.currentValue = currentValue;
    if (this.targetValue !== undefined && this.currentValue >= this.targetValue) {
      this.status = 'ACHIEVED';
      this.addDomainEvent(new GoalAchieved({ tenantId: this.tenantId, aggregateId: this.id, correlationId }));
    } else {
      this.status = 'IN_PROGRESS';
      this.addDomainEvent(new GoalProgressUpdated({ tenantId: this.tenantId, aggregateId: this.id, correlationId }));
    }
    this.incrementVersion();
    this.updatedAt = new Date();
  }

  markAchieved(correlationId: Uuid): void {
    if (this.status !== 'ACTIVE' && this.status !== 'IN_PROGRESS') throw new ValidationError(`Cannot mark achieved from ${this.status}`);
    this.status = 'ACHIEVED';
    this.addDomainEvent(new GoalAchieved({ tenantId: this.tenantId, aggregateId: this.id, correlationId }));
    this.incrementVersion();
    this.updatedAt = new Date();
  }

  markMissed(correlationId: Uuid): void {
    if (this.status !== 'ACTIVE' && this.status !== 'IN_PROGRESS') throw new ValidationError(`Cannot mark missed from ${this.status}`);
    this.status = 'MISSED';
    this.addDomainEvent(new GoalMissed({ tenantId: this.tenantId, aggregateId: this.id, correlationId }));
    this.incrementVersion();
    this.updatedAt = new Date();
  }

  cancel(correlationId: Uuid): void {
    if (this.status === 'ACHIEVED' || this.status === 'MISSED' || this.status === 'CANCELLED') throw new ValidationError(`Cannot cancel from ${this.status}`);
    this.status = 'CANCELLED';
    this.addDomainEvent(new GoalCancelled({ tenantId: this.tenantId, aggregateId: this.id, correlationId }));
    this.incrementVersion();
    this.updatedAt = new Date();
  }
}
