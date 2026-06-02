import { AggregateRoot, DomainEvent, Uuid, ConflictError } from '@hcm/shared-kernel';

/**
 * Canonical onboarding plan status values.
 */
export type OnboardingPlanStatus = 'DRAFT' | 'SCHEDULED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';
export type PreboardingPortalStatus = 'NOT_INVITED' | 'INVITED' | 'ACTIVE' | 'COMPLETED';
export type ProbationPlanStatus = 'NOT_REQUIRED' | 'PENDING_REVIEW' | 'CONFIRMED' | 'EXTENDED' | 'TERMINATION_RECOMMENDED';

/**
 * Properties required to construct or rehydrate an {@link OnboardingPlan} aggregate.
 */
export interface OnboardingPlanProps {
  id: Uuid;
  tenantId: Uuid;
  workerId: Uuid;
  startDate: Date;
  assignedBuddyId?: Uuid;
  mentorId?: Uuid;
  roleTrack?: string;
  preboardingPortalStatus?: PreboardingPortalStatus;
  firstDayInstructions?: Record<string, unknown>;
  welcomeMessage?: string;
  probationReviewDate?: Date;
  probationStatus?: ProbationPlanStatus;
  status?: OnboardingPlanStatus;
  aggregateVersion?: number;
  createdAt?: Date;
  updatedAt?: Date;
}

/* ------------------------------------------------------------------ */
/*  Domain Events                                                      */
/* ------------------------------------------------------------------ */

export class OnboardingPlanCreated extends DomainEvent {
  readonly workerId: string;

  constructor(props: { tenantId: Uuid; aggregateId: Uuid; correlationId: Uuid; workerId: Uuid }) {
    super({
      eventName: 'OnboardingPlanCreated',
      tenantId: props.tenantId,
      aggregateType: 'OnboardingPlan',
      aggregateId: props.aggregateId,
      correlationId: props.correlationId,
    });
    this.workerId = props.workerId.value;
  }
}

export class OnboardingPlanScheduled extends DomainEvent {
  constructor(props: { tenantId: Uuid; aggregateId: Uuid; correlationId: Uuid }) {
    super({
      eventName: 'OnboardingPlanScheduled',
      tenantId: props.tenantId,
      aggregateType: 'OnboardingPlan',
      aggregateId: props.aggregateId,
      correlationId: props.correlationId,
    });
  }
}

export class OnboardingPlanStarted extends DomainEvent {
  constructor(props: { tenantId: Uuid; aggregateId: Uuid; correlationId: Uuid }) {
    super({
      eventName: 'OnboardingPlanStarted',
      tenantId: props.tenantId,
      aggregateType: 'OnboardingPlan',
      aggregateId: props.aggregateId,
      correlationId: props.correlationId,
    });
  }
}

export class OnboardingPlanCompleted extends DomainEvent {
  constructor(props: { tenantId: Uuid; aggregateId: Uuid; correlationId: Uuid }) {
    super({
      eventName: 'OnboardingPlanCompleted',
      tenantId: props.tenantId,
      aggregateType: 'OnboardingPlan',
      aggregateId: props.aggregateId,
      correlationId: props.correlationId,
    });
  }
}

export class OnboardingPlanCancelled extends DomainEvent {
  constructor(props: { tenantId: Uuid; aggregateId: Uuid; correlationId: Uuid }) {
    super({
      eventName: 'OnboardingPlanCancelled',
      tenantId: props.tenantId,
      aggregateType: 'OnboardingPlan',
      aggregateId: props.aggregateId,
      correlationId: props.correlationId,
    });
  }
}

/* ------------------------------------------------------------------ */
/*  Aggregate                                                          */
/* ------------------------------------------------------------------ */

/**
 * OnboardingPlan aggregate root.
 *
 * Represents the post-offer-acceptance onboarding journey for a worker.
 * Lifecycle: DRAFT → SCHEDULED → IN_PROGRESS → COMPLETED
 * Terminal state: CANCELLED
 */
export class OnboardingPlan extends AggregateRoot {
  private _aggregateVersion = 0;

