import { AggregateRoot, DomainEvent, Uuid, Guard, ValidationError } from '@hcm/shared-kernel';

/**
 * Status values for the {@link WorkAuthorizationCase} lifecycle.
 */
export type WorkAuthorizationCaseStatus =
  | 'OPEN'
  | 'UNDER_REVIEW'
  | 'APPROVED'
  | 'EXPIRED'
  | 'RENEWED'
  | 'CLOSED'
  | 'REJECTED';

/**
 * Properties required to construct a {@link WorkAuthorizationCase}.
 */
export interface WorkAuthorizationCaseProps {
  id: Uuid;
  tenantId: Uuid;
  workerId: Uuid;
  authorizationType: string;
  issuingCountry: string;
  documentNumber?: string;
  validFrom?: Date;
  validUntil?: Date;
  status?: WorkAuthorizationCaseStatus;
  aggregateVersion?: number;
  createdAt?: Date;
  updatedAt?: Date;
}

/* ------------------------------------------------------------------ */
/*  Domain Events                                                      */
/* ------------------------------------------------------------------ */

export class WorkAuthorizationCaseOpened extends DomainEvent {
  readonly workerId: string;
  readonly authorizationType: string;

  constructor(props: {
    tenantId: Uuid;
    aggregateId: Uuid;
    correlationId: Uuid;
    workerId: Uuid;
    authorizationType: string;
  }) {
    super({
      eventName: 'WorkAuthorizationCaseOpened',
      tenantId: props.tenantId,
      aggregateType: 'WorkAuthorizationCase',
      aggregateId: props.aggregateId,
      correlationId: props.correlationId,
    });
    this.workerId = props.workerId.value;
    this.authorizationType = props.authorizationType;
  }
}

export class WorkAuthorizationCaseApproved extends DomainEvent {
  readonly workerId: string;

  constructor(props: { tenantId: Uuid; aggregateId: Uuid; correlationId: Uuid; workerId: Uuid }) {
    super({
      eventName: 'WorkAuthorizationCaseApproved',
      tenantId: props.tenantId,
      aggregateType: 'WorkAuthorizationCase',
      aggregateId: props.aggregateId,
      correlationId: props.correlationId,
    });
    this.workerId = props.workerId.value;
  }
}

export class WorkAuthorizationCaseExpired extends DomainEvent {
  readonly workerId: string;

  constructor(props: { tenantId: Uuid; aggregateId: Uuid; correlationId: Uuid; workerId: Uuid }) {
    super({
      eventName: 'WorkAuthorizationCaseExpired',
      tenantId: props.tenantId,
      aggregateType: 'WorkAuthorizationCase',
      aggregateId: props.aggregateId,
      correlationId: props.correlationId,
    });
    this.workerId = props.workerId.value;
  }
}

export class WorkAuthorizationCaseRenewed extends DomainEvent {
  readonly workerId: string;
  readonly newValidUntil: Date;

  constructor(props: {
    tenantId: Uuid;
    aggregateId: Uuid;
    correlationId: Uuid;
    workerId: Uuid;
    newValidUntil: Date;
  }) {
    super({
      eventName: 'WorkAuthorizationCaseRenewed',
      tenantId: props.tenantId,
      aggregateType: 'WorkAuthorizationCase',
      aggregateId: props.aggregateId,
      correlationId: props.correlationId,
    });
    this.workerId = props.workerId.value;
    this.newValidUntil = props.newValidUntil;
  }
}

export class WorkAuthorizationCaseClosed extends DomainEvent {
  readonly workerId: string;

  constructor(props: { tenantId: Uuid; aggregateId: Uuid; correlationId: Uuid; workerId: Uuid }) {
    super({
      eventName: 'WorkAuthorizationCaseClosed',
      tenantId: props.tenantId,
      aggregateType: 'WorkAuthorizationCase',
      aggregateId: props.aggregateId,
      correlationId: props.correlationId,
    });
    this.workerId = props.workerId.value;
  }
}

/* ------------------------------------------------------------------ */
/*  Aggregate                                                          */
/* ------------------------------------------------------------------ */

/**
 * Aggregate root representing a work authorization case for a worker.
 *
 * FSM lifecycle: OPEN → UNDER_REVIEW → APPROVED → EXPIRED → RENEWED → CLOSED (terminal)
 *                                                     └→ REJECTED (terminal)
 */
export class WorkAuthorizationCase extends AggregateRoot {
  readonly tenantId: Uuid;
  workerId: Uuid;
  authorizationType: string;
  issuingCountry: string;
  documentNumber?: string;
  validFrom?: Date;
  validUntil?: Date;
  status: WorkAuthorizationCaseStatus;
  createdAt: Date;
  updatedAt: Date;

  get aggregateVersion(): number {
    return this.version;
  }

