import { AggregateRoot, DomainEvent, Uuid, Guard, ValidationError } from '@hcm/shared-kernel';

export type ContingentWorkerAssignmentStatus = 'DRAFT' | 'ACTIVE' | 'EXTENDED' | 'TERMINATED';

export interface ContingentWorkerAssignmentProps {
  id: Uuid;
  tenantId: Uuid;
  workerId: Uuid;
  vendorId: Uuid;
  projectId: Uuid;
  startDate: Date;
  endDate: Date;
  /** @hrDataClassification HIGH_SENSITIVITY */
  rate: number;
  currency: string;
  status?: ContingentWorkerAssignmentStatus;
  aggregateVersion?: number;
  createdAt?: Date;
  updatedAt?: Date;
}

export class ContingentAssignmentCreated extends DomainEvent {
  constructor(props: { tenantId: Uuid; aggregateId: Uuid; correlationId: Uuid }) {
    super({ eventName: 'ContingentAssignmentCreated', tenantId: props.tenantId, aggregateType: 'ContingentWorkerAssignment', aggregateId: props.aggregateId, correlationId: props.correlationId });
  }
}

export class ContingentAssignmentActivated extends DomainEvent {
  constructor(props: { tenantId: Uuid; aggregateId: Uuid; correlationId: Uuid }) {
    super({ eventName: 'ContingentAssignmentActivated', tenantId: props.tenantId, aggregateType: 'ContingentWorkerAssignment', aggregateId: props.aggregateId, correlationId: props.correlationId });
  }
}

export class ContingentAssignmentExtended extends DomainEvent {
  constructor(props: { tenantId: Uuid; aggregateId: Uuid; correlationId: Uuid }) {
    super({ eventName: 'ContingentAssignmentExtended', tenantId: props.tenantId, aggregateType: 'ContingentWorkerAssignment', aggregateId: props.aggregateId, correlationId: props.correlationId });
  }
}

export class ContingentAssignmentTerminated extends DomainEvent {
  constructor(props: { tenantId: Uuid; aggregateId: Uuid; correlationId: Uuid }) {
    super({ eventName: 'ContingentAssignmentTerminated', tenantId: props.tenantId, aggregateType: 'ContingentWorkerAssignment', aggregateId: props.aggregateId, correlationId: props.correlationId });
  }
}

export class ContingentWorkerAssignment extends AggregateRoot {
  private _aggregateVersion = 0;
  readonly tenantId: Uuid;
  workerId: Uuid;
  vendorId: Uuid;
  projectId: Uuid;
  startDate: Date;
  endDate: Date;
  /** @hrDataClassification HIGH_SENSITIVITY */
  rate: number;
  currency: string;
  status: ContingentWorkerAssignmentStatus;
  createdAt: Date;
  updatedAt: Date;

  get version(): number { return this._aggregateVersion; }
  get aggregateVersion(): number { return this._aggregateVersion; }
  incrementVersion(): void { this._aggregateVersion++; }

  constructor(props: ContingentWorkerAssignmentProps) {
    super(props.id);
    this.tenantId = props.tenantId;
    this.workerId = props.workerId;
    this.vendorId = props.vendorId;
    this.projectId = props.projectId;
    this.startDate = props.startDate;
    this.endDate = props.endDate;
    this.rate = props.rate;
    this.currency = props.currency;
    this.status = props.status ?? 'DRAFT';
    this.createdAt = props.createdAt ?? new Date();
    this.updatedAt = props.updatedAt ?? new Date();
    if (props.aggregateVersion !== undefined) this._aggregateVersion = props.aggregateVersion;
  }

  static create(props: ContingentWorkerAssignmentProps, correlationId: Uuid): ContingentWorkerAssignment {
    Guard.againstNullOrUndefined(props.startDate, 'startDate');
    const cwa = new ContingentWorkerAssignment({ ...props, status: 'DRAFT', createdAt: new Date(), updatedAt: new Date() });
    cwa.addDomainEvent(new ContingentAssignmentCreated({ tenantId: cwa.tenantId, aggregateId: cwa.id, correlationId }));
    return cwa;
  }

  activate(correlationId: Uuid): void {
    if (this.status !== 'DRAFT') throw new ValidationError(`Cannot activate from ${this.status}`);
    this.status = 'ACTIVE';
    this.addDomainEvent(new ContingentAssignmentActivated({ tenantId: this.tenantId, aggregateId: this.id, correlationId }));
    this.incrementVersion();
    this.updatedAt = new Date();
  }

  extend(correlationId: Uuid): void {
    if (this.status !== 'ACTIVE') throw new ValidationError(`Cannot extend from ${this.status}`);
    this.status = 'EXTENDED';
    this.addDomainEvent(new ContingentAssignmentExtended({ tenantId: this.tenantId, aggregateId: this.id, correlationId }));
    this.incrementVersion();
    this.updatedAt = new Date();
  }

  terminate(correlationId: Uuid): void {
    if (this.status !== 'ACTIVE' && this.status !== 'EXTENDED') throw new ValidationError(`Cannot terminate from ${this.status}`);
    this.status = 'TERMINATED';
    this.addDomainEvent(new ContingentAssignmentTerminated({ tenantId: this.tenantId, aggregateId: this.id, correlationId }));
    this.incrementVersion();
    this.updatedAt = new Date();
  }
}
