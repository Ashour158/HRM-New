import { AggregateRoot, DomainEvent, Uuid, Guard, ValidationError } from '@hcm/shared-kernel';

export type HrServiceCaseStatus = 'OPEN' | 'IN_PROGRESS' | 'PENDING_CUSTOMER' | 'RESOLVED' | 'CLOSED' | 'ESCALATED';

export interface HrServiceCaseProps {
  id: Uuid;
  tenantId: Uuid;
  caseNumber: string;
  requesterWorkerId: Uuid;
  caseType: string;
  priority: string;
  description: string;
  assignedTo?: Uuid;
  slaDeadline?: Date;
  resolvedAt?: Date;
  status?: HrServiceCaseStatus;
  aggregateVersion?: number;
  createdAt?: Date;
  updatedAt?: Date;
}

export class HrServiceCaseOpened extends DomainEvent {
  constructor(props: { tenantId: Uuid; aggregateId: Uuid; correlationId: Uuid }) {
    super({ eventName: 'HrServiceCaseOpened', tenantId: props.tenantId, aggregateType: 'HrServiceCase', aggregateId: props.aggregateId, correlationId: props.correlationId });
  }
}

export class HrServiceCaseInProgress extends DomainEvent {
  constructor(props: { tenantId: Uuid; aggregateId: Uuid; correlationId: Uuid }) {
    super({ eventName: 'HrServiceCaseInProgress', tenantId: props.tenantId, aggregateType: 'HrServiceCase', aggregateId: props.aggregateId, correlationId: props.correlationId });
  }
}

export class HrServiceCasePendingCustomer extends DomainEvent {
  constructor(props: { tenantId: Uuid; aggregateId: Uuid; correlationId: Uuid }) {
    super({ eventName: 'HrServiceCasePendingCustomer', tenantId: props.tenantId, aggregateType: 'HrServiceCase', aggregateId: props.aggregateId, correlationId: props.correlationId });
  }
}

export class HrServiceCaseResolved extends DomainEvent {
  constructor(props: { tenantId: Uuid; aggregateId: Uuid; correlationId: Uuid }) {
    super({ eventName: 'HrServiceCaseResolved', tenantId: props.tenantId, aggregateType: 'HrServiceCase', aggregateId: props.aggregateId, correlationId: props.correlationId });
  }
}

export class HrServiceCaseClosed extends DomainEvent {
  constructor(props: { tenantId: Uuid; aggregateId: Uuid; correlationId: Uuid }) {
    super({ eventName: 'HrServiceCaseClosed', tenantId: props.tenantId, aggregateType: 'HrServiceCase', aggregateId: props.aggregateId, correlationId: props.correlationId });
  }
}

export class HrServiceCase extends AggregateRoot {
  private _aggregateVersion = 0;
  readonly tenantId: Uuid;
  caseNumber: string;
  requesterWorkerId: Uuid;
  caseType: string;
  priority: string;
  description: string;
  assignedTo?: Uuid;
  slaDeadline?: Date;
  resolvedAt?: Date;
  status: HrServiceCaseStatus;
  createdAt: Date;
  updatedAt: Date;

  get version(): number { return this._aggregateVersion; }
  get aggregateVersion(): number { return this._aggregateVersion; }
  incrementVersion(): void { this._aggregateVersion++; }

  constructor(props: HrServiceCaseProps) {
    super(props.id);
    this.tenantId = props.tenantId;
    this.caseNumber = props.caseNumber;
    this.requesterWorkerId = props.requesterWorkerId;
    this.caseType = props.caseType;
    this.priority = props.priority;
    this.description = props.description;
    this.assignedTo = props.assignedTo;
    this.slaDeadline = props.slaDeadline;
    this.resolvedAt = props.resolvedAt;
    this.status = props.status ?? 'OPEN';
    this.createdAt = props.createdAt ?? new Date();
    this.updatedAt = props.updatedAt ?? new Date();
    if (props.aggregateVersion !== undefined) this._aggregateVersion = props.aggregateVersion;
  }

  static open(props: HrServiceCaseProps, correlationId: Uuid): HrServiceCase {
    Guard.againstEmptyString(props.caseNumber, 'caseNumber');
    const sc = new HrServiceCase({ ...props, status: 'OPEN', createdAt: new Date(), updatedAt: new Date() });
    sc.addDomainEvent(new HrServiceCaseOpened({ tenantId: sc.tenantId, aggregateId: sc.id, correlationId }));
    return sc;
  }

  markInProgress(correlationId: Uuid): void {
    if (this.status !== 'OPEN') throw new ValidationError(`Cannot mark in progress from ${this.status}`);
    this.status = 'IN_PROGRESS';
    this.addDomainEvent(new HrServiceCaseInProgress({ tenantId: this.tenantId, aggregateId: this.id, correlationId }));
    this.incrementVersion();
    this.updatedAt = new Date();
  }

  markPendingCustomer(correlationId: Uuid): void {
    if (this.status !== 'IN_PROGRESS') throw new ValidationError(`Cannot mark pending customer from ${this.status}`);
    this.status = 'PENDING_CUSTOMER';
    this.addDomainEvent(new HrServiceCasePendingCustomer({ tenantId: this.tenantId, aggregateId: this.id, correlationId }));
    this.incrementVersion();
    this.updatedAt = new Date();
  }

  resolve(correlationId: Uuid): void {
    if (this.status !== 'IN_PROGRESS' && this.status !== 'PENDING_CUSTOMER') throw new ValidationError(`Cannot resolve from ${this.status}`);
    this.status = 'RESOLVED';
    this.resolvedAt = new Date();
    this.addDomainEvent(new HrServiceCaseResolved({ tenantId: this.tenantId, aggregateId: this.id, correlationId }));
    this.incrementVersion();
    this.updatedAt = new Date();
  }

  close(correlationId: Uuid): void {
    if (this.status !== 'RESOLVED') throw new ValidationError(`Cannot close from ${this.status}`);
    this.status = 'CLOSED';
    this.addDomainEvent(new HrServiceCaseClosed({ tenantId: this.tenantId, aggregateId: this.id, correlationId }));
    this.incrementVersion();
    this.updatedAt = new Date();
  }
}
