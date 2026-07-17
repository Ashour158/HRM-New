/**
 * @hrDataClassification HIGH_SENSITIVITY - immigration/work-authorization attestation and E-Verify eligibility fields.
 */
import { AggregateRoot, DomainEvent, Uuid, Guard, ValidationError } from '@hcm/shared-kernel';

/**
 * Status values for the {@link I9Case} lifecycle.
 *
 * DRAFT -> SECTION1_COMPLETED -> SECTION2_VERIFIED
 *   SECTION2_VERIFIED -> REJECTED (terminal, document review fails)
 *   SECTION2_VERIFIED -> EVERIFY_SUBMITTED (employer participates in E-Verify)
 *     EVERIFY_SUBMITTED -> EVERIFY_CONFIRMED (terminal)
 *     EVERIFY_SUBMITTED -> EVERIFY_TNC (tentative nonconfirmation)
 *       EVERIFY_TNC -> EVERIFY_FINAL_NONCONFIRMATION (terminal, not contested / contest period expired)
 *       EVERIFY_TNC -> EVERIFY_TNC_CONTESTED
 *         EVERIFY_TNC_CONTESTED -> EVERIFY_CONFIRMED (terminal)
 *         EVERIFY_TNC_CONTESTED -> EVERIFY_FINAL_NONCONFIRMATION (terminal)
 *
 * An I9Case that never submits to E-Verify simply remains at SECTION2_VERIFIED,
 * which is a valid, stable (non-terminal but complete) state for employers who
 * are not E-Verify participants.
 */
export type I9CaseStatus =
  | 'DRAFT'
  | 'SECTION1_COMPLETED'
  | 'SECTION2_VERIFIED'
  | 'REJECTED'
  | 'EVERIFY_SUBMITTED'
  | 'EVERIFY_CONFIRMED'
  | 'EVERIFY_TNC'
  | 'EVERIFY_TNC_CONTESTED'
  | 'EVERIFY_FINAL_NONCONFIRMATION';

/**
 * Employee attestation category captured on Form I-9 Section 1 (modeled minimally;
 * not the full USCIS field set).
 */
export type I9CitizenshipStatus =
  | 'US_CITIZEN'
  | 'NONCITIZEN_NATIONAL'
  | 'LAWFUL_PERMANENT_RESIDENT'
  | 'AUTHORIZED_ALIEN';

/**
 * Section 2 document evidence category. Modeled minimally as an enum rather than
 * a full document taxonomy: either a single List A document, or a List B + List C
 * combination.
 */
export type I9DocumentType = 'LIST_A' | 'LIST_B_AND_C';

/** Outcome values shared with {@link EverifyCase}. */
export type EverifyResult = 'CONFIRMED' | 'TENTATIVE_NONCONFIRMATION' | 'FINAL_NONCONFIRMATION';

export interface I9CaseProps {
  id: Uuid;
  tenantId: Uuid;
  workerId: Uuid;
  startDate: Date;
  status?: I9CaseStatus;
  citizenshipStatus?: I9CitizenshipStatus;
  section1CompletedAt?: Date;
  section1LateFlag?: boolean;
  documentType?: I9DocumentType;
  documentDescriptions?: string[];
  documentExpirationDate?: Date;
  reviewerId?: Uuid;
  section2DueDate?: Date;
  section2CompletedAt?: Date;
  section2LateFlag?: boolean;
  everifyCaseId?: Uuid;
  rejectionReason?: string;
  aggregateVersion?: number;
  createdAt?: Date;
  updatedAt?: Date;
}

/**
 * Adds `days` business days (Mon-Fri) to `date`. Does not account for public
 * holidays - acceptable for the MVP scope of this domain.
 */
export function addBusinessDays(date: Date, days: number): Date {
  const result = new Date(date.getTime());
  let remaining = days;
  while (remaining > 0) {
    result.setUTCDate(result.getUTCDate() + 1);
    const dayOfWeek = result.getUTCDay();
    if (dayOfWeek !== 0 && dayOfWeek !== 6) {
      remaining -= 1;
    }
  }
  return result;
}

/* ------------------------------------------------------------------ */
/*  Domain Events                                                      */
/* ------------------------------------------------------------------ */

export class I9CaseCreated extends DomainEvent {
  readonly workerId: string;

  constructor(props: { tenantId: Uuid; aggregateId: Uuid; correlationId: Uuid; workerId: Uuid }) {
    super({
      eventName: 'I9CaseCreated',
      tenantId: props.tenantId,
      aggregateType: 'I9Case',
      aggregateId: props.aggregateId,
      correlationId: props.correlationId,
    });
    this.workerId = props.workerId.value;
  }
}

