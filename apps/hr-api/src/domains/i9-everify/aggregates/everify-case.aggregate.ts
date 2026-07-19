/**
 * @hrDataClassification HIGH_SENSITIVITY - federal E-Verify submission and determination data.
 */
import { AggregateRoot, DomainEvent, Uuid, Guard, ValidationError } from '@hcm/shared-kernel';
import type { EverifyResult } from './i9-case.aggregate.js';
import { assertValidEverifyResult } from './everify-result-transition.js';

export type { EverifyResult } from './i9-case.aggregate.js';

/**
 * Status values for the {@link EverifyCase} lifecycle.
 *
 * DRAFT -> SUBMITTED -> CONFIRMED (terminal)
 *                     -> TENTATIVE_NONCONFIRMATION -> FINAL_NONCONFIRMATION (terminal, uncontested)
 *                                                   -> CONTESTED -> CONFIRMED (terminal)
 *                                                                -> FINAL_NONCONFIRMATION (terminal)
 */
export type EverifyCaseStatus =
  | 'DRAFT'
  | 'SUBMITTED'
  | 'CONFIRMED'
  | 'TENTATIVE_NONCONFIRMATION'
  | 'CONTESTED'
  | 'FINAL_NONCONFIRMATION';

export interface EverifyCaseProps {
  id: Uuid;
  tenantId: Uuid;
  workerId: Uuid;
  i9CaseId: Uuid;
  status?: EverifyCaseStatus;
  /** @hrDataClassification HIGH_SENSITIVITY - federal E-Verify case number. */
  caseNumber?: string;
  submittedAt?: Date;
  /**
   * @hrDataClassification HIGH_SENSITIVITY - advisory work-authorization determination.
   * Advisory determination returned synchronously by the submission adapter (real or mock).
   */
  simulatedDetermination?: EverifyResult;
  /** @hrDataClassification HIGH_SENSITIVITY - authoritative federal work-authorization determination. */
  result?: EverifyResult;
  resultRecordedAt?: Date;
  /** @hrDataClassification HIGH_SENSITIVITY - identity of the reviewer who recorded the E-Verify determination. */
  resultRecordedBy?: Uuid;
  contestedAt?: Date;
  aggregateVersion?: number;
  createdAt?: Date;
  updatedAt?: Date;
}

/* ------------------------------------------------------------------ */
/*  Domain Events                                                      */
/* ------------------------------------------------------------------ */

export class EverifyCaseCreated extends DomainEvent {
  readonly workerId: string;
  readonly i9CaseId: string;

  constructor(props: { tenantId: Uuid; aggregateId: Uuid; correlationId: Uuid; workerId: Uuid; i9CaseId: Uuid }) {
    super({
      eventName: 'EverifyCaseCreated',
      tenantId: props.tenantId,
      aggregateType: 'EverifyCase',
      aggregateId: props.aggregateId,
      correlationId: props.correlationId,
    });
    this.workerId = props.workerId.value;
    this.i9CaseId = props.i9CaseId.value;
  }
}

export class EverifyCaseSubmitted extends DomainEvent {
  readonly workerId: string;
  readonly caseNumber?: string;

  constructor(props: { tenantId: Uuid; aggregateId: Uuid; correlationId: Uuid; workerId: Uuid; caseNumber?: string }) {
    super({
      eventName: 'EverifyCaseSubmitted',
      tenantId: props.tenantId,
      aggregateType: 'EverifyCase',
      aggregateId: props.aggregateId,
      correlationId: props.correlationId,
    });
    this.workerId = props.workerId.value;
    this.caseNumber = props.caseNumber;
  }
}

export class EverifyCaseResultRecorded extends DomainEvent {
  readonly workerId: string;
  readonly result: EverifyResult;

  constructor(props: { tenantId: Uuid; aggregateId: Uuid; correlationId: Uuid; workerId: Uuid; result: EverifyResult }) {
    super({
      eventName: 'EverifyCaseResultRecorded',
      tenantId: props.tenantId,
      aggregateType: 'EverifyCase',
      aggregateId: props.aggregateId,
      correlationId: props.correlationId,
    });
    this.workerId = props.workerId.value;
    this.result = props.result;
  }
}

export class EverifyCaseContested extends DomainEvent {
  readonly workerId: string;

  constructor(props: { tenantId: Uuid; aggregateId: Uuid; correlationId: Uuid; workerId: Uuid }) {
    super({
      eventName: 'EverifyCaseContested',
      tenantId: props.tenantId,
      aggregateType: 'EverifyCase',
      aggregateId: props.aggregateId,
      correlationId: props.correlationId,
    });
    this.workerId = props.workerId.value;
  }
}

/* ------------------------------------------------------------------ */
/*  Aggregate                                                          */
/* ------------------------------------------------------------------ */

const TERMINAL_STATES: EverifyCaseStatus[] = ['CONFIRMED', 'FINAL_NONCONFIRMATION'];

/**
 * Aggregate root representing a single federal E-Verify submission for a
 * worker's {@link I9Case}. Distinct from I9Case because an I9Case can legally
 * exist without ever having an EverifyCase (employers who are not E-Verify
 * participants).
 */
