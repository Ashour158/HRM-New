import { AggregateRoot, DomainEvent, Uuid, Guard } from '@hcm/shared-kernel';

/**
 * Carrier reconciliation run lifecycle states.
 */
export type CarrierReconciliationRunStatus = 'PENDING' | 'IN_PROGRESS' | 'VARIANCE_DETECTED' | 'RECONCILED' | 'FAILED';

/**
 * Properties required to construct a {@link CarrierReconciliationRun}.
 */
export interface CarrierReconciliationRunProps {
  id: Uuid;
  tenantId: Uuid;
  carrierId: Uuid;
  periodStart: Date;
  periodEnd: Date;
  totalPremium: number;
  totalCollected: number;
  varianceAmount: number;
  currency: string;
  status: CarrierReconciliationRunStatus;
  aggregateVersion?: number;
  createdAt?: Date;
  updatedAt?: Date;
}

/* ------------------------------------------------------------------ */
/*  Domain Events                                                      */
/* ------------------------------------------------------------------ */

export class CarrierReconciliationStarted extends DomainEvent {
  readonly carrierId: string;

  constructor(props: { tenantId: Uuid; aggregateId: Uuid; correlationId: Uuid; carrierId: Uuid }) {
    super({ eventName: 'CarrierReconciliationStarted', tenantId: props.tenantId, aggregateType: 'CarrierReconciliationRun', aggregateId: props.aggregateId, correlationId: props.correlationId });
    this.carrierId = props.carrierId.value;
  }
}

export class CarrierReconciliationVarianceDetected extends DomainEvent {
  readonly varianceAmount: number;

  constructor(props: { tenantId: Uuid; aggregateId: Uuid; correlationId: Uuid; varianceAmount: number }) {
    super({ eventName: 'CarrierReconciliationVarianceDetected', tenantId: props.tenantId, aggregateType: 'CarrierReconciliationRun', aggregateId: props.aggregateId, correlationId: props.correlationId });
    this.varianceAmount = props.varianceAmount;
  }
}

export class CarrierReconciliationCompleted extends DomainEvent {
  constructor(props: { tenantId: Uuid; aggregateId: Uuid; correlationId: Uuid }) {
    super({ eventName: 'CarrierReconciliationCompleted', tenantId: props.tenantId, aggregateType: 'CarrierReconciliationRun', aggregateId: props.aggregateId, correlationId: props.correlationId });
  }
}

export class CarrierReconciliationFailed extends DomainEvent {
  constructor(props: { tenantId: Uuid; aggregateId: Uuid; correlationId: Uuid }) {
    super({ eventName: 'CarrierReconciliationFailed', tenantId: props.tenantId, aggregateType: 'CarrierReconciliationRun', aggregateId: props.aggregateId, correlationId: props.correlationId });
  }
}

/* ------------------------------------------------------------------ */
/*  Aggregate                                                          */
/* ------------------------------------------------------------------ */

/**
 * Aggregate root representing a carrier reconciliation run.
 *
 * FSM lifecycle: PENDING → IN_PROGRESS → VARIANCE_DETECTED → RECONCILED
 *                                     ↘ RECONCILED
 *                                     ↘ FAILED (terminal)
 */
export class CarrierReconciliationRun extends AggregateRoot {
  readonly tenantId: Uuid;
  carrierId: Uuid;
  periodStart: Date;
  periodEnd: Date;
  totalPremium: number;
  totalCollected: number;
  varianceAmount: number;
  currency: string;
  status: CarrierReconciliationRunStatus;
  readonly createdAt: Date;
  updatedAt: Date;

  get aggregateVersion(): number {
    return this.version;
  }

  constructor(props: CarrierReconciliationRunProps) {
    super(props.id);
    this.tenantId = props.tenantId;
    this.carrierId = props.carrierId;
    this.periodStart = props.periodStart;
    this.periodEnd = props.periodEnd;
    this.totalPremium = props.totalPremium;
    this.totalCollected = props.totalCollected;
    this.varianceAmount = props.varianceAmount;
    this.currency = props.currency;
    this.status = props.status;
    this.createdAt = props.createdAt ?? new Date();
    this.updatedAt = props.updatedAt ?? new Date();
    if (props.aggregateVersion !== undefined) {
      this.restoreVersion(props.aggregateVersion);
    }
  }

  static create(props: Omit<CarrierReconciliationRunProps, 'status' | 'createdAt' | 'updatedAt' | 'aggregateVersion'> & { correlationId: Uuid }): CarrierReconciliationRun {
    Guard.againstNegativeNumber(props.totalPremium, 'totalPremium');
    Guard.againstNegativeNumber(props.totalCollected, 'totalCollected');

    const run = new CarrierReconciliationRun({
      ...props,
      status: 'PENDING',
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    return run;
  }

  start(correlationId: Uuid): void {
    if (this.status !== 'PENDING') {
      throw new Error(`Cannot start CarrierReconciliationRun from state ${this.status}`);
    }
    this.status = 'IN_PROGRESS';
    this.updatedAt = new Date();
    this.incrementVersion();
    this.addDomainEvent(new CarrierReconciliationStarted({ tenantId: this.tenantId, aggregateId: this.id, correlationId, carrierId: this.carrierId }));
  }

  detectVariance(varianceAmount: number, correlationId: Uuid): void {
    if (this.status !== 'IN_PROGRESS') {
      throw new Error(`Cannot detect variance for CarrierReconciliationRun from state ${this.status}`);
    }
    this.varianceAmount = varianceAmount;
    this.status = 'VARIANCE_DETECTED';
    this.updatedAt = new Date();
    this.incrementVersion();
    this.addDomainEvent(new CarrierReconciliationVarianceDetected({ tenantId: this.tenantId, aggregateId: this.id, correlationId, varianceAmount: this.varianceAmount }));
  }

  reconcile(correlationId: Uuid): void {
    if (this.status !== 'IN_PROGRESS' && this.status !== 'VARIANCE_DETECTED') {
      throw new Error(`Cannot reconcile CarrierReconciliationRun from state ${this.status}`);
    }
    this.status = 'RECONCILED';
    this.updatedAt = new Date();
    this.incrementVersion();
    this.addDomainEvent(new CarrierReconciliationCompleted({ tenantId: this.tenantId, aggregateId: this.id, correlationId }));
  }

  fail(correlationId: Uuid): void {
    if (this.status !== 'PENDING' && this.status !== 'IN_PROGRESS' && this.status !== 'VARIANCE_DETECTED') {
      throw new Error(`Cannot fail CarrierReconciliationRun from state ${this.status}`);
    }
    this.status = 'FAILED';
    this.updatedAt = new Date();
    this.incrementVersion();
    this.addDomainEvent(new CarrierReconciliationFailed({ tenantId: this.tenantId, aggregateId: this.id, correlationId }));
  }
}
