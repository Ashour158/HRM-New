import { AggregateRoot, DomainEvent, Uuid, ConflictError } from '@hcm/shared-kernel';

/**
 * Canonical interview plan status values.
 */
export type InterviewPlanStatus = 'DRAFT' | 'SCHEDULED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';

/**
 * Interview format values.
 */
export type InterviewFormat = 'PHONE' | 'VIDEO' | 'ONSITE' | 'PANEL' | 'TAKE_HOME';

/**
 * Properties required to construct or rehydrate an {@link InterviewPlan} aggregate.
 */
export interface InterviewPlanProps {
  id: Uuid;
  tenantId: Uuid;
  candidateId: Uuid;
  requisitionId: Uuid;
  interviewers: Uuid[];
  scheduledAt?: Date;
  format?: InterviewFormat;
  status?: InterviewPlanStatus;
  aggregateVersion?: number;
  createdAt?: Date;
  updatedAt?: Date;
}

/* ------------------------------------------------------------------ */
/*  Domain Events                                                      */
/* ------------------------------------------------------------------ */

export class InterviewPlanCreated extends DomainEvent {
  readonly candidateId: string;
  readonly requisitionId: string;

  constructor(props: {
    tenantId: Uuid;
    aggregateId: Uuid;
    correlationId: Uuid;
    candidateId: Uuid;
    requisitionId: Uuid;
  }) {
    super({
      eventName: 'InterviewPlanCreated',
      tenantId: props.tenantId,
      aggregateType: 'InterviewPlan',
      aggregateId: props.aggregateId,
      correlationId: props.correlationId,
    });
    this.candidateId = props.candidateId.value;
    this.requisitionId = props.requisitionId.value;
  }
}

export class InterviewPlanScheduled extends DomainEvent {
  constructor(props: { tenantId: Uuid; aggregateId: Uuid; correlationId: Uuid }) {
    super({
      eventName: 'InterviewPlanScheduled',
      tenantId: props.tenantId,
      aggregateType: 'InterviewPlan',
      aggregateId: props.aggregateId,
      correlationId: props.correlationId,
    });
  }
}

export class InterviewPlanStarted extends DomainEvent {
  constructor(props: { tenantId: Uuid; aggregateId: Uuid; correlationId: Uuid }) {
    super({
      eventName: 'InterviewPlanStarted',
      tenantId: props.tenantId,
      aggregateType: 'InterviewPlan',
      aggregateId: props.aggregateId,
      correlationId: props.correlationId,
    });
  }
}

export class InterviewPlanCompleted extends DomainEvent {
  constructor(props: { tenantId: Uuid; aggregateId: Uuid; correlationId: Uuid }) {
    super({
      eventName: 'InterviewPlanCompleted',
      tenantId: props.tenantId,
      aggregateType: 'InterviewPlan',
      aggregateId: props.aggregateId,
      correlationId: props.correlationId,
    });
  }
}

export class InterviewPlanCancelled extends DomainEvent {
  constructor(props: { tenantId: Uuid; aggregateId: Uuid; correlationId: Uuid }) {
    super({
      eventName: 'InterviewPlanCancelled',
      tenantId: props.tenantId,
      aggregateType: 'InterviewPlan',
      aggregateId: props.aggregateId,
      correlationId: props.correlationId,
    });
  }
}

/* ------------------------------------------------------------------ */
/*  Aggregate                                                          */
/* ------------------------------------------------------------------ */

/**
 * InterviewPlan aggregate root.
 *
 * Represents a scheduled interview for a candidate against a requisition.
 * Lifecycle: DRAFT → SCHEDULED → IN_PROGRESS → COMPLETED
 * Terminal state: CANCELLED
 */
export class InterviewPlan extends AggregateRoot {
  private _aggregateVersion = 0;

  readonly tenantId: Uuid;
  candidateId: Uuid;
  requisitionId: Uuid;
  interviewers: Uuid[];
  scheduledAt?: Date;
  format?: InterviewFormat;
  status: InterviewPlanStatus;
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

