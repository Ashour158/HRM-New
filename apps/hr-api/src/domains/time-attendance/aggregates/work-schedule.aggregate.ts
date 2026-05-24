import { AggregateRoot, DomainEvent, Uuid, Guard, ValidationError } from '@hcm/shared-kernel';

export type WorkScheduleStatus = 'DRAFT' | 'ACTIVE' | 'EXPIRED';

export interface WorkScheduleProps {
  id: Uuid;
  tenantId: Uuid;
  workerId: Uuid;
  scheduleType: string;
  startDate: Date;
  endDate?: Date;
  daysOfWeek: string[];
  hoursPerDay: number;
  timezone: string;
  status?: WorkScheduleStatus;
  aggregateVersion?: number;
  createdAt?: Date;
  updatedAt?: Date;
}

export class WorkScheduleCreated extends DomainEvent {
  constructor(props: { tenantId: Uuid; aggregateId: Uuid; correlationId: Uuid }) {
    super({ eventName: 'WorkScheduleCreated', tenantId: props.tenantId, aggregateType: 'WorkSchedule', aggregateId: props.aggregateId, correlationId: props.correlationId });
  }
}

export class WorkScheduleActivated extends DomainEvent {
  constructor(props: { tenantId: Uuid; aggregateId: Uuid; correlationId: Uuid }) {
    super({ eventName: 'WorkScheduleActivated', tenantId: props.tenantId, aggregateType: 'WorkSchedule', aggregateId: props.aggregateId, correlationId: props.correlationId });
  }
}

export class WorkScheduleExpired extends DomainEvent {
  constructor(props: { tenantId: Uuid; aggregateId: Uuid; correlationId: Uuid }) {
    super({ eventName: 'WorkScheduleExpired', tenantId: props.tenantId, aggregateType: 'WorkSchedule', aggregateId: props.aggregateId, correlationId: props.correlationId });
  }
}

export class WorkSchedule extends AggregateRoot {
  private _aggregateVersion = 0;
  readonly tenantId: Uuid;
  workerId: Uuid;
  scheduleType: string;
  startDate: Date;
  endDate?: Date;
  daysOfWeek: string[];
  hoursPerDay: number;
  timezone: string;
  status: WorkScheduleStatus;
  createdAt: Date;
  updatedAt: Date;

  get version(): number { return this._aggregateVersion; }
  get aggregateVersion(): number { return this._aggregateVersion; }
  incrementVersion(): void { this._aggregateVersion++; }

  constructor(props: WorkScheduleProps) {
    super(props.id);
    this.tenantId = props.tenantId;
    this.workerId = props.workerId;
    this.scheduleType = props.scheduleType;
    this.startDate = props.startDate;
    this.endDate = props.endDate;
    this.daysOfWeek = props.daysOfWeek;
    this.hoursPerDay = props.hoursPerDay;
    this.timezone = props.timezone;
    this.status = props.status ?? 'DRAFT';
    this.createdAt = props.createdAt ?? new Date();
    this.updatedAt = props.updatedAt ?? new Date();
    if (props.aggregateVersion !== undefined) this._aggregateVersion = props.aggregateVersion;
  }

  static create(props: WorkScheduleProps, correlationId: Uuid): WorkSchedule {
    Guard.againstEmptyString(props.scheduleType, 'scheduleType');
    Guard.againstEmptyString(props.timezone, 'timezone');
    const ws = new WorkSchedule({ ...props, status: 'DRAFT', createdAt: new Date(), updatedAt: new Date() });
    ws.addDomainEvent(new WorkScheduleCreated({ tenantId: ws.tenantId, aggregateId: ws.id, correlationId }));
    return ws;
  }

  activate(correlationId: Uuid): void {
    if (this.status !== 'DRAFT') throw new ValidationError(`Cannot activate from ${this.status}`);
    this.status = 'ACTIVE';
    this.addDomainEvent(new WorkScheduleActivated({ tenantId: this.tenantId, aggregateId: this.id, correlationId }));
    this.incrementVersion();
    this.updatedAt = new Date();
  }

  expire(correlationId: Uuid): void {
    if (this.status !== 'ACTIVE') throw new ValidationError(`Cannot expire from ${this.status}`);
    this.status = 'EXPIRED';
    this.addDomainEvent(new WorkScheduleExpired({ tenantId: this.tenantId, aggregateId: this.id, correlationId }));
    this.incrementVersion();
    this.updatedAt = new Date();
  }
}
