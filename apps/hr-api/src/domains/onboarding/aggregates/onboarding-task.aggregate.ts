import { AggregateRoot, DomainEvent, Uuid, Guard, ConflictError } from '@hcm/shared-kernel';

/**
 * Canonical onboarding task status values.
 */
export type OnboardingTaskStatus = 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'OVERDUE' | 'SKIPPED';
export type OnboardingTaskOwnerGroup = 'HR' | 'IT' | 'FINANCE' | 'ADMIN' | 'MANAGER' | 'SECURITY' | 'FACILITIES' | 'EMPLOYEE' | 'BUDDY' | 'COMPLIANCE';
export type OnboardingTaskCategory =
  | 'PREBOARDING'
  | 'DOCUMENT'
  | 'SIGNATURE'
  | 'IT_PROVISIONING'
  | 'FACILITY_ACCESS'
  | 'FINANCE_SETUP'
  | 'MANAGER_CHECKIN'
  | 'TRAINING'
  | 'COMPLIANCE'
  | 'MILESTONE_30'
  | 'MILESTONE_60'
  | 'MILESTONE_90'
  | 'PROBATION';

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
  ownerGroup?: OnboardingTaskOwnerGroup;
  category?: OnboardingTaskCategory;
  required?: boolean;
  evidenceType?: string;
  evidencePayload?: Record<string, unknown>;
  provisioningTarget?: string;
  signingProviderEnvelopeId?: string;
  milestoneDay?: number;
  completionNotes?: string;
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

export class OnboardingTaskEvidenceRecorded extends DomainEvent {
  constructor(props: { tenantId: Uuid; aggregateId: Uuid; correlationId: Uuid }) {
    super({
      eventName: 'OnboardingTaskEvidenceRecorded',
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
  ownerGroup: OnboardingTaskOwnerGroup;
  category: OnboardingTaskCategory;
  required: boolean;
  evidenceType?: string;
  evidencePayload?: Record<string, unknown>;
  provisioningTarget?: string;
  signingProviderEnvelopeId?: string;
  milestoneDay?: number;
  completionNotes?: string;
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
    this.ownerGroup = props.ownerGroup ?? 'HR';
    this.category = props.category ?? 'PREBOARDING';
    this.required = props.required ?? true;
    this.evidenceType = props.evidenceType;
    this.evidencePayload = props.evidencePayload;
    this.provisioningTarget = props.provisioningTarget;
    this.signingProviderEnvelopeId = props.signingProviderEnvelopeId;
    this.milestoneDay = props.milestoneDay;
    this.completionNotes = props.completionNotes;
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
   * Rehydrate an existing task without emitting creation events.
   */
  static restore(props: OnboardingTaskProps): OnboardingTask {
    return new OnboardingTask(props);
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
   * Attach structured evidence to the task. Used for document upload,
   * signature envelopes, IT provisioning tickets, compliance proof, and
   * probation/manager checkpoint notes.
   */
  recordEvidence(
    props: {
      evidenceType?: string;
      evidencePayload?: Record<string, unknown>;
      signingProviderEnvelopeId?: string;
      provisioningTarget?: string;
      completionNotes?: string;
      completeTask?: boolean;
    },
    correlationId: Uuid,
  ): void {
    if (this.status === 'SKIPPED' || this.status === 'COMPLETED') {
      throw new ConflictError('Cannot record evidence for a terminal onboarding task');
    }
    if (props.evidenceType !== undefined) this.evidenceType = props.evidenceType;
    if (props.evidencePayload !== undefined) this.evidencePayload = props.evidencePayload;
    if (props.signingProviderEnvelopeId !== undefined) this.signingProviderEnvelopeId = props.signingProviderEnvelopeId;
    if (props.provisioningTarget !== undefined) this.provisioningTarget = props.provisioningTarget;
    if (props.completionNotes !== undefined) this.completionNotes = props.completionNotes;
    this.bumpVersion();
    this.addDomainEvent(
      new OnboardingTaskEvidenceRecorded({
        tenantId: this.tenantId,
        aggregateId: this.id,
        correlationId,
      }),
    );
    if (props.completeTask) {
      this.complete(correlationId);
    }
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
    props: Partial<Pick<OnboardingTaskProps, 'title' | 'description' | 'assignedTo' | 'dueDate' | 'ownerGroup' | 'category' | 'required'>>,
    _correlationId: Uuid,
  ): void {
    if (this.status === 'COMPLETED' || this.status === 'SKIPPED') {
      throw new ConflictError('Cannot update task in terminal state');
    }
    if (props.title !== undefined) this.title = props.title;
    if (props.description !== undefined) this.description = props.description;
    if (props.assignedTo !== undefined) this.assignedTo = props.assignedTo;
    if (props.dueDate !== undefined) this.dueDate = props.dueDate;
    if (props.ownerGroup !== undefined) this.ownerGroup = props.ownerGroup;
    if (props.category !== undefined) this.category = props.category;
    if (props.required !== undefined) this.required = props.required;
    this.bumpVersion();
    this.updatedAt = new Date();
  }

  private bumpVersion(): void {
    this.incrementVersion();
    this.updatedAt = new Date();
  }
}
