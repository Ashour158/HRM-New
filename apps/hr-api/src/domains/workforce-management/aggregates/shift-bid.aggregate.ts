import { AggregateRoot, DomainEvent, Uuid, Guard, ValidationError } from '@hcm/shared-kernel';

export type ShiftBidStatus = 'SUBMITTED' | 'APPROVED' | 'REJECTED' | 'CANCELLED';

export interface ShiftBidProps {
  id: Uuid;
  tenantId: Uuid;
  workerId: Uuid;
  openShiftId: Uuid;
  bidAt?: Date;
  approvedBy?: Uuid;
  approvedAt?: Date;
  status?: ShiftBidStatus;
  aggregateVersion?: number;
  createdAt?: Date;
  updatedAt?: Date;
}

export class ShiftBidSubmitted extends DomainEvent {
  constructor(props: { tenantId: Uuid; aggregateId: Uuid; correlationId: Uuid }) {
    super({ eventName: 'ShiftBidSubmitted', tenantId: props.tenantId, aggregateType: 'ShiftBid', aggregateId: props.aggregateId, correlationId: props.correlationId });
  }
}

export class ShiftBidApproved extends DomainEvent {
  readonly approvedBy: string;
  constructor(props: { tenantId: Uuid; aggregateId: Uuid; correlationId: Uuid; approvedBy: Uuid }) {
    super({ eventName: 'ShiftBidApproved', tenantId: props.tenantId, aggregateType: 'ShiftBid', aggregateId: props.aggregateId, correlationId: props.correlationId });
    this.approvedBy = props.approvedBy.value;
  }
}

export class ShiftBidRejected extends DomainEvent {
  constructor(props: { tenantId: Uuid; aggregateId: Uuid; correlationId: Uuid }) {
    super({ eventName: 'ShiftBidRejected', tenantId: props.tenantId, aggregateType: 'ShiftBid', aggregateId: props.aggregateId, correlationId: props.correlationId });
  }
}

export class ShiftBidCancelled extends DomainEvent {
  constructor(props: { tenantId: Uuid; aggregateId: Uuid; correlationId: Uuid }) {
    super({ eventName: 'ShiftBidCancelled', tenantId: props.tenantId, aggregateType: 'ShiftBid', aggregateId: props.aggregateId, correlationId: props.correlationId });
  }
}

/** ShiftBid aggregate. States: SUBMITTED → APPROVED | REJECTED | CANCELLED. */
export class ShiftBid extends AggregateRoot {
  private _aggregateVersion = 0;
  readonly tenantId: Uuid;
  workerId: Uuid;
  openShiftId: Uuid;
  bidAt: Date;
  approvedBy?: Uuid;
  approvedAt?: Date;
  status: ShiftBidStatus;
  createdAt: Date;
  updatedAt: Date;

  get version(): number { return this._aggregateVersion; }
  get aggregateVersion(): number { return this._aggregateVersion; }
  incrementVersion(): void { this._aggregateVersion++; }

  constructor(props: ShiftBidProps) {
    super(props.id);
    this.tenantId = props.tenantId;
    this.workerId = props.workerId;
    this.openShiftId = props.openShiftId;
    this.bidAt = props.bidAt ?? new Date();
    this.approvedBy = props.approvedBy;
    this.approvedAt = props.approvedAt;
    this.status = props.status ?? 'SUBMITTED';
    this.createdAt = props.createdAt ?? new Date();
    this.updatedAt = props.updatedAt ?? new Date();
    if (props.aggregateVersion !== undefined) this._aggregateVersion = props.aggregateVersion;
  }

  static create(props: ShiftBidProps, correlationId: Uuid): ShiftBid {
    Guard.againstNullOrUndefined(props.openShiftId, 'openShiftId');
    const sb = new ShiftBid({ ...props, status: 'SUBMITTED', bidAt: new Date(), createdAt: new Date(), updatedAt: new Date() });
    sb.addDomainEvent(new ShiftBidSubmitted({ tenantId: sb.tenantId, aggregateId: sb.id, correlationId }));
    return sb;
  }

  approve(approvedBy: Uuid, correlationId: Uuid): void {
    if (this.status !== 'SUBMITTED') throw new ValidationError(`Cannot approve from ${this.status}`);
    this.status = 'APPROVED';
    this.approvedBy = approvedBy;
    this.approvedAt = new Date();
    this.addDomainEvent(new ShiftBidApproved({ tenantId: this.tenantId, aggregateId: this.id, correlationId, approvedBy }));
    this.incrementVersion();
    this.updatedAt = new Date();
  }

  reject(correlationId: Uuid): void {
    if (this.status !== 'SUBMITTED') throw new ValidationError(`Cannot reject from ${this.status}`);
    this.status = 'REJECTED';
    this.addDomainEvent(new ShiftBidRejected({ tenantId: this.tenantId, aggregateId: this.id, correlationId }));
    this.incrementVersion();
    this.updatedAt = new Date();
  }

  cancel(correlationId: Uuid): void {
    if (this.status !== 'SUBMITTED') throw new ValidationError(`Cannot cancel from ${this.status}`);
    this.status = 'CANCELLED';
    this.addDomainEvent(new ShiftBidCancelled({ tenantId: this.tenantId, aggregateId: this.id, correlationId }));
    this.incrementVersion();
    this.updatedAt = new Date();
  }
}
