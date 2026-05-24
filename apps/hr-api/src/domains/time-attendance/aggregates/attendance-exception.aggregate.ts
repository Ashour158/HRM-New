import { AggregateRoot, DomainEvent, Uuid, Guard, ValidationError } from '@hcm/shared-kernel';

export type AttendanceExceptionStatus = 'OPEN' | 'UNDER_REVIEW' | 'RESOLVED' | 'ESCALATED';

export interface AttendanceExceptionProps {
  id: Uuid;
  tenantId: Uuid;
  workerId: Uuid;
  exceptionType: string;
  description: string;
  detectedAt: Date;
  resolvedAt?: Date;
  resolvedBy?: Uuid;
  status?: AttendanceExceptionStatus;
  aggregateVersion?: number;
  createdAt?: Date;
  updatedAt?: Date;
}

export class AttendanceExceptionCreatedEvent extends DomainEvent {
  constructor(props: { tenantId: Uuid; aggregateId: Uuid; correlationId: Uuid }) {
    super({ eventName: 'AttendanceExceptionCreated', tenantId: props.tenantId, aggregateType: 'AttendanceException', aggregateId: props.aggregateId, correlationId: props.correlationId });
  }
}

export class AttendanceExceptionReviewed extends DomainEvent {
  constructor(props: { tenantId: Uuid; aggregateId: Uuid; correlationId: Uuid }) {
    super({ eventName: 'AttendanceExceptionReviewed', tenantId: props.tenantId, aggregateType: 'AttendanceException', aggregateId: props.aggregateId, correlationId: props.correlationId });
  }
}

export class AttendanceExceptionResolvedEvent extends DomainEvent {
  readonly resolvedBy: string;
  constructor(props: { tenantId: Uuid; aggregateId: Uuid; correlationId: Uuid; resolvedBy: Uuid }) {
    super({ eventName: 'AttendanceExceptionResolved', tenantId: props.tenantId, aggregateType: 'AttendanceException', aggregateId: props.aggregateId, correlationId: props.correlationId });
    this.resolvedBy = props.resolvedBy.value;
  }
}

export class AttendanceExceptionEscalated extends DomainEvent {
  constructor(props: { tenantId: Uuid; aggregateId: Uuid; correlationId: Uuid }) {
    super({ eventName: 'AttendanceExceptionEscalated', tenantId: props.tenantId, aggregateType: 'AttendanceException', aggregateId: props.aggregateId, correlationId: props.correlationId });
  }
}

export class AttendanceException extends AggregateRoot {
  private _aggregateVersion = 0;
  readonly tenantId: Uuid;
  workerId: Uuid;
  exceptionType: string;
  description: string;
  detectedAt: Date;
  resolvedAt?: Date;
  resolvedBy?: Uuid;
  status: AttendanceExceptionStatus;
  createdAt: Date;
  updatedAt: Date;

  get version(): number { return this._aggregateVersion; }
  get aggregateVersion(): number { return this._aggregateVersion; }
  incrementVersion(): void { this._aggregateVersion++; }

  constructor(props: AttendanceExceptionProps) {
    super(props.id);
    this.tenantId = props.tenantId;
    this.workerId = props.workerId;
    this.exceptionType = props.exceptionType;
    this.description = props.description;
    this.detectedAt = props.detectedAt;
    this.resolvedAt = props.resolvedAt;
    this.resolvedBy = props.resolvedBy;
    this.status = props.status ?? 'OPEN';
    this.createdAt = props.createdAt ?? new Date();
    this.updatedAt = props.updatedAt ?? new Date();
    if (props.aggregateVersion !== undefined) this._aggregateVersion = props.aggregateVersion;
  }

  static create(props: AttendanceExceptionProps, correlationId: Uuid): AttendanceException {
    Guard.againstEmptyString(props.exceptionType, 'exceptionType');
    const ex = new AttendanceException({ ...props, status: 'OPEN', createdAt: new Date(), updatedAt: new Date() });
    ex.addDomainEvent(new AttendanceExceptionCreatedEvent({ tenantId: ex.tenantId, aggregateId: ex.id, correlationId }));
    return ex;
  }

  review(correlationId: Uuid): void {
    if (this.status !== 'OPEN') throw new ValidationError(`Cannot review from ${this.status}`);
    this.status = 'UNDER_REVIEW';
    this.addDomainEvent(new AttendanceExceptionReviewed({ tenantId: this.tenantId, aggregateId: this.id, correlationId }));
    this.incrementVersion();
    this.updatedAt = new Date();
  }

  resolve(resolvedBy: Uuid, correlationId: Uuid): void {
    if (this.status !== 'OPEN' && this.status !== 'UNDER_REVIEW') throw new ValidationError(`Cannot resolve from ${this.status}`);
    this.status = 'RESOLVED';
    this.resolvedBy = resolvedBy;
    this.resolvedAt = new Date();
    this.addDomainEvent(new AttendanceExceptionResolvedEvent({ tenantId: this.tenantId, aggregateId: this.id, correlationId, resolvedBy }));
    this.incrementVersion();
    this.updatedAt = new Date();
  }

  escalate(correlationId: Uuid): void {
    if (this.status !== 'OPEN' && this.status !== 'UNDER_REVIEW') throw new ValidationError(`Cannot escalate from ${this.status}`);
    this.status = 'ESCALATED';
    this.addDomainEvent(new AttendanceExceptionEscalated({ tenantId: this.tenantId, aggregateId: this.id, correlationId }));
    this.incrementVersion();
    this.updatedAt = new Date();
  }
}