  constructor(props: WorkAuthorizationCaseProps) {
    super(props.id);
    this.tenantId = props.tenantId;
    this.workerId = props.workerId;
    this.authorizationType = props.authorizationType;
    this.issuingCountry = props.issuingCountry;
    this.documentNumber = props.documentNumber;
    this.validFrom = props.validFrom;
    this.validUntil = props.validUntil;
    this.status = props.status ?? 'OPEN';
    this.createdAt = props.createdAt ?? new Date();
    this.updatedAt = props.updatedAt ?? new Date();
    if (props.aggregateVersion !== undefined) {
      this.restoreVersion(props.aggregateVersion);
    }
  }

  /**
   * Factory method to create a new WorkAuthorizationCase in OPEN state.
   */
  static create(props: WorkAuthorizationCaseProps, correlationId: Uuid): WorkAuthorizationCase {
    Guard.againstEmptyString(props.authorizationType, 'authorizationType');
    Guard.againstEmptyString(props.issuingCountry, 'issuingCountry');

    const authCase = new WorkAuthorizationCase({
      ...props,
      status: 'OPEN',
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    authCase.addDomainEvent(
      new WorkAuthorizationCaseOpened({
        tenantId: authCase.tenantId,
        aggregateId: authCase.id,
        correlationId,
        workerId: authCase.workerId,
        authorizationType: authCase.authorizationType,
      }),
    );

    return authCase;
  }

  /**
   * Start review (OPEN → UNDER_REVIEW).
   */
  startReview(_correlationId: Uuid): void {
    if (this.status !== 'OPEN') {
      throw new ValidationError(`Cannot start review from state ${this.status}`);
    }
    this.status = 'UNDER_REVIEW';
    this.incrementVersion();
    this.updatedAt = new Date();
  }

  /**
   * Approve the case (UNDER_REVIEW → APPROVED).
   */
  approve(correlationId: Uuid, validFrom: Date, validUntil: Date, documentNumber?: string): void {
    if (this.status !== 'UNDER_REVIEW') {
      throw new ValidationError(`Cannot approve from state ${this.status}`);
    }
    this.status = 'APPROVED';
    this.validFrom = validFrom;
    this.validUntil = validUntil;
    this.documentNumber = documentNumber;
    this.addDomainEvent(
      new WorkAuthorizationCaseApproved({
        tenantId: this.tenantId,
        aggregateId: this.id,
        correlationId,
        workerId: this.workerId,
      }),
    );
    this.incrementVersion();
    this.updatedAt = new Date();
  }

  /**
   * Mark as expired (APPROVED → EXPIRED).
   */
  expire(correlationId: Uuid): void {
    if (this.status !== 'APPROVED' && this.status !== 'RENEWED') {
      throw new ValidationError(`Cannot expire from state ${this.status}`);
    }
    this.status = 'EXPIRED';
    this.addDomainEvent(
      new WorkAuthorizationCaseExpired({
        tenantId: this.tenantId,
        aggregateId: this.id,
        correlationId,
        workerId: this.workerId,
      }),
    );
    this.incrementVersion();
    this.updatedAt = new Date();
  }

  /**
   * Renew the authorization (EXPIRED → RENEWED).
   */
  renew(correlationId: Uuid, newValidUntil: Date): void {
    if (this.status !== 'EXPIRED' && this.status !== 'APPROVED') {
      throw new ValidationError(`Cannot renew from state ${this.status}`);
    }
    this.status = 'RENEWED';
    this.validUntil = newValidUntil;
    this.addDomainEvent(
      new WorkAuthorizationCaseRenewed({
        tenantId: this.tenantId,
        aggregateId: this.id,
        correlationId,
        workerId: this.workerId,
        newValidUntil,
      }),
    );
    this.incrementVersion();
    this.updatedAt = new Date();
  }

  /**
   * Close the case (APPROVED | EXPIRED | RENEWED → CLOSED).
   */
  close(correlationId: Uuid): void {
    if (this.status !== 'APPROVED' && this.status !== 'EXPIRED' && this.status !== 'RENEWED') {
      throw new ValidationError(`Cannot close from state ${this.status}`);
    }
    this.status = 'CLOSED';
    this.addDomainEvent(
      new WorkAuthorizationCaseClosed({
        tenantId: this.tenantId,
        aggregateId: this.id,
        correlationId,
        workerId: this.workerId,
      }),
    );
    this.incrementVersion();
    this.updatedAt = new Date();
  }

  /**
   * Reject the case (UNDER_REVIEW → REJECTED).
   */
  reject(_correlationId: Uuid): void {
    if (this.status !== 'UNDER_REVIEW') {
      throw new ValidationError(`Cannot reject from state ${this.status}`);
    }
    this.status = 'REJECTED';
    this.incrementVersion();
    this.updatedAt = new Date();
  }
}
