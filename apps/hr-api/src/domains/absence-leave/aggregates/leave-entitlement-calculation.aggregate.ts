import { AggregateRoot, DomainEvent, Uuid, Guard, ValidationError } from '@hcm/shared-kernel';

export type LeaveEntitlementCalculationStatus = 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'FAILED';

export interface LeaveEntitlementCalculationProps {
  id: Uuid;
  tenantId: Uuid;
  workerId: Uuid;
  leaveType: string;
  calculatedEntitlement: number;
  usedEntitlement: number;
  remainingEntitlement: number;
  calculationDate: Date;
  status?: LeaveEntitlementCalculationStatus;
  aggregateVersion?: number;
  createdAt?: Date;
  updatedAt?: Date;
}

export class LeaveEntitlementCalculationStarted extends DomainEvent {
  constructor(props: { tenantId: Uuid; aggregateId: Uuid; correlationId: Uuid }) {
    super({ eventName: 'LeaveEntitlementCalculationStarted', tenantId: props.tenantId, aggregateType: 'LeaveEntitlementCalculation', aggregateId: props.aggregateId, correlationId: props.correlationId });
  }
}

export class LeaveEntitlementCalculated extends DomainEvent {
  constructor(props: { tenantId: Uuid; aggregateId: Uuid; correlationId: Uuid }) {
    super({ eventName: 'LeaveEntitlementCalculated', tenantId: props.tenantId, aggregateType: 'LeaveEntitlementCalculation', aggregateId: props.aggregateId, correlationId: props.correlationId });
  }
}

export class LeaveEntitlementCalculationFailed extends DomainEvent {
  constructor(props: { tenantId: Uuid; aggregateId: Uuid; correlationId: Uuid }) {
    super({ eventName: 'LeaveEntitlementCalculationFailed', tenantId: props.tenantId, aggregateType: 'LeaveEntitlementCalculation', aggregateId: props.aggregateId, correlationId: props.correlationId });
  }
}

export class LeaveEntitlementCalculation extends AggregateRoot {
  private _aggregateVersion = 0;
  readonly tenantId: Uuid;
  workerId: Uuid;
  leaveType: string;
  calculatedEntitlement: number;
  usedEntitlement: number;
  remainingEntitlement: number;
  calculationDate: Date;
  status: LeaveEntitlementCalculationStatus;
  createdAt: Date;
  updatedAt: Date;

  get version(): number { return this._aggregateVersion; }
  get aggregateVersion(): number { return this._aggregateVersion; }
  incrementVersion(): void { this._aggregateVersion++; }

  constructor(props: LeaveEntitlementCalculationProps) {
    super(props.id);
    this.tenantId = props.tenantId;
    this.workerId = props.workerId;
    this.leaveType = props.leaveType;
    this.calculatedEntitlement = props.calculatedEntitlement;
    this.usedEntitlement = props.usedEntitlement;
    this.remainingEntitlement = props.remainingEntitlement;
    this.calculationDate = props.calculationDate;
    this.status = props.status ?? 'PENDING';
    this.createdAt = props.createdAt ?? new Date();
    this.updatedAt = props.updatedAt ?? new Date();
    if (props.aggregateVersion !== undefined) this._aggregateVersion = props.aggregateVersion;
  }

  static start(props: LeaveEntitlementCalculationProps, correlationId: Uuid): LeaveEntitlementCalculation {
    Guard.againstEmptyString(props.leaveType, 'leaveType');
    const le = new LeaveEntitlementCalculation({ ...props, status: 'PENDING', createdAt: new Date(), updatedAt: new Date() });
    le.addDomainEvent(new LeaveEntitlementCalculationStarted({ tenantId: le.tenantId, aggregateId: le.id, correlationId }));
    return le;
  }

  complete(correlationId: Uuid): void {
    if (this.status !== 'PENDING' && this.status !== 'IN_PROGRESS') throw new ValidationError(`Cannot complete from ${this.status}`);
    this.status = 'COMPLETED';
    this.addDomainEvent(new LeaveEntitlementCalculated({ tenantId: this.tenantId, aggregateId: this.id, correlationId }));
    this.incrementVersion();
    this.updatedAt = new Date();
  }

  fail(correlationId: Uuid): void {
    if (this.status !== 'PENDING' && this.status !== 'IN_PROGRESS') throw new ValidationError(`Cannot fail from ${this.status}`);
    this.status = 'FAILED';
    this.addDomainEvent(new LeaveEntitlementCalculationFailed({ tenantId: this.tenantId, aggregateId: this.id, correlationId }));
    this.incrementVersion();
    this.updatedAt = new Date();
  }
}
