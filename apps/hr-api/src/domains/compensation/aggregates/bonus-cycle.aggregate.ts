import { AggregateRoot, DomainEvent, Uuid, Guard } from '@hcm/shared-kernel';

/**
 * Bonus cycle lifecycle states.
 */
export type BonusCycleStatus = 'DRAFT' | 'ACTIVE' | 'CALCULATION' | 'REVIEW' | 'APPROVED' | 'PAID' | 'CLOSED';

/**
 * Properties required to construct a {@link BonusCycle}.
 */
export interface BonusCycleProps {
  id: Uuid;
  tenantId: Uuid;
  cycleName: string;
  cycleYear: number;
  eligibilityDate: Date;
  paymentDate: Date;
  totalPoolAmount: number;
  currency: string;
  status: BonusCycleStatus;
  aggregateVersion?: number;
  createdAt?: Date;
  updatedAt?: Date;
}

/* ------------------------------------------------------------------ */
/*  Domain Events                                                      */
/* ------------------------------------------------------------------ */

export class BonusCycleCreated extends DomainEvent {
  readonly cycleName: string;
  readonly cycleYear: number;

  constructor(props: { tenantId: Uuid; aggregateId: Uuid; correlationId: Uuid; cycleName: string; cycleYear: number }) {
    super({ eventName: 'BonusCycleCreated', tenantId: props.tenantId, aggregateType: 'BonusCycle', aggregateId: props.aggregateId, correlationId: props.correlationId });
    this.cycleName = props.cycleName;
    this.cycleYear = props.cycleYear;
  }
}

export class BonusCycleActivated extends DomainEvent {
  constructor(props: { tenantId: Uuid; aggregateId: Uuid; correlationId: Uuid }) {
    super({ eventName: 'BonusCycleActivated', tenantId: props.tenantId, aggregateType: 'BonusCycle', aggregateId: props.aggregateId, correlationId: props.correlationId });
  }
}

export class BonusCycleCalculated extends DomainEvent {
  constructor(props: { tenantId: Uuid; aggregateId: Uuid; correlationId: Uuid }) {
    super({ eventName: 'BonusCycleCalculated', tenantId: props.tenantId, aggregateType: 'BonusCycle', aggregateId: props.aggregateId, correlationId: props.correlationId });
  }
}

export class BonusCycleReviewed extends DomainEvent {
  constructor(props: { tenantId: Uuid; aggregateId: Uuid; correlationId: Uuid }) {
    super({ eventName: 'BonusCycleReviewed', tenantId: props.tenantId, aggregateType: 'BonusCycle', aggregateId: props.aggregateId, correlationId: props.correlationId });
  }
}

export class BonusCycleApproved extends DomainEvent {
  constructor(props: { tenantId: Uuid; aggregateId: Uuid; correlationId: Uuid }) {
    super({ eventName: 'BonusCycleApproved', tenantId: props.tenantId, aggregateType: 'BonusCycle', aggregateId: props.aggregateId, correlationId: props.correlationId });
  }
}

export class BonusCyclePaid extends DomainEvent {
  constructor(props: { tenantId: Uuid; aggregateId: Uuid; correlationId: Uuid }) {
    super({ eventName: 'BonusCyclePaid', tenantId: props.tenantId, aggregateType: 'BonusCycle', aggregateId: props.aggregateId, correlationId: props.correlationId });
  }
}

/* ------------------------------------------------------------------ */
/*  Aggregate                                                          */
/* ------------------------------------------------------------------ */

/**
 * Aggregate root representing a bonus cycle.
 *
 * FSM lifecycle: DRAFT → ACTIVE → CALCULATION → REVIEW → APPROVED → PAID → CLOSED (terminal)
 */
export class BonusCycle extends AggregateRoot {
  readonly tenantId: Uuid;
  cycleName: string;
  cycleYear: number;
  eligibilityDate: Date;
  paymentDate: Date;
  totalPoolAmount: number;
  currency: string;
  status: BonusCycleStatus;
  readonly createdAt: Date;
  updatedAt: Date;

