import { AggregateRoot, DomainEvent, Uuid, Guard, ValidationError } from '@hcm/shared-kernel';

export type OpenShiftStatus = 'OPEN' | 'BID_PENDING' | 'FILLED' | 'CLOSED' | 'CANCELLED';

export interface OpenShiftProps {
  id: Uuid;
  tenantId: Uuid;
  departmentId: Uuid;
  shiftDate: Date;
  startTime: Date;
  endTime: Date;
  workplaceCode?: string;
  requiredSkills?: string[];
  bidDeadline?: Date;
  filledByWorkerId?: Uuid;
  status?: OpenShiftStatus;
  aggregateVersion?: number;
  createdAt?: Date;
  updatedAt?: Date;
}

export class OpenShiftCreated extends DomainEvent {
  constructor(props: { tenantId: Uuid; aggregateId: Uuid; correlationId: Uuid }) {
    super({ eventName: 'OpenShiftCreated', tenantId: props.tenantId, aggregateType: 'OpenShift', aggregateId: props.aggregateId, correlationId: props.correlationId });
  }
}

export class OpenShiftBidPending extends DomainEvent {
  constructor(props: { tenantId: Uuid; aggregateId: Uuid; correlationId: Uuid }) {
    super({ eventName: 'OpenShiftBidPending', tenantId: props.tenantId, aggregateType: 'OpenShift', aggregateId: props.aggregateId, correlationId: props.correlationId });
  }
}

export class OpenShiftFilled extends DomainEvent {
  readonly filledByWorkerId: string;
  constructor(props: { tenantId: Uuid; aggregateId: Uuid; correlationId: Uuid; filledByWorkerId: Uuid }) {
    super({ eventName: 'OpenShiftFilled', tenantId: props.tenantId, aggregateType: 'OpenShift', aggregateId: props.aggregateId, correlationId: props.correlationId });
    this.filledByWorkerId = props.filledByWorkerId.value;
  }
}

export class OpenShiftClosed extends DomainEvent {
  constructor(props: { tenantId: Uuid; aggregateId: Uuid; correlationId: Uuid }) {
    super({ eventName: 'OpenShiftClosed', tenantId: props.tenantId, aggregateType: 'OpenShift', aggregateId: props.aggregateId, correlationId: props.correlationId });
  }
}

export class OpenShiftCancelled extends DomainEvent {
  constructor(props: { tenantId: Uuid; aggregateId: Uuid; correlationId: Uuid }) {
    super({ eventName: 'OpenShiftCancelled', tenantId: props.tenantId, aggregateType: 'OpenShift', aggregateId: props.aggregateId, correlationId: props.correlationId });
  }
}

/** OpenShift aggregate. States: OPEN → BID_PENDING → FILLED → CLOSED, CANCELLED. */
export class OpenShift extends AggregateRoot {
  private _aggregateVersion = 0;
  readonly tenantId: Uuid;
  departmentId: Uuid;
  shiftDate: Date;
  startTime: Date;
  endTime: Date;
  workplaceCode?: string;
  requiredSkills?: string[];
  bidDeadline?: Date;
  filledByWorkerId?: Uuid;
  status: OpenShiftStatus;
  createdAt: Date;
  updatedAt: Date;

  get version(): number { return this._aggregateVersion; }
  get aggregateVersion(): number { return this._aggregateVersion; }
  incrementVersion(): void { this._aggregateVersion++; }

  constructor(props: OpenShiftProps) {
    super(props.id);
    this.tenantId = props.tenantId;
    this.departmentId = props.departmentId;
    this.shiftDate = props.shiftDate;
    this.startTime = props.startTime;
    this.endTime = props.endTime;
    this.workplaceCode = props.workplaceCode;
    this.requiredSkills = props.requiredSkills;
    this.bidDeadline = props.bidDeadline;
    this.filledByWorkerId = props.filledByWorkerId;
    this.status = props.status ?? 'OPEN';
    this.createdAt = props.createdAt ?? new Date();
    this.updatedAt = props.updatedAt ?? new Date();
    if (props.aggregateVersion !== undefined) this._aggregateVersion = props.aggregateVersion;
  }

  static create(props: OpenShiftProps, correlationId: Uuid): OpenShift {
    Guard.againstNullOrUndefined(props.shiftDate, 'shiftDate');
    const os = new OpenShift({ ...props, status: 'OPEN', createdAt: new Date(), updatedAt: new Date() });
    os.addDomainEvent(new OpenShiftCreated({ tenantId: os.tenantId, aggregateId: os.id, correlationId }));
    return os;
  }

  markBidPending(correlationId: Uuid): void {
    if (this.status !== 'OPEN') throw new ValidationError(`Cannot mark bid pending from ${this.status}`);
    this.status = 'BID_PENDING';
    this.addDomainEvent(new OpenShiftBidPending({ tenantId: this.tenantId, aggregateId: this.id, correlationId }));
    this.incrementVersion();
    this.updatedAt = new Date();
  }

  fill(filledByWorkerId: Uuid, correlationId: Uuid): void {
    if (this.status !== 'OPEN' && this.status !== 'BID_PENDING') throw new ValidationError(`Cannot fill from ${this.status}`);
    this.status = 'FILLED';
    this.filledByWorkerId = filledByWorkerId;
    this.addDomainEvent(new OpenShiftFilled({ tenantId: this.tenantId, aggregateId: this.id, correlationId, filledByWorkerId }));
    this.incrementVersion();
    this.updatedAt = new Date();
  }

  close(correlationId: Uuid): void {
    if (this.status === 'CLOSED' || this.status === 'CANCELLED') throw new ValidationError(`Cannot close from ${this.status}`);
    this.status = 'CLOSED';
    this.addDomainEvent(new OpenShiftClosed({ tenantId: this.tenantId, aggregateId: this.id, correlationId }));
    this.incrementVersion();
    this.updatedAt = new Date();
  }

  cancel(correlationId: Uuid): void {
    if (this.status === 'FILLED' || this.status === 'CLOSED' || this.status === 'CANCELLED') throw new ValidationError(`Cannot cancel from ${this.status}`);
    this.status = 'CANCELLED';
    this.addDomainEvent(new OpenShiftCancelled({ tenantId: this.tenantId, aggregateId: this.id, correlationId }));
    this.incrementVersion();
    this.updatedAt = new Date();
  }
}
