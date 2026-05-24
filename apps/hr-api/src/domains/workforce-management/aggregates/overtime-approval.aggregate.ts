import { AggregateRoot, DomainEvent, Uuid, Guard, ValidationError } from '@hcm/shared-kernel';

export type WfmOvertimeApprovalStatus = 'REQUESTED' | 'APPROVED' | 'REJECTED' | 'CANCELLED';

export interface WfmOvertimeApprovalProps {
  id: Uuid;
  tenantId: Uuid;
  workerId: Uuid;
  requestedHours: number;
  reason: string;
  shiftDate?: Date;
  requestedAt?: Date;
  approvedBy?: Uuid;
  approvedAt?: Date;
  status?: WfmOvertimeApprovalStatus;
  aggregateVersion?: number;
  createdAt?: Date;
  updatedAt?: Date;
}

export class WfmOvertimeRequested extends DomainEvent {
  constructor(props: { tenantId: Uuid; aggregateId: Uuid; correlationId: Uuid }) {
    super({ eventName: 'WfmOvertimeRequested', tenantId: props.tenantId, aggregateType: 'WfmOvertimeApproval', aggregateId: props.aggregateId, correlationId: props.correlationId });
  }
}

export class WfmOvertimeApproved extends DomainEvent {
  readonly approvedBy: string;
  constructor(props: { tenantId: Uuid; aggregateId: Uuid; correlationId: Uuid; approvedBy: Uuid }) {
    super({ eventName: 'WfmOvertimeApproved', tenantId: props.tenantId, aggregateType: 'WfmOvertimeApproval', aggregateId: props.aggregateId, correlationId: props.correlationId });
    this.approvedBy = props.approvedBy.value;
  }
}

export class WfmOvertimeRejected extends DomainEvent {
  constructor(props: { tenantId: Uuid; aggregateId: Uuid; correlationId: Uuid }) {
    super({ eventName: 'WfmOvertimeRejected', tenantId: props.tenantId, aggregateType: 'WfmOvertimeApproval', aggregateId: props.aggregateId, correlationId: props.correlationId });
  }
}

export class WfmOvertimeCancelled extends DomainEvent {
  constructor(props: { tenantId: Uuid; aggregateId: Uuid; correlationId: Uuid }) {
    super({ eventName: 'WfmOvertimeCancelled', tenantId: props.tenantId, aggregateType: 'WfmOvertimeApproval', aggregateId: props.aggregateId, correlationId: props.correlationId });
  }
}

/** WfmOvertimeApproval aggregate — extends time-attendance overtime pattern for WFM. */
export class WfmOvertimeApproval extends AggregateRoot {
  private _aggregateVersion = 0;
  readonly tenantId: Uuid;
  workerId: Uuid;
  requestedHours: number;
  reason: string;
  shiftDate?: Date;
  requestedAt: Date;
  approvedBy?: Uuid;
  approvedAt?: Date;
  status: WfmOvertimeApprovalStatus;
  createdAt: Date;
  updatedAt: Date;

  get version(): number { return this._aggregateVersion; }
  get aggregateVersion(): number { return this._aggregateVersion; }
  incrementVersion(): void { this._aggregateVersion++; }

  constructor(props: WfmOvertimeApprovalProps) {
    super(props.id);
    this.tenantId = props.tenantId;
    this.workerId = props.workerId;
    this.requestedHours = props.requestedHours;
    this.reason = props.reason;
    this.shiftDate = props.shiftDate;
    this.requestedAt = props.requestedAt ?? new Date();
    this.approvedBy = props.approvedBy;
    this.approvedAt = props.approvedAt;
    this.status = props.status ?? 'REQUESTED';
    this.createdAt = props.createdAt ?? new Date();
    this.updatedAt = props.updatedAt ?? new Date();
    if (props.aggregateVersion !== undefined) this._aggregateVersion = props.aggregateVersion;
  }

  static request(props: WfmOvertimeApprovalProps, correlationId: Uuid): WfmOvertimeApproval {
    Guard.againstNullOrUndefined(props.requestedHours, 'requestedHours');
    const ot = new WfmOvertimeApproval({ ...props, status: 'REQUESTED', requestedAt: new Date(), createdAt: new Date(), updatedAt: new Date() });
    ot.addDomainEvent(new WfmOvertimeRequested({ tenantId: ot.tenantId, aggregateId: ot.id, correlationId }));
    return ot;
  }

  approve(approvedBy: Uuid, correlationId: Uuid): void {
    if (this.status !== 'REQUESTED') throw new ValidationError(`Cannot approve from ${this.status}`);
    this.status = 'APPROVED';
    this.approvedBy = approvedBy;
    this.approvedAt = new Date();
    this.addDomainEvent(new WfmOvertimeApproved({ tenantId: this.tenantId, aggregateId: this.id, correlationId, approvedBy }));
    this.incrementVersion();
    this.updatedAt = new Date();
  }

  reject(correlationId: Uuid): void {
    if (this.status !== 'REQUESTED') throw new ValidationError(`Cannot reject from ${this.status}`);
    this.status = 'REJECTED';
    this.addDomainEvent(new WfmOvertimeRejected({ tenantId: this.tenantId, aggregateId: this.id, correlationId }));
    this.incrementVersion();
    this.updatedAt = new Date();
  }

  cancel(correlationId: Uuid): void {
    if (this.status !== 'REQUESTED') throw new ValidationError(`Cannot cancel from ${this.status}`);
    this.status = 'CANCELLED';
    this.addDomainEvent(new WfmOvertimeCancelled({ tenantId: this.tenantId, aggregateId: this.id, correlationId }));
    this.incrementVersion();
    this.updatedAt = new Date();
  }
}