export class EverifyCase extends AggregateRoot {
  readonly tenantId: Uuid;
  workerId: Uuid;
  i9CaseId: Uuid;
  status: EverifyCaseStatus;
  /** @hrDataClassification HIGH_SENSITIVITY - federal E-Verify case number. */
  caseNumber?: string;
  submittedAt?: Date;
  /** @hrDataClassification HIGH_SENSITIVITY - advisory work-authorization determination. */
  simulatedDetermination?: EverifyResult;
  /** @hrDataClassification HIGH_SENSITIVITY - authoritative federal work-authorization determination. */
  result?: EverifyResult;
  resultRecordedAt?: Date;
  /** @hrDataClassification HIGH_SENSITIVITY - identity of the reviewer who recorded the E-Verify determination. */
  resultRecordedBy?: Uuid;
  contestedAt?: Date;
  createdAt: Date;
  updatedAt: Date;

  get aggregateVersion(): number {
    return this.version;
  }

  constructor(props: EverifyCaseProps) {
    super(props.id);
    this.tenantId = props.tenantId;
    this.workerId = props.workerId;
    this.i9CaseId = props.i9CaseId;
    this.status = props.status ?? 'DRAFT';
    this.caseNumber = props.caseNumber;
    this.submittedAt = props.submittedAt;
    this.simulatedDetermination = props.simulatedDetermination;
    this.result = props.result;
    this.resultRecordedAt = props.resultRecordedAt;
    this.resultRecordedBy = props.resultRecordedBy;
    this.contestedAt = props.contestedAt;
    this.createdAt = props.createdAt ?? new Date();
    this.updatedAt = props.updatedAt ?? new Date();
    if (props.aggregateVersion !== undefined) {
      this.restoreVersion(props.aggregateVersion);
    }
  }

  /** Factory method to create a new EverifyCase in DRAFT state. */
  static create(props: EverifyCaseProps, correlationId: Uuid): EverifyCase {
    Guard.againstNullOrUndefined(props.workerId, 'workerId');
    Guard.againstNullOrUndefined(props.i9CaseId, 'i9CaseId');

    const everifyCase = new EverifyCase({
      ...props,
      status: 'DRAFT',
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    everifyCase.addDomainEvent(
      new EverifyCaseCreated({
        tenantId: everifyCase.tenantId,
        aggregateId: everifyCase.id,
        correlationId,
        workerId: everifyCase.workerId,
        i9CaseId: everifyCase.i9CaseId,
      }),
    );

    return everifyCase;
  }

  /**
   * Marks the case as submitted to the (real or mock) E-Verify adapter
   * (DRAFT -> SUBMITTED). `simulatedDetermination` is advisory only - it is the
   * value the submission adapter returned synchronously (a real integration
   * would not have this available yet at submission time); the authoritative
   * `result` is only ever set via {@link recordResult}.
   */
  submit(correlationId: Uuid, input: { caseNumber?: string; simulatedDetermination?: EverifyResult; submittedAt?: Date }): void {
    if (this.status !== 'DRAFT') {
      throw new ValidationError(`Cannot submit an E-Verify case from state ${this.status}`);
    }
    this.caseNumber = input.caseNumber;
    this.simulatedDetermination = input.simulatedDetermination;
    this.submittedAt = input.submittedAt ?? new Date();
    this.status = 'SUBMITTED';
    this.addDomainEvent(
      new EverifyCaseSubmitted({
        tenantId: this.tenantId,
        aggregateId: this.id,
        correlationId,
        workerId: this.workerId,
        caseNumber: this.caseNumber,
      }),
    );
    this.incrementVersion();
    this.updatedAt = new Date();
  }

  /**
   * Records the authoritative E-Verify determination. Valid from SUBMITTED
   * (CONFIRMED or TENTATIVE_NONCONFIRMATION), from TENTATIVE_NONCONFIRMATION
   * (FINAL_NONCONFIRMATION only, when not contested), or from CONTESTED
   * (CONFIRMED or FINAL_NONCONFIRMATION).
   */
  recordResult(correlationId: Uuid, result: EverifyResult, recordedBy?: Uuid): void {
    const target = this.resolveResultTransition(result);
    this.result = result;
    this.resultRecordedAt = new Date();
    this.resultRecordedBy = recordedBy;
    this.status = target;
    this.addDomainEvent(
      new EverifyCaseResultRecorded({
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

  private resolveResultTransition(result: EverifyResult): EverifyCaseStatus {
    if (this.status === 'SUBMITTED') {
      assertValidEverifyResult('AWAITING_FIRST_DETERMINATION', result);
      return result;
    }
    if (this.status === 'TENTATIVE_NONCONFIRMATION') {
      assertValidEverifyResult('UNCONTESTED_TNC', result);
      return 'FINAL_NONCONFIRMATION';
    }
    if (this.status === 'CONTESTED') {
      assertValidEverifyResult('CONTESTED_TNC', result);
      return result;
    }
    throw new ValidationError(`Cannot record an E-Verify result from state ${this.status}`);
  }

  /** Contests a tentative nonconfirmation (TENTATIVE_NONCONFIRMATION -> CONTESTED). */
  contest(correlationId: Uuid): void {
    if (this.status !== 'TENTATIVE_NONCONFIRMATION') {
      throw new ValidationError(`Cannot contest from state ${this.status}`);
    }
    this.status = 'CONTESTED';
    this.contestedAt = new Date();
    this.addDomainEvent(
      new EverifyCaseContested({
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
