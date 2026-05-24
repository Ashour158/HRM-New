import { AggregateRoot, DomainEvent, Uuid, Guard, ValidationError } from '@hcm/shared-kernel';

export type ShiftScheduleStatus = 'DRAFT' | 'PUBLISHED' | 'ACTIVE' | 'ARCHIVED';

export interface ShiftScheduleProps {
  id: Uuid;
  tenantId: Uuid;
  workerId: Uuid;
  shiftDate: Date;
  startTime: Date;
  endTime: Date;
  breakDuration: number;
  departmentId: Uuid;
  status?: ShiftScheduleStatus;
  aggregateVersion?: number;
  createdAt?: Date;
  updatedAt?: Date;
}

export class ShiftScheduleCreated extends DomainEvent {
  constructor(props: { tenantId: Uuid; aggregateId: Uuid; correlationId: Uuid }) {
    super({ eventName: 'ShiftScheduleCreated', tenantId: props.tenantId, aggregateType: 'ShiftSchedule', aggregateId: props.aggregateId, correlationId: props.correlationId });
  }
}

export class ShiftSchedulePublished extends DomainEvent {
  constructor(props: { tenantId: Uuid; aggregateId: Uuid; correlationId: Uuid }) {
    super({ eventName: 'ShiftSchedulePublished', tenantId: props.tenantId, aggregateType: 'ShiftSchedule', aggregateId: props.aggregateId, correlationId: props.correlationId });
  }
}

export class ShiftScheduleActivated extends DomainEvent {
  constructor(props: { tenantId: Uuid; aggregateId: Uuid; correlationId: Uuid }) {
    super({ eventName: 'ShiftScheduleActivated', tenantId: props.tenantId, aggregateType: 'ShiftSchedule', aggregateId: props.aggregateId, correlationId: props.correlationId });
  }
}

export class ShiftScheduleArchived extends DomainEvent {
  constructor(props: { tenantId: Uuid; aggregateId: Uuid; correlationId: Uuid }) {
    super({ eventName: 'ShiftScheduleArchived', tenantId: props.tenantId, aggregateType: 'ShiftSchedule', aggregateId: props.aggregateId, correlationId: props.correlationId });
  }
}

/** ShiftSchedule aggregate for workforce management. States: DRAFT → PUBLISHED → ACTIVE → ARCHIVED. */
export class ShiftSchedule extends AggregateRoot {
  private _aggregateVersion = 0;
  readonly tenantId: Uuid;
  workerId: Uuid;
  shiftDate: Date;
  startTime: Date;
  endTime: Date;
  breakDuration: number;
  departmentId: Uuid;
  status: ShiftScheduleStatus;
  createdAt: Date;
  updatedAt: Date;

  get version(): number { return this._aggregateVersion; }
  get aggregateVersion(): number { return this._aggregateVersion; }
  incrementVersion(): void { this._aggregateVersion++; }

  constructor(props: ShiftScheduleProps) {
    super(props.id);
    this.tenantId = props.tenantId;
    this.workerId = props.workerId;
    this.shiftDate = props.shiftDate;
    this.startTime = props.startTime;
    this.endTime = props.endTime;
    this.breakDuration = props.breakDuration;
    this.departmentId = props.departmentId;
    this.status = props.status ?? 'DRAFT';
    this.createdAt = props.createdAt ?? new Date();
    this.updatedAt = props.updatedAt ?? new Date();
    if (props.aggregateVersion !== undefined) this._aggregateVersion = props.aggregateVersion;
  }

  static create(props: ShiftScheduleProps, correlationId: Uuid): ShiftSchedule {
    Guard.againstNullOrUndefined(props.shiftDate, 'shiftDate');
    const ss = new ShiftSchedule({ ...props, status: 'DRAFT', createdAt: new Date(), updatedAt: new Date() });
    ss.addDomainEvent(new ShiftScheduleCreated({ tenantId: ss.tenantId, aggregateId: ss.id, correlationId }));
    return ss;
  }

  publish(correlationId: Uuid): void {
    if (this.status !== 'DRAFT') throw new ValidationError(`Cannot publish from ${this.status}`);
    this.status = 'PUBLISHED';
    this.addDomainEvent(new ShiftSchedulePublished({ tenantId: this.tenantId, aggregateId: this.id, correlationId }));
    this.incrementVersion();
    this.updatedAt = new Date();
  }

  activate(correlationId: Uuid): void {
    if (this.status !== 'PUBLISHED') throw new ValidationError(`Cannot activate from ${this.status}`);
    this.status = 'ACTIVE';
    this.addDomainEvent(new ShiftScheduleActivated({ tenantId: this.tenantId, aggregateId: this.id, correlationId }));
    this.incrementVersion();
    this.updatedAt = new Date();
  }

  archive(correlationId: Uuid): void {
    if (this.status !== 'ACTIVE' && this.status !== 'PUBLISHED') throw new ValidationError(`Cannot archive from ${this.status}`);
    this.status = 'ARCHIVED';
    this.addDomainEvent(new ShiftScheduleArchived({ tenantId: this.tenantId, aggregateId: this.id, correlationId }));
    this.incrementVersion();
    this.updatedAt = new Date();
  }
}
