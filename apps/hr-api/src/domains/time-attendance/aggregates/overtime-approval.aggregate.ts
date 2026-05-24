import { AggregateRoot, DomainEvent, Uuid, Guard, ValidationError } from '@hcm/shared-kernel';

export type OvertimeApprovalStatus = 'REQUESTED' | 'APPROVED' | 'REJECTED' | 'CANCELLED';

export interface OvertimeApprovalProps {
  id: Uuid;
  tenantId: Uuid;
  workerId: Uuid;
  requestedHours: number;
  reason: string;
  requestedAt?: Date;
  approvedBy?: Uuid;
  approvedAt?: Date;
  status?: OvertimeApprovalStatus;
  aggregateVersion?: number;
  createdAt?: Date;
  updatedAt?: Date;
}

export class OvertimeRequested extends DomainEvent {
  constructor(props: { tenantId: Uuid; aggregateId: Uuid; correlationId: Uuid }) {
    super({ eventName: 'OvertimeRequested', tenantId: props.tenantId, aggregateType: 'OvertimeApproval', aggregateId: props.aggregateId, correlationId: props.correlationId });
  }
}

export class OvertimeApproved extends DomainEvent {
  readonly approvedBy: string;
  constructor(props: { tenantId: Uuid; aggregateId: Uuid; correlationId: Uuid; approvedBy: Uuid }) {
    super({ eventName: 'OvertimeApproved', tenantId: props.tenantId, aggregateType: 'OvertimeApproval', aggregateId: props.aggregateId, correlationId: props.correlationId });
    this.approvedBy = props.approvedBy.value;
  }
}

export class OvertimeRejected extends DomainEvent {
  constructor(props: { tenantId: Uuid; aggregateId: Uuid; correlationId: Uuid }) {
    super({ eventName: 'OvertimeRejected', tenantId: props.tenantId, aggregateType: 'OvertimeApproval', aggregateId: props.aggregateId, correlationId: props.correlationId });
  }
}

export class OvertimeCancelled extends DomainEvent {
  constructor(props: { tenantId: Uuid; aggregateId: Uuid; correlationId: Uuid }) {
    super({ eventName: 'OvertimeCancelled', tenantId: props.tenantId, aggregateType: 'OvertimeApproval', aggregateId: props.aggregateId, correlationId: props.correlationId });
  }
}

export class OvertimeApproval extends AggregateRoot {
  private _aggregateVersion = 0;
  readonly tenantId: Uuid;
  workerId: Uuid;
  requestedHours: number;
  reason: string;
  requestedAt: Date;
  approvedBy?: Uuid;
  approvedAt?: Date;
  status: OvertimeApprovalStatus;
  createdAt: Date;
  updatedAt: Date;

  get version(): number { return this._aggregateVersion; }
  get aggregateVersion(): number { return this._aggregateVersion; }
  incrementVersion(): void { this._aggregateVersion++; }

  constructor(props: OvertimeApprovalProps) {
    super(props.id);
    this.tenantId = props.tenantId;
    this.workerId = props.workerId;
    this.requestedHours = props.requestedHours;
    this.reason = props.reason;
    this.requestedAt = props.requestedAt ?? new Date();
    this.approvedBy = props.approvedBy;
    this.approvedAt = props.approvedAt;
    this.status = props.status ?? 'REQUESTED';
    this.createdAt = props.createdAt ?? new Date();
    this.updatedAt = props.updatedAt ?? new Date();
    if (props.aggregateVersion !== undefined) this._aggregateVersion = props.aggregateVersion;
  }

  static request(props: OvertimeApprovalProps, correlationId: Uuid): OvertimeApproval {
    Guard.againstNullOrUndefined(props.requestedHours, 'requestedHours');
    const ot = new OvertimeApproval({ ...props, status: 'REQUESTED', requestedAt: new Date(), createdAt: new Date(), updatedAt: new Date() });
    ot.addDomainEvent(new OvertimeRequested({ tenantId: ot.tenantId, aggregateId: ot.id, correlationId }));
    return ot;
  }

  approve(approvedBy: Uuid, correlationId: Uuid): void {
    if (this.status !== 'REQUESTED') throw new ValidationError(`Cannot approve from ${this.status}`);
    this.status = 'APPROVED';
    this.approvedBy = approvedBy;
    this.approvedAt = new Date();
    this.addDomainEvent(new OvertimeApproved({ tenantId: this.tenantId, aggregateId: this.id, correlationId, approvedBy }));
    this.incrementVersion();
    this.updatedAt = new Date();
  }

  reject(correlationId: Uuid): void {
    if (this.status !== 'REQUESTED') throw new ValidationError(`Cannot reject from ${this.status}`);
    this.status = 'REJECTED';
    this.addDomainEvent(new OvertimeRejected({ tenantId: this.tenantId, aggregateId: this.id, correlationId }));
    this.incrementVersion();
    this.updatedAt = new Date();
  }

  cancel(correlationId: Uuid): void {
    if (this.status !== 'REQUESTED') throw new ValidationError(`Cannot cancel from ${this.status}`);
    this.status = 'CANCELLED';
    this.addDomainEvent(new OvertimeCancelled({ tenantId: this.tenantId, aggregateId: this.id, correlationId }));
    this.incrementVersion();
    this.updatedAt = new Date();
  }
}
