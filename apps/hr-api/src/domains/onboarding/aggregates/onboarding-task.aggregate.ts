import { AggregateRoot, DomainEvent, Uuid, Guard, ConflictError } from '@hcm/shared-kernel';

/**
 * Canonical onboarding task status values.
 */
export type OnboardingTaskStatus = 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'OVERDUE' | 'SKIPPED';

/**
 * Properties required to construct or rehydrate an {@link OnboardingTask} aggregate.
 */
export interface OnboardingTaskProps {
  id: Uuid;
  tenantId: Uuid;
  onboardingPlanId: Uuid;
  title: string;
  description?: string;
  assignedTo?: Uuid;
  dueDate?: Date;
  completedAt?: Date;
  status?: OnboardingTaskStatus;
  aggregateVersion?: number;
  createdAt?: Date;
  updatedAt?: Date;
}

/* ------------------------------------------------------------------ */
/*  Domain Events                                                      */
/* ------------------------------------------------------------------ */

export class OnboardingTaskCreated extends DomainEvent {
  readonly onboardingPlanId: string;

  constructor(props: { tenantId: Uuid; aggregateId: Uuid; correlationId: Uuid; onboardingPlanId: Uuid }) {
    super({
      eventName: 'OnboardingTaskCreated',
      tenantId: props.tenantId,
      aggregateType: 'OnboardingTask',
      aggregateId: props.aggregateId,
      correlationId: props.correlationId,
    });
    this.onboardingPlanId = props.onboardingPlanId.value;
  }
}

export class OnboardingTaskStarted extends DomainEvent {
  constructor(props: { tenantId: Uuid; aggregateId: Uuid; correlationId: Uuid }) {
    super({
      eventName: 'OnboardingTaskStarted',
      tenantId: props.tenantId,
      aggregateType: 'OnboardingTask',
      aggregateId: props.aggregateId,
      correlationId: props.correlationId,
    });
  }
}

export class OnboardingTaskCompleted extends DomainEvent {
  constructor(props: { tenantId: Uuid; aggregateId: Uuid; correlationId: Uuid }) {
    super({
      eventName: 'OnboardingTaskCompleted',
      tenantId: props.tenantId,
      aggregateType: 'OnboardingTask',
      aggregateId: props.aggregateId,
      correlationId: props.correlationId,
    });
  }
}

export class OnboardingTaskOverdue extends DomainEvent {
  constructor(props: { tenantId: Uuid; aggregateId: Uuid; correlationId: Uuid }) {
    super({
      eventName: 'OnboardingTaskOverdue',
      tenantId: props.tenantId,
      aggregateType: 'OnboardingTask',
      aggregateId: props.aggregateId,
      correlationId: props.correlationId,
    });
  }
}

export class OnboardingTaskSkipped extends DomainEvent {
  constructor(props: { tenantId: Uuid; aggregateId: Uuid; correlationId: Uuid }) {
    super({
      eventName: 'OnboardingTaskSkipped',
      tenantId: props.tenantId,
      aggregateType: 'OnboardingTask',
      aggregateId: props.aggregateId,
      correlationId: props.correlationId,
    });
  }
}

/* ------------------------------------------------------------------ */
/*  Aggregate                                                          */
/* ------------------------------------------------------------------ */

/**
 * OnboardingTask aggregate root.
 *
 * Represents an individual task within an onboarding plan.
 * Lifecycle: PENDING → IN_PROGRESS → COMPLETED
 * Terminal states: OVERDUE, SKIPPED
 */
export class OnboardingTask extends AggregateRoot {
  private _aggregateVersion = 0;

  readonly tenantId: Uuid;
  onboardingPlanId: Uuid;
  title: string;
  description?: string;
  assignedTo?: Uuid;
  dueDate?: Date;
  completedAt?: Date;
  status: OnboardingTaskStatus;
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

