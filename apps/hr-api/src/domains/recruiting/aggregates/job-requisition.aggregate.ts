import { AggregateRoot, DomainEvent, Uuid, Guard, ConflictError } from '@hcm/shared-kernel';

/**
 * Canonical job requisition status values.
 */
export type JobRequisitionStatus =
  | 'DRAFT'
  | 'PENDING_APPROVAL'
  | 'APPROVED'
  | 'PUBLISHED'
  | 'OPEN'
  | 'FILLED'
  | 'CLOSED'
  | 'REJECTED';

/**
 * Properties required to construct or rehydrate a {@link JobRequisition} aggregate.
 */
export interface JobRequisitionProps {
  id: Uuid;
  tenantId: Uuid;
  requisitionNumber: string;
  positionId: Uuid;
  departmentId?: Uuid;
  hiringManagerId?: Uuid;
  recruiterId?: Uuid;
  title: string;
  description?: string;
  status?: JobRequisitionStatus;
  publishedAt?: Date;
  filledAt?: Date;
  closedAt?: Date;
  aggregateVersion?: number;
  createdAt?: Date;
  updatedAt?: Date;
}

/* ------------------------------------------------------------------ */
/*  Domain Events                                                      */
/* ------------------------------------------------------------------ */

export class JobRequisitionCreated extends DomainEvent {
  readonly requisitionNumber: string;
  readonly positionId: string;

  constructor(props: {
    tenantId: Uuid;
    aggregateId: Uuid;
    correlationId: Uuid;
    requisitionNumber: string;
    positionId: Uuid;
  }) {
    super({
      eventName: 'JobRequisitionCreated',
      tenantId: props.tenantId,
      aggregateType: 'JobRequisition',
      aggregateId: props.aggregateId,
      correlationId: props.correlationId,
    });
    this.requisitionNumber = props.requisitionNumber;
    this.positionId = props.positionId.value;
  }
}

export class JobRequisitionSubmitted extends DomainEvent {
  constructor(props: { tenantId: Uuid; aggregateId: Uuid; correlationId: Uuid }) {
    super({
      eventName: 'JobRequisitionSubmitted',
      tenantId: props.tenantId,
      aggregateType: 'JobRequisition',
      aggregateId: props.aggregateId,
      correlationId: props.correlationId,
    });
  }
}

export class JobRequisitionApproved extends DomainEvent {
  constructor(props: { tenantId: Uuid; aggregateId: Uuid; correlationId: Uuid }) {
    super({
      eventName: 'JobRequisitionApproved',
      tenantId: props.tenantId,
      aggregateType: 'JobRequisition',
      aggregateId: props.aggregateId,
      correlationId: props.correlationId,
    });
  }
}

export class JobRequisitionRejected extends DomainEvent {
  constructor(props: { tenantId: Uuid; aggregateId: Uuid; correlationId: Uuid }) {
    super({
      eventName: 'JobRequisitionRejected',
      tenantId: props.tenantId,
      aggregateType: 'JobRequisition',
      aggregateId: props.aggregateId,
      correlationId: props.correlationId,
    });
  }
}

export class JobRequisitionPublished extends DomainEvent {
  constructor(props: { tenantId: Uuid; aggregateId: Uuid; correlationId: Uuid }) {
    super({
      eventName: 'JobRequisitionPublished',
      tenantId: props.tenantId,
      aggregateType: 'JobRequisition',
      aggregateId: props.aggregateId,
      correlationId: props.correlationId,
    });
  }
}

export class JobRequisitionOpened extends DomainEvent {
  constructor(props: { tenantId: Uuid; aggregateId: Uuid; correlationId: Uuid }) {
    super({
      eventName: 'JobRequisitionOpened',
      tenantId: props.tenantId,
      aggregateType: 'JobRequisition',
      aggregateId: props.aggregateId,
      correlationId: props.correlationId,
    });
  }
}

