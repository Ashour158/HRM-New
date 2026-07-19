import { AggregateRoot, DomainEvent, Uuid, Guard, ConflictError } from '@hcm/shared-kernel';

/**
 * Canonical offboarding task status values.
 */
export type OffboardingTaskStatus = 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'OVERDUE' | 'SKIPPED';

/**
 * Groups that own individual exit tasks. Mirrors onboarding's ownerGroup
 * concept, scoped to the groups involved in an exit.
 */
export type OffboardingTaskOwnerGroup = 'HR' | 'IT' | 'FINANCE' | 'MANAGER' | 'SECURITY' | 'FACILITIES' | 'EMPLOYEE';

export type OffboardingTaskCategory =
  | 'EXIT_CHECKLIST'
  | 'KNOWLEDGE_TRANSFER'
  | 'ASSET_RETURN'
  | 'ACCESS_REVOCATION_CONFIRMATION'
  | 'FINAL_SETTLEMENT_CONFIRMATION'
  | 'EXIT_INTERVIEW'
  | 'DOCUMENT'
  | 'COMPLIANCE';

/**
 * Properties required to construct or rehydrate an {@link OffboardingTask} aggregate.
 */
export interface OffboardingTaskProps {
  id: Uuid;
  tenantId: Uuid;
  offboardingPlanId: Uuid;
  title: string;
  description?: string;
  assignedTo?: Uuid;
  ownerGroup?: OffboardingTaskOwnerGroup;
  category?: OffboardingTaskCategory;
  required?: boolean;
  evidenceType?: string;
  evidencePayload?: Record<string, unknown>;
  completionNotes?: string;
  dueDate?: Date;
  completedAt?: Date;
  status?: OffboardingTaskStatus;
  aggregateVersion?: number;
  createdAt?: Date;
  updatedAt?: Date;
}

/* ------------------------------------------------------------------ */
/*  Domain Events                                                      */
/* ------------------------------------------------------------------ */

export class OffboardingTaskCreated extends DomainEvent {
  readonly offboardingPlanId: string;

  constructor(props: { tenantId: Uuid; aggregateId: Uuid; correlationId: Uuid; offboardingPlanId: Uuid }) {
    super({
      eventName: 'OffboardingTaskCreated',
      tenantId: props.tenantId,
      aggregateType: 'OffboardingTask',
      aggregateId: props.aggregateId,
      correlationId: props.correlationId,
    });
    this.offboardingPlanId = props.offboardingPlanId.value;
  }
}

export class OffboardingTaskStarted extends DomainEvent {
  constructor(props: { tenantId: Uuid; aggregateId: Uuid; correlationId: Uuid }) {
    super({
      eventName: 'OffboardingTaskStarted',
      tenantId: props.tenantId,
      aggregateType: 'OffboardingTask',
      aggregateId: props.aggregateId,
      correlationId: props.correlationId,
    });
  }
}

export class OffboardingTaskCompleted extends DomainEvent {
  constructor(props: { tenantId: Uuid; aggregateId: Uuid; correlationId: Uuid }) {
    super({
      eventName: 'OffboardingTaskCompleted',
      tenantId: props.tenantId,
      aggregateType: 'OffboardingTask',
      aggregateId: props.aggregateId,
      correlationId: props.correlationId,
    });
  }
}

export class OffboardingTaskEvidenceRecorded extends DomainEvent {
  constructor(props: { tenantId: Uuid; aggregateId: Uuid; correlationId: Uuid }) {
    super({
      eventName: 'OffboardingTaskEvidenceRecorded',
      tenantId: props.tenantId,
      aggregateType: 'OffboardingTask',
      aggregateId: props.aggregateId,
      correlationId: props.correlationId,
    });
  }
}

export class OffboardingTaskOverdue extends DomainEvent {
  constructor(props: { tenantId: Uuid; aggregateId: Uuid; correlationId: Uuid }) {
    super({
      eventName: 'OffboardingTaskOverdue',
      tenantId: props.tenantId,
      aggregateType: 'OffboardingTask',
      aggregateId: props.aggregateId,
      correlationId: props.correlationId,
    });
  }
}

export class OffboardingTaskSkipped extends DomainEvent {
  constructor(props: { tenantId: Uuid; aggregateId: Uuid; correlationId: Uuid }) {
    super({
      eventName: 'OffboardingTaskSkipped',
      tenantId: props.tenantId,
      aggregateType: 'OffboardingTask',
      aggregateId: props.aggregateId,
      correlationId: props.correlationId,
    });
  }
}

/* ------------------------------------------------------------------ */
/*  Aggregate                                                          */
/* ------------------------------------------------------------------ */

/**
 * OffboardingTask aggregate root.
 *
 * Represents an individual exit task within an offboarding plan: exit
 * interview, knowledge transfer, asset return, access revocation
 * confirmation, final settlement confirmation, and similar checklist items.
 *
 * Lifecycle: PENDING -> IN_PROGRESS -> COMPLETED
 * Terminal states: OVERDUE, SKIPPED
 */
