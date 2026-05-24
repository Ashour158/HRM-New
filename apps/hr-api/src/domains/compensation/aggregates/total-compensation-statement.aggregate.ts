import { AggregateRoot, DomainEvent, Uuid, Guard } from '@hcm/shared-kernel';

/**
 * Total compensation statement lifecycle states.
 */
export type TotalCompensationStatementStatus = 'DRAFT' | 'GENERATED' | 'DELIVERED' | 'ACKNOWLEDGED';

/**
 * Properties required to construct a {@link TotalCompensationStatement}.
 */
export interface TotalCompensationStatementProps {
  id: Uuid;
  tenantId: Uuid;
  workerId: Uuid;
  statementYear: number;
  baseSalary: number;
  bonusAmount: number;
  equityValue: number;
  benefitsValue: number;
  totalComp: number;
  currency: string;
  status: TotalCompensationStatementStatus;
  aggregateVersion?: number;
  createdAt?: Date;
  updatedAt?: Date;
}

/* ------------------------------------------------------------------ */
/*  Domain Events                                                      */
/* ------------------------------------------------------------------ */

export class TotalCompStatementGenerated extends DomainEvent {
  readonly workerId: string;
  readonly statementYear: number;

  constructor(props: { tenantId: Uuid; aggregateId: Uuid; correlationId: Uuid; workerId: Uuid; statementYear: number }) {
    super({ eventName: 'TotalCompStatementGenerated', tenantId: props.tenantId, aggregateType: 'TotalCompensationStatement', aggregateId: props.aggregateId, correlationId: props.correlationId });
    this.workerId = props.workerId.value;
    this.statementYear = props.statementYear;
  }
}

export class TotalCompStatementDelivered extends DomainEvent {
  constructor(props: { tenantId: Uuid; aggregateId: Uuid; correlationId: Uuid }) {
    super({ eventName: 'TotalCompStatementDelivered', tenantId: props.tenantId, aggregateType: 'TotalCompensationStatement', aggregateId: props.aggregateId, correlationId: props.correlationId });
  }
}

export class TotalCompStatementAcknowledged extends DomainEvent {
  constructor(props: { tenantId: Uuid; aggregateId: Uuid; correlationId: Uuid }) {
    super({ eventName: 'TotalCompStatementAcknowledged', tenantId: props.tenantId, aggregateType: 'TotalCompensationStatement', aggregateId: props.aggregateId, correlationId: props.correlationId });
  }
}

/* ------------------------------------------------------------------ */
/*  Aggregate                                                          */
/* ------------------------------------------------------------------ */

/**
 * Aggregate root representing a total compensation statement for a worker.
 *
 * FSM lifecycle: DRAFT → GENERATED → DELIVERED → ACKNOWLEDGED (terminal)
 */
export class TotalCompensationStatement extends AggregateRoot {
  readonly tenantId: Uuid;
  workerId: Uuid;
  statementYear: number;
  baseSalary: number;
  bonusAmount: number;
  equityValue: number;
  benefitsValue: number;
  totalComp: number;
  currency: string;
  status: TotalCompensationStatementStatus;
  readonly createdAt: Date;
  updatedAt: Date;

  get aggregateVersion(): number {
    return this.version;
  }

  constructor(props: TotalCompensationStatementProps) {
    super(props.id);
    this.tenantId = props.tenantId;
    this.workerId = props.workerId;
    this.statementYear = props.statementYear;
    this.baseSalary = props.baseSalary;
    this.bonusAmount = props.bonusAmount;
    this.equityValue = props.equityValue;
    this.benefitsValue = props.benefitsValue;
    this.totalComp = props.totalComp;
    this.currency = props.currency;
    this.status = props.status;
    this.createdAt = props.createdAt ?? new Date();
    this.updatedAt = props.updatedAt ?? new Date();
    if (props.aggregateVersion !== undefined) {
      this.restoreVersion(props.aggregateVersion);
    }
  }

  static create(props: Omit<TotalCompensationStatementProps, 'status' | 'createdAt' | 'updatedAt' | 'aggregateVersion'> & { correlationId: Uuid }): TotalCompensationStatement {
    Guard.againstNegativeNumber(props.baseSalary, 'baseSalary');
    Guard.againstNegativeNumber(props.bonusAmount, 'bonusAmount');
    Guard.againstNegativeNumber(props.equityValue, 'equityValue');
    Guard.againstNegativeNumber(props.benefitsValue, 'benefitsValue');
    Guard.againstNegativeNumber(props.totalComp, 'totalComp');

    const statement = new TotalCompensationStatement({
      ...props,
      status: 'DRAFT',
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    return statement;
  }

  /**
   * Generate the statement (DRAFT → GENERATED).
   */
  generate(correlationId: Uuid): void {
    if (this.status !== 'DRAFT') {
      throw new Error(`Cannot generate TotalCompensationStatement from state ${this.status}`);
    }
    this.status = 'GENERATED';
    this.updatedAt = new Date();
    this.incrementVersion();
    this.addDomainEvent(new TotalCompStatementGenerated({ tenantId: this.tenantId, aggregateId: this.id, correlationId, workerId: this.workerId, statementYear: this.statementYear }));
  }

  /**
   * Deliver the statement (GENERATED → DELIVERED).
   */
  deliver(correlationId: Uuid): void {
    if (this.status !== 'GENERATED') {
      throw new Error(`Cannot deliver TotalCompensationStatement from state ${this.status}`);
    }
    this.status = 'DELIVERED';
    this.updatedAt = new Date();
    this.incrementVersion();
    this.addDomainEvent(new TotalCompStatementDelivered({ tenantId: this.tenantId, aggregateId: this.id, correlationId }));
  }

  /**
   * Acknowledge the statement (DELIVERED → ACKNOWLEDGED).
   */
  acknowledge(correlationId: Uuid): void {
    if (this.status !== 'DELIVERED') {
      throw new Error(`Cannot acknowledge TotalCompensationStatement from state ${this.status}`);
    }
    this.status = 'ACKNOWLEDGED';
    this.updatedAt = new Date();
    this.incrementVersion();
    this.addDomainEvent(new TotalCompStatementAcknowledged({ tenantId: this.tenantId, aggregateId: this.id, correlationId }));
  }
}