  private constructor(props: OnboardingTaskProps) {
    super(props.id);
    this.tenantId = props.tenantId;
    this.onboardingPlanId = props.onboardingPlanId;
    this.title = props.title;
    this.description = props.description;
    this.assignedTo = props.assignedTo;
    this.dueDate = props.dueDate;
    this.completedAt = props.completedAt;
    this.status = props.status ?? 'PENDING';
    this.createdAt = props.createdAt ?? new Date();
    this.updatedAt = props.updatedAt ?? new Date();
    if (props.aggregateVersion !== undefined) {
      this._aggregateVersion = props.aggregateVersion;
    }
  }

  /**
   * Factory method to create a new OnboardingTask in PENDING state.
   */
  static create(props: OnboardingTaskProps, correlationId: Uuid): OnboardingTask {
    Guard.againstEmptyString(props.title, 'title');

    const task = new OnboardingTask({
      ...props,
      status: 'PENDING',
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    task.addDomainEvent(
      new OnboardingTaskCreated({
        tenantId: task.tenantId,
        aggregateId: task.id,
        correlationId,
        onboardingPlanId: task.onboardingPlanId,
      }),
    );

    return task;
  }

  /**
   * Start the task.
   * PENDING → IN_PROGRESS
   */
  start(correlationId: Uuid): void {
    if (this.status !== 'PENDING') {
      throw new ConflictError('Task can only be started from PENDING state');
    }
    this.status = 'IN_PROGRESS';
    this.bumpVersion();
    this.addDomainEvent(
      new OnboardingTaskStarted({
        tenantId: this.tenantId,
        aggregateId: this.id,
        correlationId,
      }),
    );
  }

  /**
   * Complete the task.
   * IN_PROGRESS → COMPLETED
   */
  complete(correlationId: Uuid): void {
    if (this.status !== 'IN_PROGRESS' && this.status !== 'PENDING') {
      throw new ConflictError('Task can only be completed from IN_PROGRESS or PENDING state');
    }
    this.status = 'COMPLETED';
    this.completedAt = new Date();
    this.bumpVersion();
    this.addDomainEvent(
      new OnboardingTaskCompleted({
        tenantId: this.tenantId,
        aggregateId: this.id,
        correlationId,
      }),
    );
  }

  /**
   * Mark the task as overdue.
   * PENDING → OVERDUE, IN_PROGRESS → OVERDUE
   */
  markOverdue(correlationId: Uuid): void {
    if (this.status !== 'PENDING' && this.status !== 'IN_PROGRESS') {
      throw new ConflictError('Task can only be marked overdue from PENDING or IN_PROGRESS state');
    }
    this.status = 'OVERDUE';
    this.bumpVersion();
    this.addDomainEvent(
      new OnboardingTaskOverdue({
        tenantId: this.tenantId,
        aggregateId: this.id,
        correlationId,
      }),
    );
  }

  /**
   * Skip the task.
   * Any non-terminal → SKIPPED (terminal)
   */
  skip(correlationId: Uuid): void {
    if (this.status === 'COMPLETED' || this.status === 'SKIPPED') {
      throw new ConflictError('Cannot skip task in terminal state');
    }
    this.status = 'SKIPPED';
    this.bumpVersion();
    this.addDomainEvent(
      new OnboardingTaskSkipped({
        tenantId: this.tenantId,
        aggregateId: this.id,
        correlationId,
      }),
    );
  }

  /**
   * Update mutable task attributes.
   */
  update(
    props: Partial<Pick<OnboardingTaskProps, 'title' | 'description' | 'assignedTo' | 'dueDate'>>,
    _correlationId: Uuid,
  ): void {
    if (this.status === 'COMPLETED' || this.status === 'SKIPPED') {
      throw new ConflictError('Cannot update task in terminal state');
    }
    if (props.title !== undefined) this.title = props.title;
    if (props.description !== undefined) this.description = props.description;
    if (props.assignedTo !== undefined) this.assignedTo = props.assignedTo;
    if (props.dueDate !== undefined) this.dueDate = props.dueDate;
    this.bumpVersion();
    this.updatedAt = new Date();
  }

  private bumpVersion(): void {
    this.incrementVersion();
    this.updatedAt = new Date();
  }
}
