import { AggregateRoot, DomainEvent, Uuid, Guard, ValidationError } from '@hcm/shared-kernel';

export type TimeClockEventType = 'CLOCK_IN' | 'CLOCK_OUT' | 'BREAK_START' | 'BREAK_END';
export type TimeClockEventStatus = 'RECORDED' | 'VALIDATED' | 'EXCEPTION' | 'RESOLVED';

export interface TimeClockEventProps {
  id: Uuid;
  tenantId: Uuid;
  workerId: Uuid;
  eventType: TimeClockEventType;
  timestamp: Date;
  location?: string;
  deviceId?: string;
  status?: TimeClockEventStatus;
  aggregateVersion?: number;
  createdAt?: Date;
  updatedAt?: Date;
}

export class TimeClockEventRecorded extends DomainEvent {
  constructor(props: { tenantId: Uuid; aggregateId: Uuid; correlationId: Uuid }) {
    super({ eventName: 'TimeClockEventRecorded', tenantId: props.tenantId, aggregateType: 'TimeClockEvent', aggregateId: props.aggregateId, correlationId: props.correlationId });
  }
}

export class TimeClockEventValidated extends DomainEvent {
  constructor(props: { tenantId: Uuid; aggregateId: Uuid; correlationId: Uuid }) {
    super({ eventName: 'TimeClockEventValidated', tenantId: props.tenantId, aggregateType: 'TimeClockEvent', aggregateId: props.aggregateId, correlationId: props.correlationId });
  }
}

export class AttendanceExceptionCreated extends DomainEvent {
  constructor(props: { tenantId: Uuid; aggregateId: Uuid; correlationId: Uuid }) {
    super({ eventName: 'AttendanceExceptionCreated', tenantId: props.tenantId, aggregateType: 'TimeClockEvent', aggregateId: props.aggregateId, correlationId: props.correlationId });
  }
}

export class AttendanceExceptionResolved extends DomainEvent {
  constructor(props: { tenantId: Uuid; aggregateId: Uuid; correlationId: Uuid }) {
    super({ eventName: 'AttendanceExceptionResolved', tenantId: props.tenantId, aggregateType: 'TimeClockEvent', aggregateId: props.aggregateId, correlationId: props.correlationId });
  }
}

export class TimeClockEvent extends AggregateRoot {
  private _aggregateVersion = 0;
  readonly tenantId: Uuid;
  workerId: Uuid;
  eventType: TimeClockEventType;
  timestamp: Date;
  location?: string;
  deviceId?: string;
  status: TimeClockEventStatus;
  createdAt: Date;
  updatedAt: Date;

  get version(): number { return this._aggregateVersion; }
  get aggregateVersion(): number { return this._aggregateVersion; }
  incrementVersion(): void { this._aggregateVersion++; }

  constructor(props: TimeClockEventProps) {
    super(props.id);
    this.tenantId = props.tenantId;
    this.workerId = props.workerId;
    this.eventType = props.eventType;
    this.timestamp = props.timestamp;
    this.location = props.location;
    this.deviceId = props.deviceId;
    this.status = props.status ?? 'RECORDED';
    this.createdAt = props.createdAt ?? new Date();
    this.updatedAt = props.updatedAt ?? new Date();
    if (props.aggregateVersion !== undefined) this._aggregateVersion = props.aggregateVersion;
  }

  static record(props: TimeClockEventProps, correlationId: Uuid): TimeClockEvent {
    Guard.againstEmptyString(props.eventType, 'eventType');
    const ev = new TimeClockEvent({ ...props, status: 'RECORDED', createdAt: new Date(), updatedAt: new Date() });
    ev.addDomainEvent(new TimeClockEventRecorded({ tenantId: ev.tenantId, aggregateId: ev.id, correlationId }));
    return ev;
  }

  validate(correlationId: Uuid): void {
    if (this.status !== 'RECORDED') throw new ValidationError(`Cannot validate from ${this.status}`);
    this.status = 'VALIDATED';
    this.addDomainEvent(new TimeClockEventValidated({ tenantId: this.tenantId, aggregateId: this.id, correlationId }));
    this.incrementVersion();
    this.updatedAt = new Date();
  }

  markException(correlationId: Uuid): void {
    if (this.status !== 'RECORDED' && this.status !== 'VALIDATED') throw new ValidationError(`Cannot mark exception from ${this.status}`);
    this.status = 'EXCEPTION';
    this.addDomainEvent(new AttendanceExceptionCreated({ tenantId: this.tenantId, aggregateId: this.id, correlationId }));
    this.incrementVersion();
    this.updatedAt = new Date();
  }

  resolve(correlationId: Uuid): void {
    if (this.status !== 'EXCEPTION') throw new ValidationError(`Cannot resolve from ${this.status}`);
    this.status = 'RESOLVED';
    this.addDomainEvent(new AttendanceExceptionResolved({ tenantId: this.tenantId, aggregateId: this.id, correlationId }));
    this.incrementVersion();
    this.updatedAt = new Date();
  }
}