export class I9CaseSection1Completed extends DomainEvent {
  readonly workerId: string;
  readonly late: boolean;

  constructor(props: { tenantId: Uuid; aggregateId: Uuid; correlationId: Uuid; workerId: Uuid; late: boolean }) {
    super({
      eventName: 'I9CaseSection1Completed',
      tenantId: props.tenantId,
      aggregateType: 'I9Case',
      aggregateId: props.aggregateId,
      correlationId: props.correlationId,
    });
    this.workerId = props.workerId.value;
    this.late = props.late;
  }
}

export class I9CaseSection2Completed extends DomainEvent {
  readonly workerId: string;
  readonly late: boolean;

  constructor(props: { tenantId: Uuid; aggregateId: Uuid; correlationId: Uuid; workerId: Uuid; late: boolean }) {
    super({
      eventName: 'I9CaseSection2Completed',
      tenantId: props.tenantId,
      aggregateType: 'I9Case',
      aggregateId: props.aggregateId,
      correlationId: props.correlationId,
    });
    this.workerId = props.workerId.value;
    this.late = props.late;
  }
}

export class I9CaseRejected extends DomainEvent {
  readonly workerId: string;
  readonly reason: string;

  constructor(props: { tenantId: Uuid; aggregateId: Uuid; correlationId: Uuid; workerId: Uuid; reason: string }) {
    super({
      eventName: 'I9CaseRejected',
      tenantId: props.tenantId,
      aggregateType: 'I9Case',
      aggregateId: props.aggregateId,
      correlationId: props.correlationId,
    });
    this.workerId = props.workerId.value;
    this.reason = props.reason;
  }
}

export class I9CaseEverifySubmitted extends DomainEvent {
  readonly workerId: string;
  readonly everifyCaseId: string;

  constructor(props: { tenantId: Uuid; aggregateId: Uuid; correlationId: Uuid; workerId: Uuid; everifyCaseId: Uuid }) {
    super({
      eventName: 'I9CaseEverifySubmitted',
      tenantId: props.tenantId,
      aggregateType: 'I9Case',
      aggregateId: props.aggregateId,
      correlationId: props.correlationId,
    });
    this.workerId = props.workerId.value;
    this.everifyCaseId = props.everifyCaseId.value;
  }
}

export class I9CaseEverifyResultRecorded extends DomainEvent {
  readonly workerId: string;
  readonly result: EverifyResult;

  constructor(props: { tenantId: Uuid; aggregateId: Uuid; correlationId: Uuid; workerId: Uuid; result: EverifyResult }) {
    super({
      eventName: 'I9CaseEverifyResultRecorded',
      tenantId: props.tenantId,
      aggregateType: 'I9Case',
      aggregateId: props.aggregateId,
      correlationId: props.correlationId,
    });
    this.workerId = props.workerId.value;
    this.result = props.result;
  }
}

export class I9CaseEverifyTncContested extends DomainEvent {
  readonly workerId: string;

  constructor(props: { tenantId: Uuid; aggregateId: Uuid; correlationId: Uuid; workerId: Uuid }) {
    super({
      eventName: 'I9CaseEverifyTncContested',
      tenantId: props.tenantId,
      aggregateType: 'I9Case',
      aggregateId: props.aggregateId,
      correlationId: props.correlationId,
    });
    this.workerId = props.workerId.value;
  }
}

/* ------------------------------------------------------------------ */
/*  Aggregate                                                          */
/* ------------------------------------------------------------------ */

const TERMINAL_STATES: I9CaseStatus[] = ['REJECTED', 'EVERIFY_CONFIRMED', 'EVERIFY_FINAL_NONCONFIRMATION'];

/**
 * Aggregate root representing a worker's Form I-9 employment-eligibility-verification
 * case, optionally continuing into an E-Verify submission and determination.
 *
 * This models the real I-9 process at MVP fidelity (not the full legal complexity
 * of USCIS Form I-9): Section 1 employee attestation, Section 2 employer document
 * review with a 3-business-day compliance window, and an optional E-Verify
 * sub-lifecycle mirrored at a high level on this aggregate's own status for easy
 * querying (the {@link EverifyCase} aggregate is the detailed system-of-record for
 * the E-Verify submission itself).
 */
export class I9Case extends AggregateRoot {
  readonly tenantId: Uuid;
  workerId: Uuid;
  startDate: Date;
  status: I9CaseStatus;
  citizenshipStatus?: I9CitizenshipStatus;
  section1CompletedAt?: Date;
  section1LateFlag: boolean;
  documentType?: I9DocumentType;
  documentDescriptions: string[];
  documentExpirationDate?: Date;
  reviewerId?: Uuid;
  section2DueDate: Date;
  section2CompletedAt?: Date;
  section2LateFlag: boolean;
  everifyCaseId?: Uuid;
  rejectionReason?: string;
  createdAt: Date;
  updatedAt: Date;

