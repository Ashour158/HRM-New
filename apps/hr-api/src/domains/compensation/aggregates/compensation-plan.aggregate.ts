import { AggregateRoot, DomainEvent, Uuid, Guard } from '@hcm/shared-kernel';

/**
 * Compensation plan lifecycle states.
 */
export type CompensationPlanStatus = 'DRAFT' | 'ACTIVE' | 'SUSPENDED' | 'CLOSED';

/**
 * Properties required to construct a {@link CompensationPlan}.
 */
export interface CompensationPlanProps {
  id: Uuid;
  tenantId: Uuid;
  name: string;
  planType: string;
  currency: string;
  effectiveFrom?: Date;
  effectiveUntil?: Date;
  status: CompensationPlanStatus;
  aggregateVersion?: number;
  createdAt?: Date;
  updatedAt?: Date;
}

/* ------------------------------------------------------------------ */
/*  Domain Events                                                      */
/* ------------------------------------------------------------------ */

export class CompensationPlanCreated extends DomainEvent {
  readonly name: string;
  readonly planType: string;

  constructor(props: { tenantId: Uuid; aggregateId: Uuid; correlationId: Uuid; name: string; planType: string }) {
    super({ eventName: 'CompensationPlanCreated', tenantId: props.tenantId, aggregateType: 'CompensationPlan', aggregateId: props.aggregateId, correlationId: props.correlationId });
    this.name = props.name;
    this.planType = props.planType;
  }
}

export class CompensationPlanActivated extends DomainEvent {
  constructor(props: { tenantId: Uuid; aggregateId: Uuid; correlationId: Uuid }) {
    super({ eventName: 'CompensationPlanActivated', tenantId: props.tenantId, aggregateType: 'CompensationPlan', aggregateId: props.aggregateId, correlationId: props.correlationId });
  }
}

export class CompensationPlanSuspended extends DomainEvent {
  constructor(props: { tenantId: Uuid; aggregateId: Uuid; correlationId: Uuid }) {
    super({ eventName: 'CompensationPlanSuspended', tenantId: props.tenantId, aggregateType: 'CompensationPlan', aggregateId: props.aggregateId, correlationId: props.correlationId });
  }
}

export class CompensationPlanClosed extends DomainEvent {
  constructor(props: { tenantId: Uuid; aggregateId: Uuid; correlationId: Uuid }) {
    super({ eventName: 'CompensationPlanClosed', tenantId: props.tenantId, aggregateType: 'CompensationPlan', aggregateId: props.aggregateId, correlationId: props.correlationId });
  }
}

/* ------------------------------------------------------------------ */
/*  Aggregate                                                          */
/* ------------------------------------------------------------------ */

/**
 * Aggregate root representing a compensation plan.
 *
 * FSM lifecycle: DRAFT → ACTIVE → SUSPENDED → CLOSED (terminal)
 */
export class CompensationPlan extends AggregateRoot {
  readonly tenantId: Uuid;
  name: string;
  planType: string;
  currency: string;
  effectiveFrom?: Date;
  effectiveUntil?: Date;
  status: CompensationPlanStatus;
  readonly createdAt: Date;
  updatedAt: Date;

  get aggregateVersion(): number {
    return this.version;
  }

  constructor(props: CompensationPlanProps) {
    super(props.id);
    this.tenantId = props.tenantId;
    this.name = props.name;
    this.planType = props.planType;
    this.currency = props.currency;
    this.effectiveFrom = props.effectiveFrom;
    this.effectiveUntil = props.effectiveUntil;
    this.status = props.status;
    this.createdAt = props.createdAt ?? new Date();
    this.updatedAt = props.updatedAt ?? new Date();
    if (props.aggregateVersion !== undefined) {
      this.restoreVersion(props.aggregateVersion);
    }
  }

  static create(props: Omit<CompensationPlanProps, 'status' | 'createdAt' | 'updatedAt' | 'aggregateVersion'> & { correlationId: Uuid }): CompensationPlan {
    Guard.againstEmptyString(props.name, 'name');
    Guard.againstEmptyString(props.planType, 'planType');
    Guard.againstEmptyString(props.currency, 'currency');

    const plan = new CompensationPlan({
      ...props,
      status: 'DRAFT',
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    plan.addDomainEvent(new CompensationPlanCreated({ tenantId: plan.tenantId, aggregateId: plan.id, correlationId: props.correlationId, name: plan.name, planType: plan.planType }));
    return plan;
  }

  /**
   * Activate the compensation plan (DRAFT or SUSPENDED → ACTIVE).
   */
  activate(correlationId: Uuid): void {
    if (this.status !== 'DRAFT' && this.status !== 'SUSPENDED') {
      throw new Error(`Cannot activate CompensationPlan from state ${this.status}`);
    }
    this.status = 'ACTIVE';
    this.updatedAt = new Date();
    this.incrementVersion();
    this.addDomainEvent(new CompensationPlanActivated({ tenantId: this.tenantId, aggregateId: this.id, correlationId }));
  }

  /**
   * Suspend the compensation plan (ACTIVE → SUSPENDED).
   */
  suspend(correlationId: Uuid): void {
    if (this.status !== 'ACTIVE') {
      throw new Error(`Cannot suspend CompensationPlan from state ${this.status}`);
    }
    this.status = 'SUSPENDED';
    this.updatedAt = new Date();
    this.incrementVersion();
    this.addDomainEvent(new CompensationPlanSuspended({ tenantId: this.tenantId, aggregateId: this.id, correlationId }));
  }

  /**
   * Close the compensation plan (ACTIVE or SUSPENDED → CLOSED).
   */
  close(correlationId: Uuid): void {
    if (this.status !== 'ACTIVE' && this.status !== 'SUSPENDED') {
      throw new Error(`Cannot close CompensationPlan from state ${this.status}`);
    }
    this.status = 'CLOSED';
    this.updatedAt = new Date();
    this.incrementVersion();
    this.addDomainEvent(new CompensationPlanClosed({ tenantId: this.tenantId, aggregateId: this.id, correlationId }));
  }
}