  get aggregateVersion(): number {
    return this.version;
  }

  constructor(props: BonusCycleProps) {
    super(props.id);
    this.tenantId = props.tenantId;
    this.cycleName = props.cycleName;
    this.cycleYear = props.cycleYear;
    this.eligibilityDate = props.eligibilityDate;
    this.paymentDate = props.paymentDate;
    this.totalPoolAmount = props.totalPoolAmount;
    this.currency = props.currency;
    this.status = props.status;
    this.createdAt = props.createdAt ?? new Date();
    this.updatedAt = props.updatedAt ?? new Date();
    if (props.aggregateVersion !== undefined) {
      this.restoreVersion(props.aggregateVersion);
    }
  }

  static create(props: Omit<BonusCycleProps, 'status' | 'createdAt' | 'updatedAt' | 'aggregateVersion'> & { correlationId: Uuid }): BonusCycle {
    Guard.againstEmptyString(props.cycleName, 'cycleName');
    Guard.againstNegativeNumber(props.totalPoolAmount, 'totalPoolAmount');

    const cycle = new BonusCycle({
      ...props,
      status: 'DRAFT',
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    cycle.addDomainEvent(new BonusCycleCreated({ tenantId: cycle.tenantId, aggregateId: cycle.id, correlationId: props.correlationId, cycleName: cycle.cycleName, cycleYear: cycle.cycleYear }));
    return cycle;
  }

  activate(correlationId: Uuid): void {
    if (this.status !== 'DRAFT') {
      throw new Error(`Cannot activate BonusCycle from state ${this.status}`);
    }
    this.status = 'ACTIVE';
    this.updatedAt = new Date();
    this.incrementVersion();
    this.addDomainEvent(new BonusCycleActivated({ tenantId: this.tenantId, aggregateId: this.id, correlationId }));
  }

  startCalculation(correlationId: Uuid): void {
    if (this.status !== 'ACTIVE') {
      throw new Error(`Cannot start calculation for BonusCycle from state ${this.status}`);
    }
    this.status = 'CALCULATION';
    this.updatedAt = new Date();
    this.incrementVersion();
    this.addDomainEvent(new BonusCycleCalculated({ tenantId: this.tenantId, aggregateId: this.id, correlationId }));
  }

  startReview(correlationId: Uuid): void {
    if (this.status !== 'CALCULATION') {
      throw new Error(`Cannot start review for BonusCycle from state ${this.status}`);
    }
    this.status = 'REVIEW';
    this.updatedAt = new Date();
    this.incrementVersion();
    this.addDomainEvent(new BonusCycleReviewed({ tenantId: this.tenantId, aggregateId: this.id, correlationId }));
  }

  approve(correlationId: Uuid): void {
    if (this.status !== 'REVIEW') {
      throw new Error(`Cannot approve BonusCycle from state ${this.status}`);
    }
    this.status = 'APPROVED';
    this.updatedAt = new Date();
    this.incrementVersion();
    this.addDomainEvent(new BonusCycleApproved({ tenantId: this.tenantId, aggregateId: this.id, correlationId }));
  }

  markPaid(correlationId: Uuid): void {
    if (this.status !== 'APPROVED') {
      throw new Error(`Cannot mark BonusCycle as paid from state ${this.status}`);
    }
    this.status = 'PAID';
    this.updatedAt = new Date();
    this.incrementVersion();
    this.addDomainEvent(new BonusCyclePaid({ tenantId: this.tenantId, aggregateId: this.id, correlationId }));
  }

  close(_correlationId: Uuid): void {
    if (this.status !== 'PAID') {
      throw new Error(`Cannot close BonusCycle from state ${this.status}`);
    }
    this.status = 'CLOSED';
    this.updatedAt = new Date();
    this.incrementVersion();
  }
}
