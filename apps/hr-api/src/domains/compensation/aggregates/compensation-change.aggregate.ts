/**
 * @hrDataClassification HIGH_SENSITIVITY - salary, band, bonus, equity, pay-scale, and worker-linked compensation fields.
 */
import { AggregateRoot, DomainEvent, Uuid, Guard } from '@hcm/shared-kernel';

/**
 * Compensation change lifecycle states.
 */
export type CompensationChangeStatus = 'DRAFT' | 'SUBMITTED' | 'PENDING_APPROVAL' | 'APPROVED' | 'EFFECTIVE' | 'CANCELLED' | 'REJECTED';

/**
 * Properties required to construct a {@link CompensationChange}.
 */
export interface CompensationChangeProps {
  id: Uuid;
  tenantId: Uuid;
  workerId: Uuid;
  changeType: string;
  oldAmount?: number;
  newAmount: number;
  currency: string;
  effectiveDate: Date;
  approvedBy?: Uuid;
  status: CompensationChangeStatus;
  aggregateVersion?: number;
  createdAt?: Date;
  updatedAt?: Date;
}

/* ------------------------------------------------------------------ */
/*  Domain Events                                                      */
/* ------------------------------------------------------------------ */

export class CompensationChangeSubmitted extends DomainEvent {
  readonly workerId: string;
  readonly changeType: string;
  readonly newAmount: number;

  constructor(props: { tenantId: Uuid; aggregateId: Uuid; correlationId: Uuid; workerId: Uuid; changeType: string; newAmount: number }) {
    super({ eventName: 'CompensationChangeSubmitted', tenantId: props.tenantId, aggregateType: 'CompensationChange', aggregateId: props.aggregateId, correlationId: props.correlationId });
    this.workerId = props.workerId.value;
    this.changeType = props.changeType;
    this.newAmount = props.newAmount;
  }
}

export class CompensationChangeApproved extends DomainEvent {
  readonly approvedBy: string;

  constructor(props: { tenantId: Uuid; aggregateId: Uuid; correlationId: Uuid; approvedBy: Uuid }) {
    super({ eventName: 'CompensationChangeApproved', tenantId: props.tenantId, aggregateType: 'CompensationChange', aggregateId: props.aggregateId, correlationId: props.correlationId });
    this.approvedBy = props.approvedBy.value;
  }
}

export class CompensationChangeEffective extends DomainEvent {
  constructor(props: { tenantId: Uuid; aggregateId: Uuid; correlationId: Uuid }) {
    super({ eventName: 'CompensationChangeEffective', tenantId: props.tenantId, aggregateType: 'CompensationChange', aggregateId: props.aggregateId, correlationId: props.correlationId });
  }
}

export class CompensationChangeRejected extends DomainEvent {
  constructor(props: { tenantId: Uuid; aggregateId: Uuid; correlationId: Uuid }) {
    super({ eventName: 'CompensationChangeRejected', tenantId: props.tenantId, aggregateType: 'CompensationChange', aggregateId: props.aggregateId, correlationId: props.correlationId });
  }
}

export class CompensationChangeCancelled extends DomainEvent {
  constructor(props: { tenantId: Uuid; aggregateId: Uuid; correlationId: Uuid }) {
    super({ eventName: 'CompensationChangeCancelled', tenantId: props.tenantId, aggregateType: 'CompensationChange', aggregateId: props.aggregateId, correlationId: props.correlationId });
  }
}

/* ------------------------------------------------------------------ */
/*  Aggregate                                                          */
/* ------------------------------------------------------------------ */

/**
 * Aggregate root representing a compensation change for a worker.
 *
 * FSM lifecycle: DRAFT → SUBMITTED → PENDING_APPROVAL → APPROVED → EFFECTIVE → CANCELLED (terminal)
 *                                                           ↘ REJECTED (terminal)
 *
 * SoD: proposer ≠ approver
 */
export class CompensationChange extends AggregateRoot {
  readonly tenantId: Uuid;
  workerId: Uuid;
  changeType: string;
  oldAmount?: number;
  newAmount: number;
  currency: string;
  effectiveDate: Date;
  approvedBy?: Uuid;
  status: CompensationChangeStatus;
  readonly createdAt: Date;
  updatedAt: Date;

  get aggregateVersion(): number {
    return this.version;
  }