  readonly tenantId: Uuid;
  workerId: Uuid;
  startDate: Date;
  assignedBuddyId?: Uuid;
  mentorId?: Uuid;
  roleTrack?: string;
  preboardingPortalStatus: PreboardingPortalStatus;
  firstDayInstructions?: Record<string, unknown>;
  welcomeMessage?: string;
  probationReviewDate?: Date;
  probationStatus: ProbationPlanStatus;
  status: OnboardingPlanStatus;
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

  private constructor(props: OnboardingPlanProps) {
    super(props.id);
    this.tenantId = props.tenantId;
    this.workerId = props.workerId;
    this.startDate = props.startDate;
    this.assignedBuddyId = props.assignedBuddyId;
    this.mentorId = props.mentorId;
    this.roleTrack = props.roleTrack;
    this.preboardingPortalStatus = props.preboardingPortalStatus ?? 'NOT_INVITED';
    this.firstDayInstructions = props.firstDayInstructions;
    this.welcomeMessage = props.welcomeMessage;
    this.probationReviewDate = props.probationReviewDate;
    this.probationStatus = props.probationStatus ?? 'NOT_REQUIRED';
    this.status = props.status ?? 'DRAFT';
    this.createdAt = props.createdAt ?? new Date();
    this.updatedAt = props.updatedAt ?? new Date();
    if (props.aggregateVersion !== undefined) {
      this._aggregateVersion = props.aggregateVersion;
    }
  }

  /**
   * Factory method to create a new OnboardingPlan in DRAFT state.
   * Triggered by the OfferToHireSaga after offer acceptance.
   */
  static create(props: OnboardingPlanProps, correlationId: Uuid): OnboardingPlan {
    const plan = new OnboardingPlan({
      ...props,
      status: 'DRAFT',
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    plan.addDomainEvent(
      new OnboardingPlanCreated({
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
  static restore(props: OnboardingPlanProps): OnboardingPlan {
    return new OnboardingPlan(props);
  }

  /**
   * Schedule the onboarding plan.
   * DRAFT → SCHEDULED
   */
  schedule(startDate: Date, correlationId: Uuid): void {
    if (this.status !== 'DRAFT') {
      throw new ConflictError('Onboarding plan can only be scheduled from DRAFT state');
    }
    this.status = 'SCHEDULED';
    this.startDate = startDate;
    this.bumpVersion();
    this.addDomainEvent(
      new OnboardingPlanScheduled({
        tenantId: this.tenantId,
        aggregateId: this.id,
        correlationId,
      }),
    );
  }

  /**
   * Start the onboarding plan.
   * SCHEDULED → IN_PROGRESS
   */
  start(correlationId: Uuid): void {
    if (this.status !== 'SCHEDULED') {
      throw new ConflictError('Onboarding plan can only be started from SCHEDULED state');
    }
    this.status = 'IN_PROGRESS';
    this.bumpVersion();
    this.addDomainEvent(
      new OnboardingPlanStarted({
        tenantId: this.tenantId,
        aggregateId: this.id,
        correlationId,
      }),
    );
  }

  /**
   * Complete the onboarding plan.
   * IN_PROGRESS → COMPLETED
   */
  complete(correlationId: Uuid): void {
    if (this.status !== 'IN_PROGRESS') {
      throw new ConflictError('Onboarding plan can only be completed from IN_PROGRESS state');
    }
    this.status = 'COMPLETED';
    this.bumpVersion();
    this.addDomainEvent(
      new OnboardingPlanCompleted({
        tenantId: this.tenantId,
        aggregateId: this.id,
        correlationId,
      }),
    );
  }

  /**
   * Cancel the onboarding plan.
   * Any non-terminal → CANCELLED (terminal)
   */
  cancel(correlationId: Uuid): void {
    if (this.status === 'COMPLETED' || this.status === 'CANCELLED') {
      throw new ConflictError('Cannot cancel onboarding plan in terminal state');
    }
    this.status = 'CANCELLED';
    this.bumpVersion();
    this.addDomainEvent(
      new OnboardingPlanCancelled({
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
