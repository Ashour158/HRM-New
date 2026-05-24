import { AggregateRoot, DomainEvent, Uuid, Guard, ValidationError } from '@hcm/shared-kernel';

export type PayrollCycleStatus = 'DRAFT' | 'OPENED' | 'INPUT_COLLECTION' | 'VALIDATION' | 'CALCULATION' | 'REVIEW' | 'APPROVED' | 'CLOSED' | 'EXPORTED' | 'CANCELLED';

export interface PayrollCycleProps {
  id: Uuid;
  tenantId: Uuid;
  cycleName: string;
  payPeriodStart: Date;
  payPeriodEnd: Date;
  payDate?: Date;
  status?: PayrollCycleStatus;
  openedAt?: Date;
  closedAt?: Date;
  approvedBy?: Uuid;
  approvedAt?: Date;
  aggregateVersion?: number;
  createdAt?: Date;
  updatedAt?: Date;
}

export class PayrollCycleOpened extends DomainEvent {
  constructor(props: { tenantId: Uuid; aggregateId: Uuid; correlationId: Uuid }) {
    super({ eventName: 'PayrollCycleOpened', tenantId: props.tenantId, aggregateType: 'PayrollCycle', aggregateId: props.aggregateId, correlationId: props.correlationId });
  }
}

export class PayrollCycleClosed extends DomainEvent {
  constructor(props: { tenantId: Uuid; aggregateId: Uuid; correlationId: Uuid }) {
    super({ eventName: 'PayrollCycleClosed', tenantId: props.tenantId, aggregateType: 'PayrollCycle', aggregateId: props.aggregateId, correlationId: props.correlationId });
  }
}

export class PayrollCycleApproved extends DomainEvent {
  readonly approvedBy: string;
  constructor(props: { tenantId: Uuid; aggregateId: Uuid; correlationId: Uuid; approvedBy: Uuid }) {
    super({ eventName: 'PayrollCycleApproved', tenantId: props.tenantId, aggregateType: 'PayrollCycle', aggregateId: props.aggregateId, correlationId: props.correlationId });
    this.approvedBy = props.approvedBy.value;
  }
}

export class PayrollCycleCancelled extends DomainEvent {
  constructor(props: { tenantId: Uuid; aggregateId: Uuid; correlationId: Uuid }) {
    super({ eventName: 'PayrollCycleCancelled', tenantId: props.tenantId, aggregateType: 'PayrollCycle', aggregateId: props.aggregateId, correlationId: props.correlationId });
  }
}

export class PayrollCycle extends AggregateRoot {
  private _aggregateVersion = 0;
  readonly tenantId: Uuid;
  cycleName: string;
  payPeriodStart: Date;
  payPeriodEnd: Date;
  payDate?: Date;
  status: PayrollCycleStatus;
  openedAt?: Date;
  closedAt?: Date;
  approvedBy?: Uuid;
  approvedAt?: Date;
  createdAt: Date;
  updatedAt: Date;

  get version(): number { return this._aggregateVersion; }
  get aggregateVersion(): number { return this._aggregateVersion; }
  incrementVersion(): void { this._aggregateVersion++; }

  constructor(props: PayrollCycleProps) {
    super(props.id);
    this.tenantId = props.tenantId;
    this.cycleName = props.cycleName;
    this.payPeriodStart = props.payPeriodStart;
    this.payPeriodEnd = props.payPeriodEnd;
    this.payDate = props.payDate;
    this.status = props.status ?? 'DRAFT';
    this.openedAt = props.openedAt;
    this.closedAt = props.closedAt;
    this.approvedBy = props.approvedBy;
    this.approvedAt = props.approvedAt;
    this.createdAt = props.createdAt ?? new Date();
    this.updatedAt = props.updatedAt ?? new Date();
    if (props.aggregateVersion !== undefined) this._aggregateVersion = props.aggregateVersion;
  }

  static create(props: PayrollCycleProps, _correlationId: Uuid): PayrollCycle {
    Guard.againstEmptyString(props.cycleName, 'cycleName');
    const pc = new PayrollCycle({ ...props, status: 'DRAFT', createdAt: new Date(), updatedAt: new Date() });
    return pc;
  }

  open(correlationId: Uuid): void {
    if (this.status !== 'DRAFT') throw new ValidationError(`Cannot open from ${this.status}`);
    this.status = 'OPENED';
    this.openedAt = new Date();
    this.addDomainEvent(new PayrollCycleOpened({ tenantId: this.tenantId, aggregateId: this.id, correlationId }));
    this.incrementVersion();
    this.updatedAt = new Date();
  }

  startInputCollection(_correlationId: Uuid): void {
    if (this.status !== 'OPENED') throw new ValidationError(`Cannot start input collection from ${this.status}`);
    this.status = 'INPUT_COLLECTION';
    this.incrementVersion();
    this.updatedAt = new Date();
  }

  startValidation(_correlationId: Uuid): void {
    if (this.status !== 'INPUT_COLLECTION') throw new ValidationError(`Cannot start validation from ${this.status}`);
    this.status = 'VALIDATION';
    this.incrementVersion();
    this.updatedAt = new Date();
  }

  startCalculation(_correlationId: Uuid): void {
    if (this.status !== 'VALIDATION') throw new ValidationError(`Cannot start calculation from ${this.status}`);
    this.status = 'CALCULATION';
    this.incrementVersion();
    this.updatedAt = new Date();
  }

  startReview(_correlationId: Uuid): void {
    if (this.status !== 'CALCULATION') throw new ValidationError(`Cannot start review from ${this.status}`);
    this.status = 'REVIEW';
    this.incrementVersion();
    this.updatedAt = new Date();
  }

  approve(approvedBy: Uuid, correlationId: Uuid): void {
    if (this.status !== 'REVIEW') throw new ValidationError(`Cannot approve from ${this.status}`);
    this.status = 'APPROVED';
    this.approvedBy = approvedBy;
    this.approvedAt = new Date();
    this.addDomainEvent(new PayrollCycleApproved({ tenantId: this.tenantId, aggregateId: this.id, correlationId, approvedBy }));
    this.incrementVersion();
    this.updatedAt = new Date();
  }

  close(correlationId: Uuid): void {
    if (this.status !== 'APPROVED') throw new ValidationError(`Cannot close from ${this.status}`);
    this.status = 'CLOSED';
    this.closedAt = new Date();
    this.addDomainEvent(new PayrollCycleClosed({ tenantId: this.tenantId, aggregateId: this.id, correlationId }));
    this.incrementVersion();
    this.updatedAt = new Date();
  }

  export(_correlationId: Uuid): void {
    if (this.status !== 'CLOSED') throw new ValidationError(`Cannot export from ${this.status}`);
    this.status = 'EXPORTED';
    this.incrementVersion();
    this.updatedAt = new Date();
  }

  cancel(_correlationId: Uuid): void {
    if (this.status === 'CLOSED' || this.status === 'EXPORTED') throw new ValidationError(`Cannot cancel from ${this.status}`);
    this.status = 'CANCELLED';
    this.addDomainEvent(new PayrollCycleCancelled({ tenantId: this.tenantId, aggregateId: this.id, correlationId: _correlationId }));
    this.incrementVersion();
    this.updatedAt = new Date();
  }
}
