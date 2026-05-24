import { AggregateRoot, DomainEvent, Uuid, Guard } from '@hcm/shared-kernel';

/**
 * Spending account lifecycle states.
 */
export type SpendingAccountStatus = 'ACTIVE' | 'SUSPENDED' | 'CLOSED';

/**
 * Properties required to construct a {@link SpendingAccount}.
 */
export interface SpendingAccountProps {
  id: Uuid;
  tenantId: Uuid;
  workerId: Uuid;
  accountType: string;
  annualElection: number;
  usedAmount: number;
  availableAmount: number;
  currency: string;
  status: SpendingAccountStatus;
  aggregateVersion?: number;
  createdAt?: Date;
  updatedAt?: Date;
}

/* ------------------------------------------------------------------ */
/*  Domain Events                                                      */
/* ------------------------------------------------------------------ */

export class SpendingAccountCreated extends DomainEvent {
  readonly workerId: string;
  readonly accountType: string;

  constructor(props: { tenantId: Uuid; aggregateId: Uuid; correlationId: Uuid; workerId: Uuid; accountType: string }) {
    super({ eventName: 'SpendingAccountCreated', tenantId: props.tenantId, aggregateType: 'SpendingAccount', aggregateId: props.aggregateId, correlationId: props.correlationId });
    this.workerId = props.workerId.value;
    this.accountType = props.accountType;
  }
}

export class SpendingAccountUpdated extends DomainEvent {
  readonly usedAmount: number;
  readonly availableAmount: number;

  constructor(props: { tenantId: Uuid; aggregateId: Uuid; correlationId: Uuid; usedAmount: number; availableAmount: number }) {
    super({ eventName: 'SpendingAccountUpdated', tenantId: props.tenantId, aggregateType: 'SpendingAccount', aggregateId: props.aggregateId, correlationId: props.correlationId });
    this.usedAmount = props.usedAmount;
    this.availableAmount = props.availableAmount;
  }
}

export class SpendingAccountClosed extends DomainEvent {
  constructor(props: { tenantId: Uuid; aggregateId: Uuid; correlationId: Uuid }) {
    super({ eventName: 'SpendingAccountClosed', tenantId: props.tenantId, aggregateType: 'SpendingAccount', aggregateId: props.aggregateId, correlationId: props.correlationId });
  }
}

/* ------------------------------------------------------------------ */
/*  Aggregate                                                          */
/* ------------------------------------------------------------------ */

/**
 * Aggregate root representing a spending account (e.g., FSA, HSA).
 *
 * FSM lifecycle: ACTIVE → SUSPENDED → CLOSED (terminal)
 */
export class SpendingAccount extends AggregateRoot {
  readonly tenantId: Uuid;
  workerId: Uuid;
  accountType: string;
  annualElection: number;
  usedAmount: number;
  availableAmount: number;
  currency: string;
  status: SpendingAccountStatus;
  readonly createdAt: Date;
  updatedAt: Date;

  get aggregateVersion(): number {
    return this.version;
  }

  constructor(props: SpendingAccountProps) {
    super(props.id);
    this.tenantId = props.tenantId;
    this.workerId = props.workerId;
    this.accountType = props.accountType;
    this.annualElection = props.annualElection;
    this.usedAmount = props.usedAmount;
    this.availableAmount = props.availableAmount;
    this.currency = props.currency;
    this.status = props.status;
    this.createdAt = props.createdAt ?? new Date();
    this.updatedAt = props.updatedAt ?? new Date();
    if (props.aggregateVersion !== undefined) {
      this.restoreVersion(props.aggregateVersion);
    }
  }

  static create(props: Omit<SpendingAccountProps, 'status' | 'usedAmount' | 'availableAmount' | 'createdAt' | 'updatedAt' | 'aggregateVersion'> & { correlationId: Uuid }): SpendingAccount {
    Guard.againstEmptyString(props.accountType, 'accountType');
    Guard.againstNegativeNumber(props.annualElection, 'annualElection');

    const account = new SpendingAccount({
      ...props,
      status: 'ACTIVE',
      usedAmount: 0,
      availableAmount: props.annualElection,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    account.addDomainEvent(new SpendingAccountCreated({ tenantId: account.tenantId, aggregateId: account.id, correlationId: props.correlationId, workerId: account.workerId, accountType: account.accountType }));
    return account;
  }

  /**
   * Record usage and update available amount.
   */
  recordUsage(amount: number, correlationId: Uuid): void {
    if (this.status !== 'ACTIVE') {
      throw new Error(`Cannot record usage for SpendingAccount from state ${this.status}`);
    }
    if (amount < 0 || amount > this.availableAmount) {
      throw new Error('Usage amount exceeds available balance');
    }
    this.usedAmount += amount;
    this.availableAmount = this.annualElection - this.usedAmount;
    this.updatedAt = new Date();
    this.incrementVersion();
    this.addDomainEvent(new SpendingAccountUpdated({ tenantId: this.tenantId, aggregateId: this.id, correlationId, usedAmount: this.usedAmount, availableAmount: this.availableAmount }));
  }

  suspend(_correlationId: Uuid): void {
    if (this.status !== 'ACTIVE') {
      throw new Error(`Cannot suspend SpendingAccount from state ${this.status}`);
    }
    this.status = 'SUSPENDED';
    this.updatedAt = new Date();
    this.incrementVersion();
  }

  reactivate(_correlationId: Uuid): void {
    if (this.status !== 'SUSPENDED') {
      throw new Error(`Cannot reactivate SpendingAccount from state ${this.status}`);
    }
    this.status = 'ACTIVE';
    this.updatedAt = new Date();
    this.incrementVersion();
  }

  close(correlationId: Uuid): void {
    if (this.status !== 'ACTIVE' && this.status !== 'SUSPENDED') {
      throw new Error(`Cannot close SpendingAccount from state ${this.status}`);
    }
    this.status = 'CLOSED';
    this.updatedAt = new Date();
    this.incrementVersion();
    this.addDomainEvent(new SpendingAccountClosed({ tenantId: this.tenantId, aggregateId: this.id, correlationId }));
  }
}
