/**
 * @hrDataClassification HIGH_SENSITIVITY - benefits enrollment premium and currency fields.
 */
import { AggregateRoot, DomainEvent, Uuid, Guard } from '@hcm/shared-kernel';

/**
 * Benefits enrollment lifecycle states.
 */
export type BenefitsEnrollmentStatus = 'DRAFT' | 'SUBMITTED' | 'PENDING_APPROVAL' | 'APPROVED' | 'EFFECTIVE' | 'TERMINATED' | 'REJECTED';

/**
 * Dependent entry.
 */
export interface DependentEntry {
  dependentId: string;
  firstName: string;
  lastName: string;
  relationship: string;
  dateOfBirth: Date;
}

/**
 * Properties required to construct a {@link BenefitsEnrollment}.
 */
export interface BenefitsEnrollmentProps {
  id: Uuid;
  tenantId: Uuid;
  workerId: Uuid;
  programId: Uuid;
  coverageLevel: string;
  dependents: DependentEntry[];
  effectiveDate: Date;
  /**
   * Premium amount charged for this enrollment, snapshotted from the
   * BenefitsProgram's monthlyPremium at enrollment creation time so the
   * employee's contracted rate stays stable even if the program's rate
   * changes later. Flows through to payroll as the BENEFITS_DEDUCTION amount.
   * @hrDataClassification HIGH_SENSITIVITY
   */
  premiumAmount: number;
  /** @hrDataClassification HIGH_SENSITIVITY */
  currency: string;
  status: BenefitsEnrollmentStatus;
  aggregateVersion?: number;
  createdAt?: Date;
  updatedAt?: Date;
}

/* ------------------------------------------------------------------ */
/*  Domain Events                                                      */
/* ------------------------------------------------------------------ */

export class BenefitsEnrollmentSubmitted extends DomainEvent {
  readonly workerId: string;
  readonly programId: string;

  constructor(props: { tenantId: Uuid; aggregateId: Uuid; correlationId: Uuid; workerId: Uuid; programId: Uuid }) {
    super({ eventName: 'BenefitsEnrollmentSubmitted', tenantId: props.tenantId, aggregateType: 'BenefitsEnrollment', aggregateId: props.aggregateId, correlationId: props.correlationId });
    this.workerId = props.workerId.value;
    this.programId = props.programId.value;
  }
}

export class BenefitsEnrollmentApproved extends DomainEvent {
  constructor(props: { tenantId: Uuid; aggregateId: Uuid; correlationId: Uuid }) {
    super({ eventName: 'BenefitsEnrollmentApproved', tenantId: props.tenantId, aggregateType: 'BenefitsEnrollment', aggregateId: props.aggregateId, correlationId: props.correlationId });
  }
}

export class BenefitsEnrollmentEffective extends DomainEvent {
  constructor(props: { tenantId: Uuid; aggregateId: Uuid; correlationId: Uuid }) {
    super({ eventName: 'BenefitsEnrollmentEffective', tenantId: props.tenantId, aggregateType: 'BenefitsEnrollment', aggregateId: props.aggregateId, correlationId: props.correlationId });
  }
}

export class BenefitsEnrollmentTerminated extends DomainEvent {
  constructor(props: { tenantId: Uuid; aggregateId: Uuid; correlationId: Uuid }) {
    super({ eventName: 'BenefitsEnrollmentTerminated', tenantId: props.tenantId, aggregateType: 'BenefitsEnrollment', aggregateId: props.aggregateId, correlationId: props.correlationId });
  }
}

export class BenefitsEnrollmentRejected extends DomainEvent {
  constructor(props: { tenantId: Uuid; aggregateId: Uuid; correlationId: Uuid }) {
    super({ eventName: 'BenefitsEnrollmentRejected', tenantId: props.tenantId, aggregateType: 'BenefitsEnrollment', aggregateId: props.aggregateId, correlationId: props.correlationId });
  }
}

/* ------------------------------------------------------------------ */
/*  Aggregate                                                          */
/* ------------------------------------------------------------------ */

/**
 * Aggregate root representing a benefits enrollment.
 *
 * FSM lifecycle: DRAFT → SUBMITTED → PENDING_APPROVAL → APPROVED → EFFECTIVE → TERMINATED (terminal)
 *                                                              ↘ REJECTED (terminal)
 */
