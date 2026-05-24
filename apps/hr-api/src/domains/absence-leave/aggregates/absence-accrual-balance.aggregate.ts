import { AggregateRoot, DomainEvent, Uuid, Guard, ValidationError } from '@hcm/shared-kernel';

export type AbsenceAccrualBalanceStatus = 'ACTIVE' | 'SUSPENDED' | 'CLOSED';

export interface AbsenceAccrualBalanceProps {
  id: Uuid;
  tenantId: Uuid;
  workerId: Uuid;
  leaveType: string;
  balanceHours: number;
  accruedHours: number;
  usedHours: number;
  carriedOverHours: number;
  effectiveDate: Date;
  status?: AbsenceAccrualBalanceStatus;
  aggregateVersion?: number;
  createdAt?: Date;
  updatedAt?: Date;
}

export class AccrualBalanceCreated extends DomainEvent {
  constructor(props: { tenantId: Uuid; aggregateId: Uuid; correlationId: Uuid }) {
    super({ eventName: 'AccrualBalanceCreated', tenantId: props.tenantId, aggregateType: 'AbsenceAccrualBalance', aggregateId: props.aggregateId, correlationId: props.correlationId });
  }
}

export class AccrualBalanceUpdated extends DomainEvent {
  constructor(props: { tenantId: Uuid; aggregateId: Uuid; correlationId: Uuid }) {
    super({ eventName: 'AccrualBalanceUpdated', tenantId: props.tenantId, aggregateType: 'AbsenceAccrualBalance', aggregateId: props.aggregateId, correlationId: props.correlationId });
  }
}

export class AccrualBalanceCarriedOver extends DomainEvent {
  constructor(props: { tenantId: Uuid; aggregateId: Uuid; correlationId: Uuid }) {
    super({ eventName: 'AccrualBalanceCarriedOver', tenantId: props.tenantId, aggregateType: 'AbsenceAccrualBalance', aggregateId: props.aggregateId, correlationId: props.correlationId });
  }
}

export class AccrualBalanceClosed extends DomainEvent {
  constructor(props: { tenantId: Uuid; aggregateId: Uuid; correlationId: Uuid }) {
    super({ eventName: 'AccrualBalanceClosed', tenantId: props.tenantId, aggregateType: 'AbsenceAccrualBalance', aggregateId: props.aggregateId, correlationId: props.correlationId });
  }
}

export class AbsenceAccrualBalance extends AggregateRoot {
  private _aggregateVersion = 0;
  readonly tenantId: Uuid;
  workerId: Uuid;
  leaveType: string;
  balanceHours: number;
  accruedHours: number;
  usedHours: number;
  carriedOverHours: number;
  effectiveDate: Date;
  status: AbsenceAccrualBalanceStatus;
  createdAt: Date;
  updatedAt: Date;

  get version(): number { return this._aggregateVersion; }
  get aggregateVersion(): number { return this._aggregateVersion; }
  incrementVersion(): void { this._aggregateVersion++; }

  constructor(props: AbsenceAccrualBalanceProps) {
    super(props.id);
    this.tenantId = props.tenantId;
    this.workerId = props.workerId;
    this.leaveType = props.leaveType;
    this.balanceHours = props.balanceHours;
    this.accruedHours = props.accruedHours;
    this.usedHours = props.usedHours;
    this.carriedOverHours = props.carriedOverHours;
    this.effectiveDate = props.effectiveDate;
    this.status = props.status ?? 'ACTIVE';
    this.createdAt = props.createdAt ?? new Date();
    this.updatedAt = props.updatedAt ?? new Date();
    if (props.aggregateVersion !== undefined) this._aggregateVersion = props.aggregateVersion;
  }

  static create(props: AbsenceAccrualBalanceProps, correlationId: Uuid): AbsenceAccrualBalance {
    Guard.againstEmptyString(props.leaveType, 'leaveType');
    const ab = new AbsenceAccrualBalance({ ...props, status: 'ACTIVE', createdAt: new Date(), updatedAt: new Date() });
    ab.addDomainEvent(new AccrualBalanceCreated({ tenantId: ab.tenantId, aggregateId: ab.id, correlationId }));
    return ab;
  }

  update(props: { balanceHours?: number; accruedHours?: number; usedHours?: number }, correlationId: Uuid): void {
    if (this.status !== 'ACTIVE') throw new ValidationError(`Cannot update from ${this.status}`);
    if (props.balanceHours !== undefined) this.balanceHours = props.balanceHours;
    if (props.accruedHours !== undefined) this.accruedHours = props.accruedHours;
    if (props.usedHours !== undefined) this.usedHours = props.usedHours;
    this.addDomainEvent(new AccrualBalanceUpdated({ tenantId: this.tenantId, aggregateId: this.id, correlationId }));
    this.incrementVersion();
    this.updatedAt = new Date();
  }

  carryOver(correlationId: Uuid): void {
    if (this.status !== 'ACTIVE') throw new ValidationError(`Cannot carry over from ${this.status}`);
    this.carriedOverHours = this.balanceHours;
    this.addDomainEvent(new AccrualBalanceCarriedOver({ tenantId: this.tenantId, aggregateId: this.id, correlationId }));
    this.incrementVersion();
    this.updatedAt = new Date();
  }

  close(correlationId: Uuid): void {
    if (this.status !== 'ACTIVE') throw new ValidationError(`Cannot close from ${this.status}`);
    this.status = 'CLOSED';
    this.addDomainEvent(new AccrualBalanceClosed({ tenantId: this.tenantId, aggregateId: this.id, correlationId }));
    this.incrementVersion();
    this.updatedAt = new Date();
  }
}
