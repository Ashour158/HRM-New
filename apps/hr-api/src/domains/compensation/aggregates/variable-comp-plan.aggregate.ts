import { AggregateRoot, DomainEvent, Uuid, Guard } from '@hcm/shared-kernel';

/**
 * Variable comp plan lifecycle states.
 */
export type VariableCompPlanStatus = 'DRAFT' | 'ACTIVE' | 'CLOSED';

/**
 * Properties required to construct a {@link VariableCompPlan}.
 */
export interface VariableCompPlanProps {
  id: Uuid;
  tenantId: Uuid;
  name: string;
  planType: string;
  targetPercentage: number;
  maxPercentage: number;
  currency: string;
  status: VariableCompPlanStatus;
  aggregateVersion?: number;
  createdAt?: Date;
  updatedAt?: Date;
}

/* ------------------------------------------------------------------ */
/*  Domain Events                                                      */
/* ------------------------------------------------------------------ */

export class VariableCompPlanCreated extends DomainEvent {
  readonly name: string;
  readonly planType: string;

  constructor(props: { tenantId: Uuid; aggregateId: Uuid; correlationId: Uuid; name: string; planType: string }) {
    super({ eventName: 'VariableCompPlanCreated', tenantId: props.tenantId, aggregateType: 'VariableCompPlan', aggregateId: props.aggregateId, correlationId: props.correlationId });
    this.name = props.name;
    this.planType = props.planType;
  }
}

export class VariableCompPlanActivated extends DomainEvent {
  constructor(props: { tenantId: Uuid; aggregateId: Uuid; correlationId: Uuid }) {
    super({ eventName: 'VariableCompPlanActivated', tenantId: props.tenantId, aggregateType: 'VariableCompPlan', aggregateId: props.aggregateId, correlationId: props.correlationId });
  }
}

export class VariableCompPlanClosed extends DomainEvent {
  constructor(props: { tenantId: Uuid; aggregateId: Uuid; correlationId: Uuid }) {
    super({ eventName: 'VariableCompPlanClosed', tenantId: props.tenantId, aggregateType: 'VariableCompPlan', aggregateId: props.aggregateId, correlationId: props.correlationId });
  }
}

/* ------------------------------------------------------------------ */
/*  Aggregate                                                          */
/* ------------------------------------------------------------------ */

/**
 * Aggregate root representing a variable compensation plan.
 *
 * FSM lifecycle: DRAFT → ACTIVE → CLOSED (terminal)
 */
export class VariableCompPlan extends AggregateRoot {
  readonly tenantId: Uuid;
  name: string;
  planType: string;
  targetPercentage: number;
  maxPercentage: number;
  currency: string;
  status: VariableCompPlanStatus;
  readonly createdAt: Date;
  updatedAt: Date;

  get aggregateVersion(): number {
    return this.version;
  }

  constructor(props: VariableCompPlanProps) {
    super(props.id);
    this.tenantId = props.tenantId;
    this.name = props.name;
    this.planType = props.planType;
    this.targetPercentage = props.targetPercentage;
    this.maxPercentage = props.maxPercentage;
    this.currency = props.currency;
    this.status = props.status;
    this.createdAt = props.createdAt ?? new Date();
    this.updatedAt = props.updatedAt ?? new Date();
    if (props.aggregateVersion !== undefined) {
      this.restoreVersion(props.aggregateVersion);
    }
  }

  static create(props: Omit<VariableCompPlanProps, 'status' | 'createdAt' | 'updatedAt' | 'aggregateVersion'> & { correlationId: Uuid }): VariableCompPlan {
    Guard.againstEmptyString(props.name, 'name');
    Guard.againstEmptyString(props.planType, 'planType');
    Guard.againstNegativeNumber(props.targetPercentage, 'targetPercentage');
    Guard.againstNegativeNumber(props.maxPercentage, 'maxPercentage');

    const plan = new VariableCompPlan({
      ...props,
      status: 'DRAFT',
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    plan.addDomainEvent(new VariableCompPlanCreated({ tenantId: plan.tenantId, aggregateId: plan.id, correlationId: props.correlationId, name: plan.name, planType: plan.planType }));
    return plan;
  }

  activate(correlationId: Uuid): void {
    if (this.status !== 'DRAFT') {
      throw new Error(`Cannot activate VariableCompPlan from state ${this.status}`);
    }
    this.status = 'ACTIVE';
    this.updatedAt = new Date();
    this.incrementVersion();
    this.addDomainEvent(new VariableCompPlanActivated({ tenantId: this.tenantId, aggregateId: this.id, correlationId }));
  }

  close(correlationId: Uuid): void {
    if (this.status !== 'ACTIVE') {
      throw new Error(`Cannot close VariableCompPlan from state ${this.status}`);
    }
    this.status = 'CLOSED';
    this.updatedAt = new Date();
    this.incrementVersion();
    this.addDomainEvent(new VariableCompPlanClosed({ tenantId: this.tenantId, aggregateId: this.id, correlationId }));
  }
}
