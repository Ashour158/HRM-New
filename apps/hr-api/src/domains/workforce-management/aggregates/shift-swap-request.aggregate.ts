import { AggregateRoot, DomainEvent, Uuid, Guard, ValidationError } from '@hcm/shared-kernel';

export type ShiftSwapRequestStatus = 'REQUESTED' | 'PENDING_APPROVAL' | 'APPROVED' | 'REJECTED' | 'CANCELLED';

export interface ShiftSwapRequestProps {
  id: Uuid;
  tenantId: Uuid;
  requesterWorkerId: Uuid;
  requestedWorkerId: Uuid;
  originalShiftId: Uuid;
  targetShiftId: Uuid;
  reason?: string;
  approvedBy?: Uuid;
  status?: ShiftSwapRequestStatus;
  aggregateVersion?: number;
  createdAt?: Date;
  updatedAt?: Date;
}

export class ShiftSwapRequested extends DomainEvent {
  constructor(props: { tenantId: Uuid; aggregateId: Uuid; correlationId: Uuid }) {
    super({ eventName: 'ShiftSwapRequested', tenantId: props.tenantId, aggregateType: 'ShiftSwapRequest', aggregateId: props.aggregateId, correlationId: props.correlationId });
  }
}

export class ShiftSwapApproved extends DomainEvent {
  readonly approvedBy: string;
  constructor(props: { tenantId: Uuid; aggregateId: Uuid; correlationId: Uuid; approvedBy: Uuid }) {
    super({ eventName: 'ShiftSwapApproved', tenantId: props.tenantId, aggregateType: 'ShiftSwapRequest', aggregateId: props.aggregateId, correlationId: props.correlationId });
    this.approvedBy = props.approvedBy.value;
  }
}

export class ShiftSwapRejected extends DomainEvent {
  constructor(props: { tenantId: Uuid; aggregateId: Uuid; correlationId: Uuid }) {
    super({ eventName: 'ShiftSwapRejected', tenantId: props.tenantId, aggregateType: 'ShiftSwapRequest', aggregateId: props.aggregateId, correlationId: props.correlationId });
  }
}

export class ShiftSwapCancelled extends DomainEvent {
  constructor(props: { tenantId: Uuid; aggregateId: Uuid; correlationId: Uuid }) {
    super({ eventName: 'ShiftSwapCancelled', tenantId: props.tenantId, aggregateType: 'ShiftSwapRequest', aggregateId: props.aggregateId, correlationId: props.correlationId });
  }
}

/** ShiftSwapRequest aggregate. States: REQUESTED → PENDING_APPROVAL → APPROVED | REJECTED | CANCELLED. */
export class ShiftSwapRequest extends AggregateRoot {
  private _aggregateVersion = 0;
  readonly tenantId: Uuid;
  requesterWorkerId: Uuid;
  requestedWorkerId: Uuid;
  originalShiftId: Uuid;
  targetShiftId: Uuid;
  reason?: string;
  approvedBy?: Uuid;
  status: ShiftSwapRequestStatus;
  createdAt: Date;
  updatedAt: Date;

  get version(): number { return this._aggregateVersion; }
  get aggregateVersion(): number { return this._aggregateVersion; }
  incrementVersion(): void { this._aggregateVersion++; }

  constructor(props: ShiftSwapRequestProps) {
    super(props.id);
    this.tenantId = props.tenantId;
    this.requesterWorkerId = props.requesterWorkerId;
    this.requestedWorkerId = props.requestedWorkerId;
    this.originalShiftId = props.originalShiftId;
    this.targetShiftId = props.targetShiftId;
    this.reason = props.reason;
    this.approvedBy = props.approvedBy;
    this.status = props.status ?? 'REQUESTED';
    this.createdAt = props.createdAt ?? new Date();
    this.updatedAt = props.updatedAt ?? new Date();
    if (props.aggregateVersion !== undefined) this._aggregateVersion = props.aggregateVersion;
  }

  static create(props: ShiftSwapRequestProps, correlationId: Uuid): ShiftSwapRequest {
    Guard.againstNullOrUndefined(props.originalShiftId, 'originalShiftId');
    Guard.againstNullOrUndefined(props.targetShiftId, 'targetShiftId');
    const ssr = new ShiftSwapRequest({ ...props, status: 'REQUESTED', createdAt: new Date(), updatedAt: new Date() });
    ssr.addDomainEvent(new ShiftSwapRequested({ tenantId: ssr.tenantId, aggregateId: ssr.id, correlationId }));
    return ssr;
  }

  approve(approvedBy: Uuid, correlationId: Uuid): void {
    if (this.status !== 'REQUESTED' && this.status !== 'PENDING_APPROVAL') throw new ValidationError(`Cannot approve from ${this.status}`);
    this.status = 'APPROVED';
    this.approvedBy = approvedBy;
    this.addDomainEvent(new ShiftSwapApproved({ tenantId: this.tenantId, aggregateId: this.id, correlationId, approvedBy }));
    this.incrementVersion();
    this.updatedAt = new Date();
  }

  reject(correlationId: Uuid): void {
    if (this.status !== 'REQUESTED' && this.status !== 'PENDING_APPROVAL') throw new ValidationError(`Cannot reject from ${this.status}`);
    this.status = 'REJECTED';
    this.addDomainEvent(new ShiftSwapRejected({ tenantId: this.tenantId, aggregateId: this.id, correlationId }));
    this.incrementVersion();
    this.updatedAt = new Date();
  }

  cancel(correlationId: Uuid): void {
    if (this.status !== 'REQUESTED' && this.status !== 'PENDING_APPROVAL') throw new ValidationError(`Cannot cancel from ${this.status}`);
    this.status = 'CANCELLED';
    this.addDomainEvent(new ShiftSwapCancelled({ tenantId: this.tenantId, aggregateId: this.id, correlationId }));
    this.incrementVersion();
    this.updatedAt = new Date();
  }
}
