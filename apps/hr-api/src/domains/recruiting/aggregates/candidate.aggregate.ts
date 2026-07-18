import { AggregateRoot, DomainEvent, Uuid, Guard, ConflictError } from '@hcm/shared-kernel';

/**
 * Canonical candidate status values.
 */
export type CandidateStatus =
  | 'NEW'
  | 'SCREENING'
  | 'INTERVIEWING'
  | 'OFFER_PENDING'
  | 'HIRED'
  | 'REJECTED'
  | 'WITHDRAWN';

/**
 * Properties required to construct or rehydrate a {@link Candidate} aggregate.
 */
export interface CandidateProps {
  id: Uuid;
  tenantId: Uuid;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  resumeUrl?: string;
  source?: string;
  status?: CandidateStatus;
  requisitionId: Uuid;
  aggregateVersion?: number;
  createdAt?: Date;
  updatedAt?: Date;
}

/* ------------------------------------------------------------------ */
/*  Domain Events                                                      */
/* ------------------------------------------------------------------ */

export class CandidateCreated extends DomainEvent {
  readonly email: string;
  readonly requisitionId: string;

  constructor(props: {
    tenantId: Uuid;
    aggregateId: Uuid;
    correlationId: Uuid;
    email: string;
    requisitionId: Uuid;
  }) {
    super({
      eventName: 'CandidateCreated',
      tenantId: props.tenantId,
      aggregateType: 'Candidate',
      aggregateId: props.aggregateId,
      correlationId: props.correlationId,
    });
    this.email = props.email;
    this.requisitionId = props.requisitionId.value;
  }
}

export class CandidateScreened extends DomainEvent {
  constructor(props: { tenantId: Uuid; aggregateId: Uuid; correlationId: Uuid }) {
    super({
      eventName: 'CandidateScreened',
      tenantId: props.tenantId,
      aggregateType: 'Candidate',
      aggregateId: props.aggregateId,
      correlationId: props.correlationId,
    });
  }
}

export class CandidateInterviewScheduled extends DomainEvent {
  constructor(props: { tenantId: Uuid; aggregateId: Uuid; correlationId: Uuid }) {
    super({
      eventName: 'CandidateInterviewScheduled',
      tenantId: props.tenantId,
      aggregateType: 'Candidate',
      aggregateId: props.aggregateId,
      correlationId: props.correlationId,
    });
  }
}

export class CandidateOfferPending extends DomainEvent {
  constructor(props: { tenantId: Uuid; aggregateId: Uuid; correlationId: Uuid }) {
    super({
      eventName: 'CandidateOfferPending',
      tenantId: props.tenantId,
      aggregateType: 'Candidate',
      aggregateId: props.aggregateId,
      correlationId: props.correlationId,
    });
  }
}

export class CandidateHired extends DomainEvent {
  constructor(props: { tenantId: Uuid; aggregateId: Uuid; correlationId: Uuid }) {
    super({
      eventName: 'CandidateHired',
      tenantId: props.tenantId,
      aggregateType: 'Candidate',
      aggregateId: props.aggregateId,
      correlationId: props.correlationId,
    });
  }
}

export class CandidateRejected extends DomainEvent {
  constructor(props: { tenantId: Uuid; aggregateId: Uuid; correlationId: Uuid }) {
    super({
      eventName: 'CandidateRejected',
      tenantId: props.tenantId,
      aggregateType: 'Candidate',
      aggregateId: props.aggregateId,
      correlationId: props.correlationId,
    });
  }
}

export class CandidateWithdrew extends DomainEvent {
  constructor(props: { tenantId: Uuid; aggregateId: Uuid; correlationId: Uuid }) {
    super({
      eventName: 'CandidateWithdrew',
      tenantId: props.tenantId,
      aggregateType: 'Candidate',
      aggregateId: props.aggregateId,
      correlationId: props.correlationId,
    });
  }
}

/* ------------------------------------------------------------------ */
/*  Aggregate                                                          */
/* ------------------------------------------------------------------ */

/**
 * Candidate aggregate root.
 *
 * Represents an applicant for a job requisition.
 * Lifecycle: NEW → SCREENING → INTERVIEWING → OFFER_PENDING → HIRED
 * Terminal states: REJECTED, WITHDRAWN
 */
export class Candidate extends AggregateRoot {
  private _aggregateVersion = 0;

  readonly tenantId: Uuid;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  resumeUrl?: string;
  source?: string;
  status: CandidateStatus;
  requisitionId: Uuid;
  createdAt: Date;
  updatedAt: Date;

  /** Optimistic lock version. */
  get version(): number {
    return this._aggregateVersion;
  }

  /** Alias for version used by repositories. */
  get aggregateVersion(): number {
    return this._aggregateVersion;
  }

  /** Increment the optimistic lock version. */
  incrementVersion(): void {
    this._aggregateVersion++;
  }

  private constructor(props: CandidateProps) {
    super(props.id);
    this.tenantId = props.tenantId;
    this.firstName = props.firstName;
    this.lastName = props.lastName;
    this.email = props.email;
    this.phone = props.phone;
    this.resumeUrl = props.resumeUrl;
    this.source = props.source;
    this.status = props.status ?? 'NEW';
    this.requisitionId = props.requisitionId;
    this.createdAt = props.createdAt ?? new Date();
    this.updatedAt = props.updatedAt ?? new Date();
    if (props.aggregateVersion !== undefined) {
      this._aggregateVersion = props.aggregateVersion;
    }
  }

