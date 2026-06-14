/**
 * @hrDataClassification CONFIDENTIAL - review, rating, goal, competency, calibration, 360 feedback, PIP, and development-plan fields.
 */
import { AggregateRoot, DomainEvent, Uuid, ValidationError } from '@hcm/shared-kernel';

export type CalibrationSessionStatus = 'DRAFT' | 'SCHEDULED' | 'IN_PROGRESS' | 'COMPLETED' | 'FINALIZED' | 'CANCELLED';

export interface CalibrationSessionProps {
  id: Uuid;
  tenantId: Uuid;
  reviewCycleId: Uuid;
  facilitatorId: Uuid;
  participants?: string[];
  ratingsMatrix?: Record<string, unknown>;
  status?: CalibrationSessionStatus;
  aggregateVersion?: number;
  createdAt?: Date;
  updatedAt?: Date;
}

export class CalibrationSessionCreated extends DomainEvent {
  constructor(props: { tenantId: Uuid; aggregateId: Uuid; correlationId: Uuid }) {
    super({ eventName: 'CalibrationSessionCreated', tenantId: props.tenantId, aggregateType: 'CalibrationSession', aggregateId: props.aggregateId, correlationId: props.correlationId });
  }
}

export class CalibrationSessionScheduled extends DomainEvent {
  constructor(props: { tenantId: Uuid; aggregateId: Uuid; correlationId: Uuid }) {
    super({ eventName: 'CalibrationSessionScheduled', tenantId: props.tenantId, aggregateType: 'CalibrationSession', aggregateId: props.aggregateId, correlationId: props.correlationId });
  }
}

export class CalibrationSessionStarted extends DomainEvent {
  constructor(props: { tenantId: Uuid; aggregateId: Uuid; correlationId: Uuid }) {
    super({ eventName: 'CalibrationSessionStarted', tenantId: props.tenantId, aggregateType: 'CalibrationSession', aggregateId: props.aggregateId, correlationId: props.correlationId });
  }
}

export class CalibrationSessionCompleted extends DomainEvent {
  constructor(props: { tenantId: Uuid; aggregateId: Uuid; correlationId: Uuid }) {
    super({ eventName: 'CalibrationSessionCompleted', tenantId: props.tenantId, aggregateType: 'CalibrationSession', aggregateId: props.aggregateId, correlationId: props.correlationId });
  }
}

export class CalibrationSessionFinalized extends DomainEvent {
  constructor(props: { tenantId: Uuid; aggregateId: Uuid; correlationId: Uuid }) {
    super({ eventName: 'CalibrationSessionFinalized', tenantId: props.tenantId, aggregateType: 'CalibrationSession', aggregateId: props.aggregateId, correlationId: props.correlationId });
  }
}

/**
 * CalibrationSession aggregate manages performance calibration sessions.
 */
export class CalibrationSession extends AggregateRoot {
  private _aggregateVersion = 0;
  readonly tenantId: Uuid;
  reviewCycleId: Uuid;
  facilitatorId: Uuid;
  participants: string[];
  ratingsMatrix: Record<string, unknown>;
  status: CalibrationSessionStatus;
  createdAt: Date;
  updatedAt: Date;

  get version(): number { return this._aggregateVersion; }
  get aggregateVersion(): number { return this._aggregateVersion; }
  incrementVersion(): void { this._aggregateVersion++; }

  constructor(props: CalibrationSessionProps) {
    super(props.id);
    this.tenantId = props.tenantId;
    this.reviewCycleId = props.reviewCycleId;
    this.facilitatorId = props.facilitatorId;
    this.participants = props.participants ?? [];
    this.ratingsMatrix = props.ratingsMatrix ?? {};
    this.status = props.status ?? 'DRAFT';
    this.createdAt = props.createdAt ?? new Date();
    this.updatedAt = props.updatedAt ?? new Date();
    if (props.aggregateVersion !== undefined) this._aggregateVersion = props.aggregateVersion;
  }

  static create(props: CalibrationSessionProps, correlationId: Uuid): CalibrationSession {
    const ar = new CalibrationSession({ ...props, status: 'DRAFT', createdAt: new Date(), updatedAt: new Date() });
    ar.addDomainEvent(new CalibrationSessionCreated({ tenantId: ar.tenantId, aggregateId: ar.id, correlationId }));
    return ar;
  }

  schedule(correlationId: Uuid): void {
    if (this.status !== 'DRAFT') throw new ValidationError(`Cannot schedule from ${this.status}`);
    this.status = 'SCHEDULED';
    this.addDomainEvent(new CalibrationSessionScheduled({ tenantId: this.tenantId, aggregateId: this.id, correlationId }));
    this.incrementVersion();
    this.updatedAt = new Date();
  }

  start(correlationId: Uuid): void {
    if (this.status !== 'SCHEDULED') throw new ValidationError(`Cannot start from ${this.status}`);
    this.status = 'IN_PROGRESS';
    this.addDomainEvent(new CalibrationSessionStarted({ tenantId: this.tenantId, aggregateId: this.id, correlationId }));
    this.incrementVersion();
    this.updatedAt = new Date();
  }

  complete(correlationId: Uuid): void {
    if (this.status !== 'IN_PROGRESS') throw new ValidationError(`Cannot complete from ${this.status}`);
    this.status = 'COMPLETED';
    this.addDomainEvent(new CalibrationSessionCompleted({ tenantId: this.tenantId, aggregateId: this.id, correlationId }));
    this.incrementVersion();
    this.updatedAt = new Date();
  }

  finalize(correlationId: Uuid): void {
    if (this.status !== 'COMPLETED') throw new ValidationError(`Cannot finalize from ${this.status}`);
    this.status = 'FINALIZED';
    this.addDomainEvent(new CalibrationSessionFinalized({ tenantId: this.tenantId, aggregateId: this.id, correlationId }));
    this.incrementVersion();
    this.updatedAt = new Date();
  }
}