  private constructor(props: InterviewPlanProps) {
    super(props.id);
    this.tenantId = props.tenantId;
    this.candidateId = props.candidateId;
    this.requisitionId = props.requisitionId;
    this.interviewers = props.interviewers;
    this.scheduledAt = props.scheduledAt;
    this.format = props.format;
    this.status = props.status ?? 'DRAFT';
    this.createdAt = props.createdAt ?? new Date();
    this.updatedAt = props.updatedAt ?? new Date();
    if (props.aggregateVersion !== undefined) {
      this._aggregateVersion = props.aggregateVersion;
    }
  }

  /**
   * Factory method to create a new InterviewPlan in DRAFT state.
   */
  static create(props: InterviewPlanProps, correlationId: Uuid): InterviewPlan {
    if (props.interviewers.length === 0) {
      throw new Error('interviewers must not be empty');
    }

    const plan = new InterviewPlan({
      ...props,
      status: 'DRAFT',
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    plan.addDomainEvent(
      new InterviewPlanCreated({
        tenantId: plan.tenantId,
        aggregateId: plan.id,
        correlationId,
        candidateId: plan.candidateId,
        requisitionId: plan.requisitionId,
      }),
    );

    return plan;
  }

  /**
   * Reconstructs an existing InterviewPlan from persisted state.
   *
   * Unlike {@link create}, this preserves the persisted `status`,
   * `createdAt`/`updatedAt`, and `aggregateVersion` exactly as given, runs
   * no creation-time guards, and emits no domain event. Repositories must
   * use this (not `create`) when loading an aggregate from the database —
   * `create` unconditionally resets status to DRAFT and re-emits
   * InterviewPlanCreated, which would silently discard the real persisted
   * state on every read.
   */
  static rehydrate(props: InterviewPlanProps): InterviewPlan {
    return new InterviewPlan(props);
  }

  /**
   * Schedule the interview.
   * DRAFT → SCHEDULED
   */
  schedule(scheduledAt: Date, format: InterviewFormat, correlationId: Uuid): void {
    if (this.status !== 'DRAFT') {
      throw new ConflictError('Interview can only be scheduled from DRAFT state');
    }
    this.status = 'SCHEDULED';
    this.scheduledAt = scheduledAt;
    this.format = format;
    this.bumpVersion();
    this.addDomainEvent(
      new InterviewPlanScheduled({
        tenantId: this.tenantId,
        aggregateId: this.id,
        correlationId,
      }),
    );
  }

  /**
   * Start the interview.
   * SCHEDULED → IN_PROGRESS
   */
  start(correlationId: Uuid): void {
    if (this.status !== 'SCHEDULED') {
      throw new ConflictError('Interview can only be started from SCHEDULED state');
    }
    this.status = 'IN_PROGRESS';
    this.bumpVersion();
    this.addDomainEvent(
      new InterviewPlanStarted({
        tenantId: this.tenantId,
        aggregateId: this.id,
        correlationId,
      }),
    );
  }

  /**
   * Complete the interview.
   * IN_PROGRESS → COMPLETED
   */
  complete(correlationId: Uuid): void {
    if (this.status !== 'IN_PROGRESS') {
      throw new ConflictError('Interview can only be completed from IN_PROGRESS state');
    }
    this.status = 'COMPLETED';
    this.bumpVersion();
    this.addDomainEvent(
      new InterviewPlanCompleted({
        tenantId: this.tenantId,
        aggregateId: this.id,
        correlationId,
      }),
    );
  }

  /**
   * Cancel the interview.
   * DRAFT → CANCELLED, SCHEDULED → CANCELLED, IN_PROGRESS → CANCELLED
   */
  cancel(correlationId: Uuid): void {
    if (this.status === 'COMPLETED' || this.status === 'CANCELLED') {
      throw new ConflictError('Cannot cancel interview in terminal state');
    }
    this.status = 'CANCELLED';
    this.bumpVersion();
    this.addDomainEvent(
      new InterviewPlanCancelled({
        tenantId: this.tenantId,
        aggregateId: this.id,
        correlationId,
      }),
    );
  }

  private bumpVersion(): void {
    this.incrementVersion();
    this.updatedAt = new Date();
  }
}