export class OffboardingTask extends AggregateRoot {
  private _aggregateVersion = 0;

  readonly tenantId: Uuid;
  offboardingPlanId: Uuid;
  title: string;
  description?: string;
  assignedTo?: Uuid;
  ownerGroup: OffboardingTaskOwnerGroup;
  category: OffboardingTaskCategory;
  required: boolean;
  evidenceType?: string;
  evidencePayload?: Record<string, unknown>;
  completionNotes?: string;
  dueDate?: Date;
  completedAt?: Date;
  status: OffboardingTaskStatus;
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

  private constructor(props: OffboardingTaskProps) {
    super(props.id);
    this.tenantId = props.tenantId;
    this.offboardingPlanId = props.offboardingPlanId;
    this.title = props.title;
    this.description = props.description;
    this.assignedTo = props.assignedTo;
    this.ownerGroup = props.ownerGroup ?? 'HR';
    this.category = props.category ?? 'EXIT_CHECKLIST';
    this.required = props.required ?? true;
    this.evidenceType = props.evidenceType;
    this.evidencePayload = props.evidencePayload;
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
   * Factory method to create a new OffboardingTask in PENDING state.
   */
  static create(props: OffboardingTaskProps, correlationId: Uuid): OffboardingTask {
    Guard.againstEmptyString(props.title, 'title');

    const task = new OffboardingTask({
      ...props,
      status: 'PENDING',
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    task.addDomainEvent(
      new OffboardingTaskCreated({
        tenantId: task.tenantId,
        aggregateId: task.id,
        correlationId,
        offboardingPlanId: task.offboardingPlanId,
      }),
    );

    return task;
  }

  /**
   * Rehydrate an existing task without emitting creation events.
   */
  static restore(props: OffboardingTaskProps): OffboardingTask {
    return new OffboardingTask(props);
  }

  /**
   * Start the task.
   * PENDING -> IN_PROGRESS
   */
  start(correlationId: Uuid): void {
    if (this.status !== 'PENDING') {
      throw new ConflictError('Task can only be started from PENDING state');
    }
    this.status = 'IN_PROGRESS';
    this.bumpVersion();
    this.addDomainEvent(
      new OffboardingTaskStarted({
        tenantId: this.tenantId,
        aggregateId: this.id,
        correlationId,
      }),
    );
  }

  /**
   * Complete the task.
   * IN_PROGRESS -> COMPLETED, PENDING -> COMPLETED
   */
  complete(correlationId: Uuid): void {
    if (this.status !== 'IN_PROGRESS' && this.status !== 'PENDING') {
      throw new ConflictError('Task can only be completed from IN_PROGRESS or PENDING state');
    }
    this.status = 'COMPLETED';
    this.completedAt = new Date();
    this.bumpVersion();
    this.addDomainEvent(
      new OffboardingTaskCompleted({
        tenantId: this.tenantId,
        aggregateId: this.id,
        correlationId,
      }),
    );
  }

  /**
   * Attach evidence/notes to the task, e.g. what asset was returned, the
   * final settlement confirmation reference, or exit interview notes.
   * Optionally completes the task in the same call.
   */
  recordEvidence(
    props: {
      evidenceType?: string;
      evidencePayload?: Record<string, unknown>;
      completionNotes?: string;
      completeTask?: boolean;
    },
    correlationId: Uuid,
  ): void {
    if (this.status === 'SKIPPED' || this.status === 'COMPLETED') {
      throw new ConflictError('Cannot record evidence for a terminal offboarding task');
    }
    if (props.evidenceType !== undefined) this.evidenceType = props.evidenceType;
    if (props.evidencePayload !== undefined) this.evidencePayload = props.evidencePayload;
    if (props.completionNotes !== undefined) this.completionNotes = props.completionNotes;
    this.bumpVersion();
    this.addDomainEvent(
      new OffboardingTaskEvidenceRecorded({
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
   * PENDING -> OVERDUE, IN_PROGRESS -> OVERDUE
   */
  markOverdue(correlationId: Uuid): void {
    if (this.status !== 'PENDING' && this.status !== 'IN_PROGRESS') {
      throw new ConflictError('Task can only be marked overdue from PENDING or IN_PROGRESS state');
    }
    this.status = 'OVERDUE';
    this.bumpVersion();
    this.addDomainEvent(
      new OffboardingTaskOverdue({
        tenantId: this.tenantId,
        aggregateId: this.id,
        correlationId,
      }),
    );
  }

  /**
   * Skip the task.
   * Any non-terminal -> SKIPPED (terminal)
   */
  skip(correlationId: Uuid): void {
    if (this.status === 'COMPLETED' || this.status === 'SKIPPED') {
      throw new ConflictError('Cannot skip task in terminal state');
    }
    this.status = 'SKIPPED';
    this.bumpVersion();
    this.addDomainEvent(
      new OffboardingTaskSkipped({
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
    props: Partial<Pick<OffboardingTaskProps, 'title' | 'description' | 'assignedTo' | 'dueDate' | 'ownerGroup' | 'category' | 'required'>>,
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