export class JobRequisitionFilled extends DomainEvent {
  constructor(props: { tenantId: Uuid; aggregateId: Uuid; correlationId: Uuid }) {
    super({
      eventName: 'JobRequisitionFilled',
      tenantId: props.tenantId,
      aggregateType: 'JobRequisition',
      aggregateId: props.aggregateId,
      correlationId: props.correlationId,
    });
  }
}

export class JobRequisitionClosed extends DomainEvent {
  readonly reason: string;

  constructor(props: { tenantId: Uuid; aggregateId: Uuid; correlationId: Uuid; reason: string }) {
    super({
      eventName: 'JobRequisitionClosed',
      tenantId: props.tenantId,
      aggregateType: 'JobRequisition',
      aggregateId: props.aggregateId,
      correlationId: props.correlationId,
    });
    this.reason = props.reason;
  }
}

/* ------------------------------------------------------------------ */
/*  Aggregate                                                          */
/* ------------------------------------------------------------------ */

/**
 * JobRequisition aggregate root.
 *
 * Represents a hiring request tied to a position. Lifecycle:
 * DRAFT → PENDING_APPROVAL → APPROVED → PUBLISHED → OPEN → FILLED → CLOSED
 * Terminal states: CLOSED, REJECTED
 */
export class JobRequisition extends AggregateRoot {
  private _aggregateVersion = 0;

  readonly tenantId: Uuid;
  requisitionNumber: string;
  positionId: Uuid;
  departmentId?: Uuid;
  hiringManagerId?: Uuid;
  recruiterId?: Uuid;
  title: string;
  description?: string;
  status: JobRequisitionStatus;
  publishedAt?: Date;
  filledAt?: Date;
  closedAt?: Date;
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

  private constructor(props: JobRequisitionProps) {
    super(props.id);
    this.tenantId = props.tenantId;
    this.requisitionNumber = props.requisitionNumber;
    this.positionId = props.positionId;
    this.departmentId = props.departmentId;
    this.hiringManagerId = props.hiringManagerId;
    this.recruiterId = props.recruiterId;
    this.title = props.title;
    this.description = props.description;
    this.status = props.status ?? 'DRAFT';
    this.publishedAt = props.publishedAt;
    this.filledAt = props.filledAt;
    this.closedAt = props.closedAt;
    this.createdAt = props.createdAt ?? new Date();
    this.updatedAt = props.updatedAt ?? new Date();
    if (props.aggregateVersion !== undefined) {
      this._aggregateVersion = props.aggregateVersion;
    }
  }

