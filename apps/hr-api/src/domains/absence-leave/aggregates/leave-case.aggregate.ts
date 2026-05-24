import { AggregateRoot, DomainEvent, Uuid, Guard, ValidationError } from '@hcm/shared-kernel';

export type LeaveCaseStatus = 'OPEN' | 'UNDER_REVIEW' | 'APPROVED' | 'ACTIVE' | 'RETURN_TO_WORK' | 'CLOSED' | 'REJECTED';

export interface LeaveCaseProps {
  id: Uuid;
  tenantId: Uuid;
  workerId: Uuid;
  leaveType: string;
  startDate: Date;
  expectedReturnDate?: Date;
  actualReturnDate?: Date;
  status?: LeaveCaseStatus;
  aggregateVersion?: number;
  createdAt?: Date;
  updatedAt?: Date;
}

export class LeaveCaseOpened extends DomainEvent {
  constructor(props: { tenantId: Uuid; aggregateId: Uuid; correlationId: Uuid }) {
    super({ eventName: 'LeaveCaseOpened', tenantId: props.tenantId, aggregateType: 'LeaveCase', aggregateId: props.aggregateId, correlationId: props.correlationId });
  }
}

export class LeaveCaseApproved extends DomainEvent {
  constructor(props: { tenantId: Uuid; aggregateId: Uuid; correlationId: Uuid }) {
    super({ eventName: 'LeaveCaseApproved', tenantId: props.tenantId, aggregateType: 'LeaveCase', aggregateId: props.aggregateId, correlationId: props.correlationId });
  }
}

export class LeaveCaseActive extends DomainEvent {
  constructor(props: { tenantId: Uuid; aggregateId: Uuid; correlationId: Uuid }) {
    super({ eventName: 'LeaveCaseActive', tenantId: props.tenantId, aggregateType: 'LeaveCase', aggregateId: props.aggregateId, correlationId: props.correlationId });
  }
}

export class ReturnToWorkPlanned extends DomainEvent {
  constructor(props: { tenantId: Uuid; aggregateId: Uuid; correlationId: Uuid }) {
    super({ eventName: 'ReturnToWorkPlanned', tenantId: props.tenantId, aggregateType: 'LeaveCase', aggregateId: props.aggregateId, correlationId: props.correlationId });
  }
}

export class LeaveCaseClosed extends DomainEvent {
  constructor(props: { tenantId: Uuid; aggregateId: Uuid; correlationId: Uuid }) {
    super({ eventName: 'LeaveCaseClosed', tenantId: props.tenantId, aggregateType: 'LeaveCase', aggregateId: props.aggregateId, correlationId: props.correlationId });
  }
}

export class LeaveCaseRejected extends DomainEvent {
  constructor(props: { tenantId: Uuid; aggregateId: Uuid; correlationId: Uuid }) {
    super({ eventName: 'LeaveCaseRejected', tenantId: props.tenantId, aggregateType: 'LeaveCase', aggregateId: props.aggregateId, correlationId: props.correlationId });
  }
}

export class LeaveCase extends AggregateRoot {
  private _aggregateVersion = 0;
  readonly tenantId: Uuid;
  workerId: Uuid;
  leaveType: string;
  startDate: Date;
  expectedReturnDate?: Date;
  actualReturnDate?: Date;
  status: LeaveCaseStatus;
  createdAt: Date;
  updatedAt: Date;

  get version(): number { return this._aggregateVersion; }
  get aggregateVersion(): number { return this._aggregateVersion; }
  incrementVersion(): void { this._aggregateVersion++; }

  constructor(props: LeaveCaseProps) {
    super(props.id);
    this.tenantId = props.tenantId;
    this.workerId = props.workerId;
    this.leaveType = props.leaveType;
    this.startDate = props.startDate;
    this.expectedReturnDate = props.expectedReturnDate;
    this.actualReturnDate = props.actualReturnDate;
    this.status = props.status ?? 'OPEN';
    this.createdAt = props.createdAt ?? new Date();
    this.updatedAt = props.updatedAt ?? new Date();
    if (props.aggregateVersion !== undefined) this._aggregateVersion = props.aggregateVersion;
  }

  static open(props: LeaveCaseProps, correlationId: Uuid): LeaveCase {
    Guard.againstEmptyString(props.leaveType, 'leaveType');
    const lc = new LeaveCase({ ...props, status: 'OPEN', createdAt: new Date(), updatedAt: new Date() });
    lc.addDomainEvent(new LeaveCaseOpened({ tenantId: lc.tenantId, aggregateId: lc.id, correlationId }));
    return lc;
  }

  approve(correlationId: Uuid): void {
    if (this.status !== 'OPEN' && this.status !== 'UNDER_REVIEW') throw new ValidationError(`Cannot approve from ${this.status}`);
    this.status = 'APPROVED';
    this.addDomainEvent(new LeaveCaseApproved({ tenantId: this.tenantId, aggregateId: this.id, correlationId }));
    this.incrementVersion();
    this.updatedAt = new Date();
  }

  activate(correlationId: Uuid): void {
    if (this.status !== 'APPROVED') throw new ValidationError(`Cannot activate from ${this.status}`);
    this.status = 'ACTIVE';
    this.addDomainEvent(new LeaveCaseActive({ tenantId: this.tenantId, aggregateId: this.id, correlationId }));
    this.incrementVersion();
    this.updatedAt = new Date();
  }

  planReturnToWork(correlationId: Uuid): void {
    if (this.status !== 'ACTIVE') throw new ValidationError(`Cannot plan return from ${this.status}`);
    this.status = 'RETURN_TO_WORK';
    this.addDomainEvent(new ReturnToWorkPlanned({ tenantId: this.tenantId, aggregateId: this.id, correlationId }));
    this.incrementVersion();
    this.updatedAt = new Date();
  }

  close(correlationId: Uuid): void {
    if (this.status !== 'RETURN_TO_WORK' && this.status !== 'ACTIVE') throw new ValidationError(`Cannot close from ${this.status}`);
    this.status = 'CLOSED';
    this.addDomainEvent(new LeaveCaseClosed({ tenantId: this.tenantId, aggregateId: this.id, correlationId }));
    this.incrementVersion();
    this.updatedAt = new Date();
  }

  reject(correlationId: Uuid): void {
    if (this.status !== 'OPEN' && this.status !== 'UNDER_REVIEW') throw new ValidationError(`Cannot reject from ${this.status}`);
    this.status = 'REJECTED';
    this.addDomainEvent(new LeaveCaseRejected({ tenantId: this.tenantId, aggregateId: this.id, correlationId }));
    this.incrementVersion();
    this.updatedAt = new Date();
  }
}