  constructor(props: CompensationChangeProps) {
    super(props.id);
    this.tenantId = props.tenantId;
    this.workerId = props.workerId;
    this.changeType = props.changeType;
    this.oldAmount = props.oldAmount;
    this.newAmount = props.newAmount;
    this.currency = props.currency;
    this.effectiveDate = props.effectiveDate;
    this.approvedBy = props.approvedBy;
    this.status = props.status;
    this.createdAt = props.createdAt ?? new Date();
    this.updatedAt = props.updatedAt ?? new Date();
    if (props.aggregateVersion !== undefined) {
      this.restoreVersion(props.aggregateVersion);
    }
  }

  static create(props: Omit<CompensationChangeProps, 'status' | 'createdAt' | 'updatedAt' | 'aggregateVersion'> & { correlationId: Uuid }): CompensationChange {
    Guard.againstEmptyString(props.changeType, 'changeType');
    Guard.againstNegativeNumber(props.newAmount, 'newAmount');

    const change = new CompensationChange({
      ...props,
      status: 'DRAFT',
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    return change;
  }

  /**
   * Submit the change (DRAFT → SUBMITTED).
   */
  submit(correlationId: Uuid): void {
    if (this.status !== 'DRAFT') {
      throw new Error(`Cannot submit CompensationChange from state ${this.status}`);
    }
    this.status = 'SUBMITTED';
    this.updatedAt = new Date();
    this.incrementVersion();
    this.addDomainEvent(new CompensationChangeSubmitted({ tenantId: this.tenantId, aggregateId: this.id, correlationId, workerId: this.workerId, changeType: this.changeType, newAmount: this.newAmount }));
  }

  /**
   * Move to pending approval (SUBMITTED → PENDING_APPROVAL).
   */
  sendForApproval(_correlationId: Uuid): void {
    if (this.status !== 'SUBMITTED') {
      throw new Error(`Cannot send CompensationChange for approval from state ${this.status}`);
    }
    this.status = 'PENDING_APPROVAL';
    this.updatedAt = new Date();
    this.incrementVersion();
  }

  /**
   * Approve the change (PENDING_APPROVAL → APPROVED).
   * SoD enforced: approver must differ from the worker being changed (represented by approvedBy field).
   */
  approve(approvedBy: Uuid, correlationId: Uuid): void {
    if (this.status !== 'PENDING_APPROVAL') {
      throw new Error(`Cannot approve CompensationChange from state ${this.status}`);
    }
    if (this.workerId.value === approvedBy.value) {
      throw new Error('SoD violation: proposer cannot approve their own compensation change');
    }
    this.approvedBy = approvedBy;
    this.status = 'APPROVED';
    this.updatedAt = new Date();
    this.incrementVersion();
    this.addDomainEvent(new CompensationChangeApproved({ tenantId: this.tenantId, aggregateId: this.id, correlationId, approvedBy }));
  }

  /**
   * Mark as effective (APPROVED → EFFECTIVE).
   */
  makeEffective(correlationId: Uuid): void {
    if (this.status !== 'APPROVED') {
      throw new Error(`Cannot make CompensationChange effective from state ${this.status}`);
    }
    this.status = 'EFFECTIVE';
    this.updatedAt = new Date();
    this.incrementVersion();
    this.addDomainEvent(new CompensationChangeEffective({ tenantId: this.tenantId, aggregateId: this.id, correlationId }));
  }

  /**
   * Reject the change (PENDING_APPROVAL → REJECTED).
   */
  reject(correlationId: Uuid): void {
    if (this.status !== 'PENDING_APPROVAL') {
      throw new Error(`Cannot reject CompensationChange from state ${this.status}`);
    }
    this.status = 'REJECTED';
    this.updatedAt = new Date();
    this.incrementVersion();
    this.addDomainEvent(new CompensationChangeRejected({ tenantId: this.tenantId, aggregateId: this.id, correlationId }));
  }

  /**
   * Cancel the change (DRAFT, SUBMITTED, or PENDING_APPROVAL → CANCELLED).
   */
  cancel(correlationId: Uuid): void {
    if (this.status !== 'DRAFT' && this.status !== 'SUBMITTED' && this.status !== 'PENDING_APPROVAL') {
      throw new Error(`Cannot cancel CompensationChange from state ${this.status}`);
    }
    this.status = 'CANCELLED';
    this.updatedAt = new Date();
    this.incrementVersion();
    this.addDomainEvent(new CompensationChangeCancelled({ tenantId: this.tenantId, aggregateId: this.id, correlationId }));
  }
}