  /**
   * Factory method to create a new JobRequisition in DRAFT state.
   */
  static create(props: JobRequisitionProps, correlationId: Uuid): JobRequisition {
    Guard.againstEmptyString(props.title, 'title');
    Guard.againstEmptyString(props.requisitionNumber, 'requisitionNumber');

    const requisition = new JobRequisition({
      ...props,
      status: 'DRAFT',
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    requisition.addDomainEvent(
      new JobRequisitionCreated({
        tenantId: requisition.tenantId,
        aggregateId: requisition.id,
        correlationId,
        requisitionNumber: requisition.requisitionNumber,
        positionId: requisition.positionId,
      }),
    );

    return requisition;
  }

  /**
   * Submit the requisition for approval.
   * DRAFT → PENDING_APPROVAL
   */
  submitForApproval(correlationId: Uuid): void {
    if (this.status !== 'DRAFT') {
      throw new ConflictError('Requisition can only be submitted from DRAFT state');
    }
    this.status = 'PENDING_APPROVAL';
    this.bumpVersion();
    this.addDomainEvent(
      new JobRequisitionSubmitted({
        tenantId: this.tenantId,
        aggregateId: this.id,
        correlationId,
      }),
    );
  }

  /**
   * Approve the requisition.
   * PENDING_APPROVAL → APPROVED
   */
  approve(correlationId: Uuid): void {
    if (this.status !== 'PENDING_APPROVAL') {
      throw new ConflictError('Requisition can only be approved from PENDING_APPROVAL state');
    }
    this.status = 'APPROVED';
    this.bumpVersion();
    this.addDomainEvent(
      new JobRequisitionApproved({
        tenantId: this.tenantId,
        aggregateId: this.id,
        correlationId,
      }),
    );
  }

  /**
   * Reject the requisition.
   * PENDING_APPROVAL → REJECTED (terminal)
   */
  reject(correlationId: Uuid): void {
    if (this.status !== 'PENDING_APPROVAL') {
      throw new ConflictError('Requisition can only be rejected from PENDING_APPROVAL state');
    }
    this.status = 'REJECTED';
    this.bumpVersion();
    this.addDomainEvent(
      new JobRequisitionRejected({
        tenantId: this.tenantId,
        aggregateId: this.id,
        correlationId,
      }),
    );
  }

  /**
   * Publish the requisition to job boards.
   * APPROVED → PUBLISHED
   */
  publish(correlationId: Uuid): void {
    if (this.status !== 'APPROVED') {
      throw new ConflictError('Requisition can only be published from APPROVED state');
    }
    this.status = 'PUBLISHED';
    this.publishedAt = new Date();
    this.bumpVersion();
    this.addDomainEvent(
      new JobRequisitionPublished({
        tenantId: this.tenantId,
        aggregateId: this.id,
        correlationId,
      }),
    );
  }

  /**
   * Open the requisition for applications.
   * PUBLISHED → OPEN
   */
  open(correlationId: Uuid): void {
    if (this.status !== 'PUBLISHED') {
      throw new ConflictError('Requisition can only be opened from PUBLISHED state');
    }
    this.status = 'OPEN';
    this.bumpVersion();
    this.addDomainEvent(
      new JobRequisitionOpened({
        tenantId: this.tenantId,
        aggregateId: this.id,
        correlationId,
      }),
    );
  }

  /**
   * Mark the requisition as filled.
   * OPEN → FILLED
   */
  fill(correlationId: Uuid): void {
    if (this.status !== 'OPEN') {
      throw new ConflictError('Requisition can only be filled from OPEN state');
    }
    this.status = 'FILLED';
    this.filledAt = new Date();
    this.bumpVersion();
    this.addDomainEvent(
      new JobRequisitionFilled({
        tenantId: this.tenantId,
        aggregateId: this.id,
        correlationId,
      }),
    );
  }

  /**
   * Close the requisition.
   * FILLED → CLOSED (terminal), OPEN → CLOSED (terminal)
   */
  close(reason: string, correlationId: Uuid): void {
    if (this.status === 'CLOSED' || this.status === 'REJECTED') {
      throw new ConflictError('Requisition is already in a terminal state');
    }
    this.status = 'CLOSED';
    this.closedAt = new Date();
    this.bumpVersion();
    this.addDomainEvent(
      new JobRequisitionClosed({
        tenantId: this.tenantId,
        aggregateId: this.id,
        correlationId,
        reason,
      }),
    );
  }

  /**
   * Update mutable requisition attributes.
   */
  update(
    props: Partial<Pick<JobRequisitionProps, 'title' | 'description' | 'recruiterId' | 'hiringManagerId'>>,
    _correlationId: Uuid,
  ): void {
    if (this.status === 'CLOSED' || this.status === 'REJECTED' || this.status === 'FILLED') {
      throw new ConflictError('Cannot update requisition in terminal state');
    }
    if (props.title !== undefined) this.title = props.title;
    if (props.description !== undefined) this.description = props.description;
    if (props.recruiterId !== undefined) this.recruiterId = props.recruiterId;
    if (props.hiringManagerId !== undefined) this.hiringManagerId = props.hiringManagerId;
    this.bumpVersion();
    this.updatedAt = new Date();
  }

  private bumpVersion(): void {
    this.incrementVersion();
    this.updatedAt = new Date();
  }
}