  get aggregateVersion(): number {
    return this.version;
  }

  constructor(props: I9CaseProps) {
    super(props.id);
    this.tenantId = props.tenantId;
    this.workerId = props.workerId;
    this.startDate = props.startDate;
    this.status = props.status ?? 'DRAFT';
    this.citizenshipStatus = props.citizenshipStatus;
    this.section1CompletedAt = props.section1CompletedAt;
    this.section1LateFlag = props.section1LateFlag ?? false;
    this.documentType = props.documentType;
    this.documentDescriptions = props.documentDescriptions ?? [];
    this.documentExpirationDate = props.documentExpirationDate;
    this.reviewerId = props.reviewerId;
    this.section2DueDate = props.section2DueDate ?? addBusinessDays(props.startDate, 3);
    this.section2CompletedAt = props.section2CompletedAt;
    this.section2LateFlag = props.section2LateFlag ?? false;
    this.everifyCaseId = props.everifyCaseId;
    this.rejectionReason = props.rejectionReason;
    this.createdAt = props.createdAt ?? new Date();
    this.updatedAt = props.updatedAt ?? new Date();
    if (props.aggregateVersion !== undefined) {
      this.restoreVersion(props.aggregateVersion);
    }
  }

  /**
   * Factory method to create a new I9Case in DRAFT state. Computes the Section 2
   * compliance due date (3 business days after the worker's start date) up front.
   */
  static create(props: I9CaseProps, correlationId: Uuid): I9Case {
    Guard.againstNullOrUndefined(props.workerId, 'workerId');
    Guard.againstNullOrUndefined(props.startDate, 'startDate');

    const i9Case = new I9Case({
      ...props,
      status: 'DRAFT',
      section2DueDate: addBusinessDays(props.startDate, 3),
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    i9Case.addDomainEvent(
      new I9CaseCreated({
        tenantId: i9Case.tenantId,
        aggregateId: i9Case.id,
        correlationId,
        workerId: i9Case.workerId,
      }),
    );

    return i9Case;
  }

  /**
   * Records the employee's Section 1 attestation (DRAFT -> SECTION1_COMPLETED).
   * Section 1 is due by the worker's first day of employment; completions after
   * `startDate` are recorded honestly as late rather than blocked.
   */
  completeSection1(
    correlationId: Uuid,
    input: { citizenshipStatus: I9CitizenshipStatus; section1CompletedAt?: Date },
  ): void {
    if (this.status !== 'DRAFT') {
      throw new ValidationError(`Cannot complete Section 1 from state ${this.status}`);
    }
    const completedAt = input.section1CompletedAt ?? new Date();
    this.citizenshipStatus = input.citizenshipStatus;
    this.section1CompletedAt = completedAt;
    this.section1LateFlag = completedAt.getTime() > this.startDate.getTime();
    this.status = 'SECTION1_COMPLETED';
    this.addDomainEvent(
      new I9CaseSection1Completed({
        tenantId: this.tenantId,
        aggregateId: this.id,
        correlationId,
        workerId: this.workerId,
        late: this.section1LateFlag,
      }),
    );
    this.incrementVersion();
    this.updatedAt = new Date();
  }

  /**
   * Records the employer's Section 2 document review (SECTION1_COMPLETED ->
   * SECTION2_VERIFIED). Section 2 must occur within 3 business days of the start
   * date (`section2DueDate`); late completion is flagged, not blocked, matching
   * real I-9 compliance practice.
   */
  completeSection2(
    correlationId: Uuid,
    input: {
      documentType: I9DocumentType;
      documentDescriptions: string[];
      documentExpirationDate?: Date;
      reviewerId: Uuid;
      section2CompletedAt?: Date;
    },
  ): void {
    if (this.status !== 'SECTION1_COMPLETED') {
      throw new ValidationError(`Cannot complete Section 2 from state ${this.status}`);
    }
    Guard.againstNullOrUndefined(input.reviewerId, 'reviewerId');
    if (!input.documentType) {
      throw new ValidationError('documentType is required to complete Section 2');
    }
    const completedAt = input.section2CompletedAt ?? new Date();
    this.documentType = input.documentType;
    this.documentDescriptions = input.documentDescriptions ?? [];
    this.documentExpirationDate = input.documentExpirationDate;
    this.reviewerId = input.reviewerId;
    this.section2CompletedAt = completedAt;
    this.section2LateFlag = completedAt.getTime() > this.section2DueDate.getTime();
    this.status = 'SECTION2_VERIFIED';
    this.addDomainEvent(
      new I9CaseSection2Completed({
        tenantId: this.tenantId,
        aggregateId: this.id,
        correlationId,
        workerId: this.workerId,
        late: this.section2LateFlag,
      }),
    );
    this.incrementVersion();
    this.updatedAt = new Date();
  }

  /** Rejects the case after document review fails (SECTION2_VERIFIED -> REJECTED). */
  reject(correlationId: Uuid, reason: string): void {
    if (this.status !== 'SECTION2_VERIFIED') {
      throw new ValidationError(`Cannot reject from state ${this.status}`);
    }
    Guard.againstEmptyString(reason, 'reason');
    this.rejectionReason = reason;
    this.status = 'REJECTED';
    this.addDomainEvent(
      new I9CaseRejected({
        tenantId: this.tenantId,
        aggregateId: this.id,
        correlationId,
        workerId: this.workerId,
        reason,
      }),
    );
    this.incrementVersion();
    this.updatedAt = new Date();
  }

  /** Links a submitted E-Verify case (SECTION2_VERIFIED -> EVERIFY_SUBMITTED). */
  submitEverify(correlationId: Uuid, everifyCaseId: Uuid): void {
    if (this.status !== 'SECTION2_VERIFIED') {
      throw new ValidationError(`Cannot submit to E-Verify from state ${this.status}`);
    }
    this.everifyCaseId = everifyCaseId;
    this.status = 'EVERIFY_SUBMITTED';
    this.addDomainEvent(
      new I9CaseEverifySubmitted({
        tenantId: this.tenantId,
        aggregateId: this.id,
        correlationId,
        workerId: this.workerId,
        everifyCaseId,
      }),
    );
    this.incrementVersion();
    this.updatedAt = new Date();
  }

  /**
   * Records an E-Verify determination. Valid from EVERIFY_SUBMITTED (first
   * determination: CONFIRMED or TENTATIVE_NONCONFIRMATION) or from
   * EVERIFY_TNC_CONTESTED (final determination after contest: CONFIRMED or
   * FINAL_NONCONFIRMATION), or directly from EVERIFY_TNC when the worker does not
   * contest (or the contest period lapses): FINAL_NONCONFIRMATION only.
   */
  recordEverifyResult(correlationId: Uuid, result: EverifyResult): void {
    const target = this.resolveEverifyResultTransition(result);
    this.status = target;
    this.addDomainEvent(
      new I9CaseEverifyResultRecorded({
        tenantId: this.tenantId,
        aggregateId: this.id,
        correlationId,
        workerId: this.workerId,
        result,
      }),
    );
    this.incrementVersion();
    this.updatedAt = new Date();
  }

  private resolveEverifyResultTransition(result: EverifyResult): I9CaseStatus {
    if (this.status === 'EVERIFY_SUBMITTED') {
      if (result === 'CONFIRMED') return 'EVERIFY_CONFIRMED';
      if (result === 'TENTATIVE_NONCONFIRMATION') return 'EVERIFY_TNC';
      throw new ValidationError(
        'A first E-Verify determination must be CONFIRMED or TENTATIVE_NONCONFIRMATION',
      );
    }
    if (this.status === 'EVERIFY_TNC') {
      if (result === 'FINAL_NONCONFIRMATION') return 'EVERIFY_FINAL_NONCONFIRMATION';
      throw new ValidationError(
        'An uncontested tentative nonconfirmation can only resolve to FINAL_NONCONFIRMATION',
      );
    }
    if (this.status === 'EVERIFY_TNC_CONTESTED') {
      if (result === 'CONFIRMED' || result === 'FINAL_NONCONFIRMATION') return result === 'CONFIRMED' ? 'EVERIFY_CONFIRMED' : 'EVERIFY_FINAL_NONCONFIRMATION';
      throw new ValidationError(
        'A contested tentative nonconfirmation must resolve to CONFIRMED or FINAL_NONCONFIRMATION',
      );
    }
    throw new ValidationError(`Cannot record an E-Verify result from state ${this.status}`);
  }

  /** Contests a tentative nonconfirmation (EVERIFY_TNC -> EVERIFY_TNC_CONTESTED). */
  contestTnc(correlationId: Uuid): void {
    if (this.status !== 'EVERIFY_TNC') {
      throw new ValidationError(`Cannot contest a tentative nonconfirmation from state ${this.status}`);
    }
    this.status = 'EVERIFY_TNC_CONTESTED';
    this.addDomainEvent(
      new I9CaseEverifyTncContested({
        tenantId: this.tenantId,
        aggregateId: this.id,
        correlationId,
        workerId: this.workerId,
      }),
    );
    this.incrementVersion();
    this.updatedAt = new Date();
  }

  get isTerminal(): boolean {
    return TERMINAL_STATES.includes(this.status);
  }
}
