import { AggregateRoot, DomainEvent, Uuid, Guard, ValidationError } from '@hcm/shared-kernel';

export type TimesheetStatus = 'DRAFT' | 'SUBMITTED' | 'APPROVED' | 'REJECTED' | 'CORRECTED';

export interface TimesheetEntry {
  date: Date;
  hours: number;
  projectCode?: string;
}

export interface TimesheetProps {
  id: Uuid;
  tenantId: Uuid;
  workerId: Uuid;
  periodStart: Date;
  periodEnd: Date;
  entries?: TimesheetEntry[];
  totalHours?: number;
  status?: TimesheetStatus;
  submittedAt?: Date;
  approvedBy?: Uuid;
  approvedAt?: Date;
  aggregateVersion?: number;
  createdAt?: Date;
  updatedAt?: Date;
}

export class TimesheetCreated extends DomainEvent {
  constructor(props: { tenantId: Uuid; aggregateId: Uuid; correlationId: Uuid }) {
    super({ eventName: 'TimesheetCreated', tenantId: props.tenantId, aggregateType: 'Timesheet', aggregateId: props.aggregateId, correlationId: props.correlationId });
  }
}

export class TimesheetSubmitted extends DomainEvent {
  constructor(props: { tenantId: Uuid; aggregateId: Uuid; correlationId: Uuid }) {
    super({ eventName: 'TimesheetSubmitted', tenantId: props.tenantId, aggregateType: 'Timesheet', aggregateId: props.aggregateId, correlationId: props.correlationId });
  }
}

export class TimesheetApproved extends DomainEvent {
  readonly approvedBy: string;
  constructor(props: { tenantId: Uuid; aggregateId: Uuid; correlationId: Uuid; approvedBy: Uuid }) {
    super({ eventName: 'TimesheetApproved', tenantId: props.tenantId, aggregateType: 'Timesheet', aggregateId: props.aggregateId, correlationId: props.correlationId });
    this.approvedBy = props.approvedBy.value;
  }
}

export class TimesheetRejected extends DomainEvent {
  constructor(props: { tenantId: Uuid; aggregateId: Uuid; correlationId: Uuid }) {
    super({ eventName: 'TimesheetRejected', tenantId: props.tenantId, aggregateType: 'Timesheet', aggregateId: props.aggregateId, correlationId: props.correlationId });
  }
}

export class TimesheetCorrected extends DomainEvent {
  constructor(props: { tenantId: Uuid; aggregateId: Uuid; correlationId: Uuid }) {
    super({ eventName: 'TimesheetCorrected', tenantId: props.tenantId, aggregateType: 'Timesheet', aggregateId: props.aggregateId, correlationId: props.correlationId });
  }
}

export class Timesheet extends AggregateRoot {
  private _aggregateVersion = 0;
  readonly tenantId: Uuid;
  workerId: Uuid;
  periodStart: Date;
  periodEnd: Date;
  entries: TimesheetEntry[];
  totalHours: number;
  status: TimesheetStatus;
  submittedAt?: Date;
  approvedBy?: Uuid;
  approvedAt?: Date;
  createdAt: Date;
  updatedAt: Date;

  get version(): number { return this._aggregateVersion; }
  get aggregateVersion(): number { return this._aggregateVersion; }
  incrementVersion(): void { this._aggregateVersion++; }

  constructor(props: TimesheetProps) {
    super(props.id);
    this.tenantId = props.tenantId;
    this.workerId = props.workerId;
    this.periodStart = props.periodStart;
    this.periodEnd = props.periodEnd;
    this.entries = props.entries ?? [];
    this.totalHours = props.totalHours ?? this.entries.reduce((sum, e) => sum + e.hours, 0);
    this.status = props.status ?? 'DRAFT';
    this.submittedAt = props.submittedAt;
    this.approvedBy = props.approvedBy;
    this.approvedAt = props.approvedAt;
    this.createdAt = props.createdAt ?? new Date();
    this.updatedAt = props.updatedAt ?? new Date();
    if (props.aggregateVersion !== undefined) this._aggregateVersion = props.aggregateVersion;
  }

  static create(props: TimesheetProps, correlationId: Uuid): Timesheet {
    Guard.againstFutureDate(props.periodStart, 'periodStart');
    const ts = new Timesheet({ ...props, status: 'DRAFT', createdAt: new Date(), updatedAt: new Date() });
    ts.addDomainEvent(new TimesheetCreated({ tenantId: ts.tenantId, aggregateId: ts.id, correlationId }));
    return ts;
  }

  submit(correlationId: Uuid): void {
    if (this.status !== 'DRAFT' && this.status !== 'CORRECTED') throw new ValidationError(`Cannot submit from ${this.status}`);
    this.status = 'SUBMITTED';
    this.submittedAt = new Date();
    this.addDomainEvent(new TimesheetSubmitted({ tenantId: this.tenantId, aggregateId: this.id, correlationId }));
    this.incrementVersion();
    this.updatedAt = new Date();
  }

  approve(approvedBy: Uuid, correlationId: Uuid): void {
    if (this.status !== 'SUBMITTED') throw new ValidationError(`Cannot approve from ${this.status}`);
    this.status = 'APPROVED';
    this.approvedBy = approvedBy;
    this.approvedAt = new Date();
    this.addDomainEvent(new TimesheetApproved({ tenantId: this.tenantId, aggregateId: this.id, correlationId, approvedBy }));
    this.incrementVersion();
    this.updatedAt = new Date();
  }

  reject(correlationId: Uuid): void {
    if (this.status !== 'SUBMITTED') throw new ValidationError(`Cannot reject from ${this.status}`);
    this.status = 'REJECTED';
    this.addDomainEvent(new TimesheetRejected({ tenantId: this.tenantId, aggregateId: this.id, correlationId }));
    this.incrementVersion();
    this.updatedAt = new Date();
  }

  correct(correlationId: Uuid): void {
    if (this.status !== 'REJECTED') throw new ValidationError(`Cannot correct from ${this.status}`);
    this.status = 'CORRECTED';
    this.addDomainEvent(new TimesheetCorrected({ tenantId: this.tenantId, aggregateId: this.id, correlationId }));
    this.incrementVersion();
    this.updatedAt = new Date();
  }
}