  /**
   * Factory method to create a new Candidate in NEW state.
   */
  static create(props: CandidateProps, correlationId: Uuid): Candidate {
    Guard.againstEmptyString(props.firstName, 'firstName');
    Guard.againstEmptyString(props.lastName, 'lastName');
    Guard.againstEmptyString(props.email, 'email');

    const candidate = new Candidate({
      ...props,
      status: 'NEW',
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    candidate.addDomainEvent(
      new CandidateCreated({
        tenantId: candidate.tenantId,
        aggregateId: candidate.id,
        correlationId,
        email: candidate.email,
        requisitionId: candidate.requisitionId,
      }),
    );

    return candidate;
  }

  /**
   * Reconstructs an existing Candidate from persisted state.
   *
   * Unlike {@link create}, this preserves the persisted `status`,
   * `createdAt`/`updatedAt`, and `aggregateVersion` exactly as given, runs
   * no creation-time guards, and emits no domain event. Repositories must
   * use this (not `create`) when loading an aggregate from the database —
   * `create` unconditionally resets status to NEW and re-emits
   * CandidateCreated, which would silently discard the real persisted
   * state on every read.
   */
  static rehydrate(props: CandidateProps): Candidate {
    return new Candidate(props);
  }

  /**
   * Move candidate to screening.
   * NEW → SCREENING
   */
  screen(correlationId: Uuid): void {
    if (this.status !== 'NEW') {
      throw new ConflictError('Candidate can only be screened from NEW state');
    }
    this.status = 'SCREENING';
    this.bumpVersion();
    this.addDomainEvent(
      new CandidateScreened({
        tenantId: this.tenantId,
        aggregateId: this.id,
        correlationId,
      }),
    );
  }

  /**
   * Move candidate to interviewing.
   * SCREENING → INTERVIEWING
   */
  scheduleInterview(correlationId: Uuid): void {
    if (this.status !== 'SCREENING') {
      throw new ConflictError('Candidate can only move to INTERVIEWING from SCREENING state');
    }
    this.status = 'INTERVIEWING';
    this.bumpVersion();
    this.addDomainEvent(
      new CandidateInterviewScheduled({
        tenantId: this.tenantId,
        aggregateId: this.id,
        correlationId,
      }),
    );
  }

  /**
   * Move candidate to offer pending.
   * INTERVIEWING → OFFER_PENDING
   */
  makeOfferPending(correlationId: Uuid): void {
    if (this.status !== 'INTERVIEWING') {
      throw new ConflictError('Candidate can only move to OFFER_PENDING from INTERVIEWING state');
    }
    this.status = 'OFFER_PENDING';
    this.bumpVersion();
    this.addDomainEvent(
      new CandidateOfferPending({
        tenantId: this.tenantId,
        aggregateId: this.id,
        correlationId,
      }),
    );
  }

  /**
   * Hire the candidate.
   * OFFER_PENDING → HIRED
   */
  hire(correlationId: Uuid): void {
    if (this.status !== 'OFFER_PENDING') {
      throw new ConflictError('Candidate can only be hired from OFFER_PENDING state');
    }
    this.status = 'HIRED';
    this.bumpVersion();
    this.addDomainEvent(
      new CandidateHired({
        tenantId: this.tenantId,
        aggregateId: this.id,
        correlationId,
      }),
    );
  }

  /**
   * Reject the candidate.
   * NEW → REJECTED, SCREENING → REJECTED, INTERVIEWING → REJECTED, OFFER_PENDING → REJECTED
   */
  reject(correlationId: Uuid): void {
    if (this.status === 'HIRED' || this.status === 'REJECTED' || this.status === 'WITHDRAWN') {
      throw new ConflictError('Cannot reject candidate in terminal state');
    }
    this.status = 'REJECTED';
    this.bumpVersion();
    this.addDomainEvent(
      new CandidateRejected({
        tenantId: this.tenantId,
        aggregateId: this.id,
        correlationId,
      }),
    );
  }

  /**
   * Candidate withdraws application.
   * Any non-terminal → WITHDRAWN (terminal)
   */
  withdraw(correlationId: Uuid): void {
    if (this.status === 'HIRED' || this.status === 'REJECTED' || this.status === 'WITHDRAWN') {
      throw new ConflictError('Cannot withdraw candidate in terminal state');
    }
    this.status = 'WITHDRAWN';
    this.bumpVersion();
    this.addDomainEvent(
      new CandidateWithdrew({
        tenantId: this.tenantId,
        aggregateId: this.id,
        correlationId,
      }),
    );
  }

  /**
   * Update mutable candidate attributes.
   */
  update(
    props: Partial<Pick<CandidateProps, 'firstName' | 'lastName' | 'email' | 'phone' | 'resumeUrl'>>,
    _correlationId: Uuid,
  ): void {
    if (this.status === 'HIRED' || this.status === 'REJECTED' || this.status === 'WITHDRAWN') {
      throw new ConflictError('Cannot update candidate in terminal state');
    }
    if (props.firstName !== undefined) this.firstName = props.firstName;
    if (props.lastName !== undefined) this.lastName = props.lastName;
    if (props.email !== undefined) this.email = props.email;
    if (props.phone !== undefined) this.phone = props.phone;
    if (props.resumeUrl !== undefined) this.resumeUrl = props.resumeUrl;
    this.bumpVersion();
    this.updatedAt = new Date();
  }

  private bumpVersion(): void {
    this.incrementVersion();
    this.updatedAt = new Date();
  }
}
