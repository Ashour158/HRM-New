/**
 * @hrDataClassification CONFIDENTIAL - review, rating, goal, competency, calibration, 360 feedback, PIP, and development-plan fields.
 */
import { AggregateRoot, DomainEvent, Uuid, Guard, ValidationError } from '@hcm/shared-kernel';

export type KeyResultStatus = 'DRAFT' | 'ACTIVE' | 'IN_PROGRESS' | 'ACHIEVED' | 'PARTIAL' | 'MISSED' | 'CANCELLED';

export interface KeyResultProps {
  id: Uuid;
  tenantId: Uuid;
  objectiveId: Uuid;
  title: string;
  description?: string;
  targetValue: number;
  currentValue?: number;
  startValue?: number;
  unit?: string;
  scoringMethod?: string;
  progress?: number;
  status?: KeyResultStatus;
  dueDate?: Date;
  aggregateVersion?: number;
  createdAt?: Date;
  updatedAt?: Date;
}

export class KeyResultCreated extends DomainEvent {
  constructor(props: { tenantId: Uuid; aggregateId: Uuid; correlationId: Uuid }) {
    super({ eventName: 'KeyResultCreated', tenantId: props.tenantId, aggregateType: 'KeyResult', aggregateId: props.aggregateId, correlationId: props.correlationId });
  }
}

export class KeyResultActivated extends DomainEvent {
  constructor(props: { tenantId: Uuid; aggregateId: Uuid; correlationId: Uuid }) {
    super({ eventName: 'KeyResultActivated', tenantId: props.tenantId, aggregateType: 'KeyResult', aggregateId: props.aggregateId, correlationId: props.correlationId });
  }
}

export class KeyResultProgressUpdated extends DomainEvent {
  constructor(props: { tenantId: Uuid; aggregateId: Uuid; correlationId: Uuid }) {
    super({ eventName: 'KeyResultProgressUpdated', tenantId: props.tenantId, aggregateType: 'KeyResult', aggregateId: props.aggregateId, correlationId: props.correlationId });
  }
}

export class KeyResultAchieved extends DomainEvent {
  constructor(props: { tenantId: Uuid; aggregateId: Uuid; correlationId: Uuid }) {
    super({ eventName: 'KeyResultAchieved', tenantId: props.tenantId, aggregateType: 'KeyResult', aggregateId: props.aggregateId, correlationId: props.correlationId });
  }
}

export class KeyResultCancelled extends DomainEvent {
  constructor(props: { tenantId: Uuid; aggregateId: Uuid; correlationId: Uuid }) {
    super({ eventName: 'KeyResultCancelled', tenantId: props.tenantId, aggregateType: 'KeyResult', aggregateId: props.aggregateId, correlationId: props.correlationId });
  }
}

export class KeyResult extends AggregateRoot {
  private _aggregateVersion = 0;
  readonly tenantId: Uuid;
  objectiveId: Uuid;
  title: string;
  description?: string;
  targetValue: number;
  currentValue: number;
  startValue: number;
  unit?: string;
  scoringMethod: string;
  progress: number;
  status: KeyResultStatus;
  dueDate?: Date;
  createdAt: Date;
  updatedAt: Date;

  get version(): number { return this._aggregateVersion; }
  get aggregateVersion(): number { return this._aggregateVersion; }
  incrementVersion(): void { this._aggregateVersion++; }

  constructor(props: KeyResultProps) {
    super(props.id);
    this.tenantId = props.tenantId;
    this.objectiveId = props.objectiveId;
    this.title = props.title;
    this.description = props.description;
    this.targetValue = props.targetValue;
    this.currentValue = props.currentValue ?? 0;
    this.startValue = props.startValue ?? 0;
    this.unit = props.unit;
    this.scoringMethod = props.scoringMethod ?? 'LINEAR';
    this.progress = props.progress ?? 0;
    this.status = props.status ?? 'DRAFT';
    this.dueDate = props.dueDate;
    this.createdAt = props.createdAt ?? new Date();
    this.updatedAt = props.updatedAt ?? new Date();
    if (props.aggregateVersion !== undefined) this._aggregateVersion = props.aggregateVersion;
  }

  static create(props: KeyResultProps, correlationId: Uuid): KeyResult {
    Guard.againstEmptyString(props.title, 'title');
    const ar = new KeyResult({ ...props, status: 'DRAFT', currentValue: 0, startValue: props.startValue ?? 0, progress: 0, createdAt: new Date(), updatedAt: new Date() });
    ar.addDomainEvent(new KeyResultCreated({ tenantId: ar.tenantId, aggregateId: ar.id, correlationId }));
    return ar;
  }

  activate(correlationId: Uuid): void {
    if (this.status !== 'DRAFT') throw new ValidationError(`Cannot activate from ${this.status}`);
    this.status = 'ACTIVE';
    this.addDomainEvent(new KeyResultActivated({ tenantId: this.tenantId, aggregateId: this.id, correlationId }));
    this.incrementVersion();
    this.updatedAt = new Date();
  }

  updateProgress(currentValue: number, correlationId: Uuid): void {
    if (this.status !== 'ACTIVE' && this.status !== 'IN_PROGRESS') throw new ValidationError(`Cannot update progress from ${this.status}`);
    this.currentValue = currentValue;
    const range = this.targetValue - this.startValue;
    const achieved = this.currentValue - this.startValue;
    this.progress = range === 0 ? 0 : Math.min(100, Math.max(0, (achieved / range) * 100));
    if (this.progress >= 100) {
      this.status = 'ACHIEVED';
      this.addDomainEvent(new KeyResultAchieved({ tenantId: this.tenantId, aggregateId: this.id, correlationId }));
    } else {
      this.status = 'IN_PROGRESS';
      this.addDomainEvent(new KeyResultProgressUpdated({ tenantId: this.tenantId, aggregateId: this.id, correlationId }));
    }
    this.incrementVersion();
    this.updatedAt = new Date();
  }

  markAchieved(correlationId: Uuid): void {
    if (this.status !== 'ACTIVE' && this.status !== 'IN_PROGRESS') throw new ValidationError(`Cannot mark achieved from ${this.status}`);
    this.status = 'ACHIEVED';
    this.currentValue = this.targetValue;
    this.progress = 100;
    this.addDomainEvent(new KeyResultAchieved({ tenantId: this.tenantId, aggregateId: this.id, correlationId }));
    this.incrementVersion();
    this.updatedAt = new Date();
  }

  cancel(correlationId: Uuid): void {
    if (this.status === 'ACHIEVED' || this.status === 'CANCELLED') throw new ValidationError(`Cannot cancel from ${this.status}`);
    this.status = 'CANCELLED';
    this.addDomainEvent(new KeyResultCancelled({ tenantId: this.tenantId, aggregateId: this.id, correlationId }));
    this.incrementVersion();
    this.updatedAt = new Date();
  }
}
