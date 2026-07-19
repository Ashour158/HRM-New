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
 * Voluntary EEO self-identification data (race/ethnicity, gender identity,
 * veteran status, disability status). U.S. EEO law (29 CFR 1607, VEVRAA,
 * Section 503) requires this data collection to be voluntary and requires it
 * be kept separate from the hiring decision-making process.
 *
 * ACCESS: governed as SPECIAL_CATEGORY data — see
 * `SENSITIVE_FIELD_RULES['candidate.eeoSelfIdentification']` in
 * platform/command-bus/command-bus.ts (write-side: RECRUITER cannot submit or
 * mutate this data) and the `candidate.eeoSelfIdentification` FieldPolicy in
 * @hcm/access-control (read-side: MANAGER/hiring-manager roles are denied).
 * `RecruitingController.getCandidate()` never includes this field in its
 * response — the only reader is the adverse-impact analysis pipeline, which
 * only ever surfaces k-anonymity-suppressed, group-level aggregates, never
 * individual self-identification records.
 */
export interface CandidateEeoSelfIdentification {
  /** @hrDataClassification SPECIAL_CATEGORY */
  raceEthnicity?: string;
  /** @hrDataClassification SPECIAL_CATEGORY */
  genderIdentity?: string;
  /** @hrDataClassification SPECIAL_CATEGORY */
  veteranStatus?: string;
  /** @hrDataClassification SPECIAL_CATEGORY */
  disabilityStatus?: string;
  /** True when the candidate affirmatively chose not to self-identify. */
  declinedToSelfIdentify?: boolean;
  recordedAt?: Date;
}

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
  /** @hrDataClassification SPECIAL_CATEGORY — voluntary EEO self-identification, access-restricted. */
  eeoSelfIdentification?: CandidateEeoSelfIdentification;
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

/**
 * Emitted when a candidate's voluntary EEO self-identification is recorded.
 * Deliberately carries no demographic values — only the fact that a
 * self-identification record now exists — so the event stream / outbox never
 * propagates SPECIAL_CATEGORY data.
 */
export class CandidateEeoSelfIdentificationRecorded extends DomainEvent {
  constructor(props: { tenantId: Uuid; aggregateId: Uuid; correlationId: Uuid }) {
    super({
      eventName: 'CandidateEeoSelfIdentificationRecorded',
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
  /** @hrDataClassification SPECIAL_CATEGORY — voluntary EEO self-identification, access-restricted. */
  eeoSelfIdentification?: CandidateEeoSelfIdentification;
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
    this.eeoSelfIdentification = props.eeoSelfIdentification;
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
   * Record (or update) the candidate's voluntary EEO self-identification.
   *
   * All fields are genuinely optional — a candidate may decline to answer any
   * or all of them (`declinedToSelfIdentify: true` records the fact of a
   * decline without inferring anything from it). Can be recorded at any point
   * before a terminal state, independent of application-pipeline progress,
   * since self-ID is deliberately decoupled from the hiring decision.
   *
   * Write access to this method's inputs is restricted at the command-bus
   * layer (`SENSITIVE_FIELD_RULES['candidate.eeoSelfIdentification']`) —
   * recruiters cannot submit this on a candidate's behalf.
   */
  recordEeoSelfIdentification(data: CandidateEeoSelfIdentification, correlationId: Uuid): void {
    if (this.status === 'HIRED' || this.status === 'REJECTED' || this.status === 'WITHDRAWN') {
      throw new ConflictError('Cannot record EEO self-identification for a candidate in a terminal state');
    }
    this.eeoSelfIdentification = { ...data, recordedAt: data.recordedAt ?? new Date() };
    this.bumpVersion();
    this.addDomainEvent(
      new CandidateEeoSelfIdentificationRecorded({
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