export class BenefitsEnrollment extends AggregateRoot {
  readonly tenantId: Uuid;
  workerId: Uuid;
  programId: Uuid;
  coverageLevel: string;
  dependents: DependentEntry[];
  effectiveDate: Date;
  /** @hrDataClassification HIGH_SENSITIVITY */
  premiumAmount: number;
  /** @hrDataClassification HIGH_SENSITIVITY */
  currency: string;
  status: BenefitsEnrollmentStatus;
  readonly createdAt: Date;
  updatedAt: Date;

  get aggregateVersion(): number {
    return this.version;
  }

  constructor(props: BenefitsEnrollmentProps) {
    super(props.id);
    this.tenantId = props.tenantId;
    this.workerId = props.workerId;
    this.programId = props.programId;
    this.coverageLevel = props.coverageLevel;
    this.dependents = props.dependents;
    this.effectiveDate = props.effectiveDate;
    this.premiumAmount = props.premiumAmount;
    this.currency = props.currency;
    this.status = props.status;
    this.createdAt = props.createdAt ?? new Date();
    this.updatedAt = props.updatedAt ?? new Date();
    if (props.aggregateVersion !== undefined) {
      this.restoreVersion(props.aggregateVersion);
    }
  }

  static create(props: Omit<BenefitsEnrollmentProps, 'status' | 'createdAt' | 'updatedAt' | 'aggregateVersion'> & { correlationId: Uuid }): BenefitsEnrollment {
    Guard.againstEmptyString(props.coverageLevel, 'coverageLevel');
    Guard.againstNegativeNumber(props.premiumAmount, 'premiumAmount');
    Guard.againstEmptyString(props.currency, 'currency');

    const enrollment = new BenefitsEnrollment({
      ...props,
      status: 'DRAFT',
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    return enrollment;
  }

  submit(correlationId: Uuid): void {
    if (this.status !== 'DRAFT') {
      throw new Error(`Cannot submit BenefitsEnrollment from state ${this.status}`);
    }
    this.status = 'SUBMITTED';
    this.updatedAt = new Date();
    this.incrementVersion();
    this.addDomainEvent(new BenefitsEnrollmentSubmitted({ tenantId: this.tenantId, aggregateId: this.id, correlationId, workerId: this.workerId, programId: this.programId }));
  }

  sendForApproval(_correlationId: Uuid): void {
    if (this.status !== 'SUBMITTED') {
      throw new Error(`Cannot send BenefitsEnrollment for approval from state ${this.status}`);
    }
    this.status = 'PENDING_APPROVAL';
    this.updatedAt = new Date();
    this.incrementVersion();
  }

  approve(correlationId: Uuid): void {
    if (this.status !== 'PENDING_APPROVAL') {
      throw new Error(`Cannot approve BenefitsEnrollment from state ${this.status}`);
    }
    this.status = 'APPROVED';
    this.updatedAt = new Date();
    this.incrementVersion();
    this.addDomainEvent(new BenefitsEnrollmentApproved({ tenantId: this.tenantId, aggregateId: this.id, correlationId }));
  }

  makeEffective(correlationId: Uuid): void {
    if (this.status !== 'APPROVED') {
      throw new Error(`Cannot make BenefitsEnrollment effective from state ${this.status}`);
    }
    this.status = 'EFFECTIVE';
    this.updatedAt = new Date();
    this.incrementVersion();
    this.addDomainEvent(new BenefitsEnrollmentEffective({ tenantId: this.tenantId, aggregateId: this.id, correlationId }));
  }

  terminate(correlationId: Uuid): void {
    if (this.status !== 'EFFECTIVE' && this.status !== 'APPROVED') {
      throw new Error(`Cannot terminate BenefitsEnrollment from state ${this.status}`);
    }
    this.status = 'TERMINATED';
    this.updatedAt = new Date();
    this.incrementVersion();
    this.addDomainEvent(new BenefitsEnrollmentTerminated({ tenantId: this.tenantId, aggregateId: this.id, correlationId }));
  }

  reject(correlationId: Uuid): void {
    if (this.status !== 'PENDING_APPROVAL') {
      throw new Error(`Cannot reject BenefitsEnrollment from state ${this.status}`);
    }
    this.status = 'REJECTED';
    this.updatedAt = new Date();
    this.incrementVersion();
    this.addDomainEvent(new BenefitsEnrollmentRejected({ tenantId: this.tenantId, aggregateId: this.id, correlationId }));
  }
}
