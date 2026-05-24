import { AggregateRoot, DomainEvent, Uuid, Guard } from '@hcm/shared-kernel';

/**
 * Pay scale lifecycle states.
 */
export type PayScaleStatus = 'DRAFT' | 'ACTIVE' | 'REVISED' | 'CLOSED';

/**
 * Pay scale step.
 */
export interface PayScaleStep {
  stepNumber: number;
  amount: number;
}

/**
 * Properties required to construct a {@link PayScale}.
 */
export interface PayScaleProps {
  id: Uuid;
  tenantId: Uuid;
  scaleCode: string;
  grade: string;
  steps: PayScaleStep[];
  currency: string;
  status: PayScaleStatus;
  aggregateVersion?: number;
  createdAt?: Date;
  updatedAt?: Date;
}

/* ------------------------------------------------------------------ */
/*  Domain Events                                                      */
/* ------------------------------------------------------------------ */

export class PayScaleCreated extends DomainEvent {
  readonly scaleCode: string;
  readonly grade: string;

  constructor(props: { tenantId: Uuid; aggregateId: Uuid; correlationId: Uuid; scaleCode: string; grade: string }) {
    super({ eventName: 'PayScaleCreated', tenantId: props.tenantId, aggregateType: 'PayScale', aggregateId: props.aggregateId, correlationId: props.correlationId });
    this.scaleCode = props.scaleCode;
    this.grade = props.grade;
  }
}

export class PayScaleActivated extends DomainEvent {
  constructor(props: { tenantId: Uuid; aggregateId: Uuid; correlationId: Uuid }) {
    super({ eventName: 'PayScaleActivated', tenantId: props.tenantId, aggregateType: 'PayScale', aggregateId: props.aggregateId, correlationId: props.correlationId });
  }
}

export class PayScaleRevised extends DomainEvent {
  readonly steps: PayScaleStep[];

  constructor(props: { tenantId: Uuid; aggregateId: Uuid; correlationId: Uuid; steps: PayScaleStep[] }) {
    super({ eventName: 'PayScaleRevised', tenantId: props.tenantId, aggregateType: 'PayScale', aggregateId: props.aggregateId, correlationId: props.correlationId });
    this.steps = props.steps;
  }
}

export class PayScaleClosed extends DomainEvent {
  constructor(props: { tenantId: Uuid; aggregateId: Uuid; correlationId: Uuid }) {
    super({ eventName: 'PayScaleClosed', tenantId: props.tenantId, aggregateType: 'PayScale', aggregateId: props.aggregateId, correlationId: props.correlationId });
  }
}

/* ------------------------------------------------------------------ */
/*  Aggregate                                                          */
/* ------------------------------------------------------------------ */

/**
 * Aggregate root representing a pay scale with grade-step progression.
 *
 * FSM lifecycle: DRAFT → ACTIVE → REVISED → CLOSED (terminal)
 */
export class PayScale extends AggregateRoot {
  readonly tenantId: Uuid;
  scaleCode: string;
  grade: string;
  steps: PayScaleStep[];
  currency: string;
  status: PayScaleStatus;
  readonly createdAt: Date;
  updatedAt: Date;

  get aggregateVersion(): number {
    return this.version;
  }

  constructor(props: PayScaleProps) {
    super(props.id);
    this.tenantId = props.tenantId;
    this.scaleCode = props.scaleCode;
    this.grade = props.grade;
    this.steps = props.steps;
    this.currency = props.currency;
    this.status = props.status;
    this.createdAt = props.createdAt ?? new Date();
    this.updatedAt = props.updatedAt ?? new Date();
    if (props.aggregateVersion !== undefined) {
      this.restoreVersion(props.aggregateVersion);
    }
  }

  static create(props: Omit<PayScaleProps, 'status' | 'createdAt' | 'updatedAt' | 'aggregateVersion'> & { correlationId: Uuid }): PayScale {
    Guard.againstEmptyString(props.scaleCode, 'scaleCode');
    Guard.againstEmptyString(props.grade, 'grade');
    if (props.steps.length === 0) {
      throw new Error('Pay scale must have at least one step');
    }
    for (const step of props.steps) {
      Guard.againstNegativeNumber(step.amount, 'step.amount');
    }

    const scale = new PayScale({
      ...props,
      status: 'DRAFT',
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    scale.addDomainEvent(new PayScaleCreated({ tenantId: scale.tenantId, aggregateId: scale.id, correlationId: props.correlationId, scaleCode: scale.scaleCode, grade: scale.grade }));
    return scale;
  }

  activate(correlationId: Uuid): void {
    if (this.status !== 'DRAFT') {
      throw new Error(`Cannot activate PayScale from state ${this.status}`);
    }
    this.status = 'ACTIVE';
    this.updatedAt = new Date();
    this.incrementVersion();
    this.addDomainEvent(new PayScaleActivated({ tenantId: this.tenantId, aggregateId: this.id, correlationId }));
  }

  /**
   * Revise the grade-step progression.
   */
  revise(newSteps: PayScaleStep[], correlationId: Uuid): void {
    if (this.status !== 'ACTIVE' && this.status !== 'REVISED') {
      throw new Error(`Cannot revise PayScale from state ${this.status}`);
    }
    if (newSteps.length === 0) {
      throw new Error('Pay scale must have at least one step');
    }
    for (const step of newSteps) {
      Guard.againstNegativeNumber(step.amount, 'step.amount');
    }
    this.steps = newSteps;
    this.status = 'REVISED';
    this.updatedAt = new Date();
    this.incrementVersion();
    this.addDomainEvent(new PayScaleRevised({ tenantId: this.tenantId, aggregateId: this.id, correlationId, steps: this.steps }));
  }

  close(correlationId: Uuid): void {
    if (this.status !== 'ACTIVE' && this.status !== 'REVISED') {
      throw new Error(`Cannot close PayScale from state ${this.status}`);
    }
    this.status = 'CLOSED';
    this.updatedAt = new Date();
    this.incrementVersion();
    this.addDomainEvent(new PayScaleClosed({ tenantId: this.tenantId, aggregateId: this.id, correlationId }));
  }
}
