import { AggregateRoot, DomainEvent, Uuid, ConflictError, Guard } from '@hcm/shared-kernel';

/**
 * Canonical offboarding plan status values.
 */
export type OffboardingPlanStatus = 'DRAFT' | 'ACTIVE' | 'COMPLETED' | 'CANCELLED';

/**
 * Categorized reason the offboarding was initiated. Kept separate from the
 * free-text termination reason captured on the WorkerProfile aggregate so
 * exit reporting can be sliced without parsing prose.
 */
export type OffboardingReasonCategory =
  | 'RESIGNATION'
  | 'INVOLUNTARY_TERMINATION'
  | 'LAYOFF_REDUNDANCY'
  | 'RETIREMENT'
  | 'END_OF_CONTRACT'
  | 'MUTUAL_AGREEMENT'
  | 'OTHER';

/**
 * Properties required to construct or rehydrate an {@link OffboardingPlan} aggregate.
 */
export interface OffboardingPlanProps {
  id: Uuid;
  tenantId: Uuid;
  workerId: Uuid;
  lastWorkingDay: Date;
  initiatedBy: Uuid;
  reasonCategory?: OffboardingReasonCategory;
  reasonNotes?: string;
  managerId?: Uuid;
  status?: OffboardingPlanStatus;
  aggregateVersion?: number;
  createdAt?: Date;
  updatedAt?: Date;
}

/* ------------------------------------------------------------------ */
/*  Domain Events                                                      */
/* ------------------------------------------------------------------ */

export class OffboardingPlanCreated extends DomainEvent {
  readonly workerId: string;

  constructor(props: { tenantId: Uuid; aggregateId: Uuid; correlationId: Uuid; workerId: Uuid }) {
    super({
      eventName: 'OffboardingPlanCreated',
      tenantId: props.tenantId,
      aggregateType: 'OffboardingPlan',
      aggregateId: props.aggregateId,
      correlationId: props.correlationId,
    });
    this.workerId = props.workerId.value;
  }
}

export class OffboardingPlanStarted extends DomainEvent {
  constructor(props: { tenantId: Uuid; aggregateId: Uuid; correlationId: Uuid }) {
    super({
      eventName: 'OffboardingPlanStarted',
      tenantId: props.tenantId,
      aggregateType: 'OffboardingPlan',
      aggregateId: props.aggregateId,
      correlationId: props.correlationId,
    });
  }
}

export class OffboardingPlanCompleted extends DomainEvent {
  constructor(props: { tenantId: Uuid; aggregateId: Uuid; correlationId: Uuid }) {
    super({
      eventName: 'OffboardingPlanCompleted',
      tenantId: props.tenantId,
      aggregateType: 'OffboardingPlan',
      aggregateId: props.aggregateId,
      correlationId: props.correlationId,
    });
  }
}

export class OffboardingPlanCancelled extends DomainEvent {
  constructor(props: { tenantId: Uuid; aggregateId: Uuid; correlationId: Uuid }) {
    super({
      eventName: 'OffboardingPlanCancelled',
      tenantId: props.tenantId,
      aggregateType: 'OffboardingPlan',
      aggregateId: props.aggregateId,
      correlationId: props.correlationId,
    });
  }
}

/* ------------------------------------------------------------------ */
/*  Aggregate                                                          */
/* ------------------------------------------------------------------ */

/**
 * OffboardingPlan aggregate root.
 *
 * Represents the exit journey for a departing worker: last working day,
 * who initiated the exit, why, and the tracked checklist of tasks (asset
 * return, knowledge transfer, access revocation confirmation, final
 * settlement confirmation, exit interview, ...) required before the exit
 * is considered complete.
 *
 * Lifecycle: DRAFT -> ACTIVE -> COMPLETED
 * Terminal state: CANCELLED
 */
export class OffboardingPlan extends AggregateRoot {
  private _aggregateVersion = 0;

  readonly tenantId: Uuid;
  workerId: Uuid;
  lastWorkingDay: Date;
  initiatedBy: Uuid;
  reasonCategory: OffboardingReasonCategory;
  reasonNotes?: string;
  managerId?: Uuid;
  status: OffboardingPlanStatus;
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

  private constructor(props: OffboardingPlanProps) {
    super(props.id);
    this.tenantId = props.tenantId;
    this.workerId = props.workerId;
    this.lastWorkingDay = props.lastWorkingDay;
    this.initiatedBy = props.initiatedBy;
    this.reasonCategory = props.reasonCategory ?? 'OTHER';
    this.reasonNotes = props.reasonNotes;
    this.managerId = props.managerId;
    this.status = props.status ?? 'DRAFT';
    this.createdAt = props.createdAt ?? new Date();
    this.updatedAt = props.updatedAt ?? new Date();
    if (props.aggregateVersion !== undefined) {
      this._aggregateVersion = props.aggregateVersion;
    }
  }

  /**
   * Factory method to create a new OffboardingPlan in DRAFT state.
   * Triggered either by an explicit InitiateOffboarding-style admin action
   * or automatically by the OffboardingInitiationSaga reacting to
   * WorkerTerminated.
   */
  static create(props: OffboardingPlanProps, correlationId: Uuid): OffboardingPlan {
    Guard.againstNullOrUndefined(props.workerId, 'workerId');
    Guard.againstNullOrUndefined(props.initiatedBy, 'initiatedBy');

    const plan = new OffboardingPlan({
      ...props,
      status: 'DRAFT',
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    plan.addDomainEvent(
      new OffboardingPlanCreated({
        tenantId: plan.tenantId,
        aggregateId: plan.id,
        correlationId,
        workerId: plan.workerId,
      }),
    );

    return plan;
  }

  /**
   * Rehydrate an existing plan without emitting creation events.
   */
  static restore(props: OffboardingPlanProps): OffboardingPlan {
    return new OffboardingPlan(props);
  }

  /**
   * Start the offboarding plan, signalling that exit tasks are now
   * actively being worked by HR/IT/Finance/Manager/Security/Facilities.
   * DRAFT -> ACTIVE
   */
  start(correlationId: Uuid): void {
    if (this.status !== 'DRAFT') {
      throw new ConflictError('Offboarding plan can only be started from DRAFT state');
    }
    this.status = 'ACTIVE';
    this.bumpVersion();
    this.addDomainEvent(
      new OffboardingPlanStarted({
        tenantId: this.tenantId,
        aggregateId: this.id,
        correlationId,
      }),
    );
  }

  /**
   * Complete the offboarding plan once all required exit tasks are closed.
   * ACTIVE -> COMPLETED
   */
  complete(correlationId: Uuid): void {
    if (this.status !== 'ACTIVE') {
      throw new ConflictError('Offboarding plan can only be completed from ACTIVE state');
    }
    this.status = 'COMPLETED';
    this.bumpVersion();
    this.addDomainEvent(
      new OffboardingPlanCompleted({
        tenantId: this.tenantId,
        aggregateId: this.id,
        correlationId,
      }),
    );
  }

  /**
   * Cancel the offboarding plan (e.g. the termination was rescinded).
   * Any non-terminal -> CANCELLED (terminal)
   */
  cancel(correlationId: Uuid): void {
    if (this.status === 'COMPLETED' || this.status === 'CANCELLED') {
      throw new ConflictError('Cannot cancel offboarding plan in terminal state');
    }
    this.status = 'CANCELLED';
    this.bumpVersion();
    this.addDomainEvent(
      new OffboardingPlanCancelled({
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
