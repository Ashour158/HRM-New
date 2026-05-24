import { AggregateRoot, DomainEvent, Uuid, ValidationError } from '@hcm/shared-kernel';

export type JobAssignmentState = 'DRAFT' | 'ACTIVE' | 'ENDED';

export interface JobAssignmentProps {
  id: Uuid;
  tenantId: Uuid;
  workerId: Uuid;
  positionId?: Uuid;
  departmentId?: Uuid;
  managerId?: Uuid;
  jobTitle?: string;
  startDate: Date;
  endDate?: Date;
  assignmentType: string;
  state: JobAssignmentState;
  aggregateVersion?: number;
  createdAt?: Date;
  updatedAt?: Date;
}

/* ------------------------------------------------------------------ */
/*  Domain Events                                                      */
/* ------------------------------------------------------------------ */

export class JobAssignmentCreated extends DomainEvent {
  readonly workerId: string;
  readonly positionId?: string;

  constructor(props: { tenantId: Uuid; aggregateId: Uuid; correlationId: Uuid; workerId: Uuid; positionId?: Uuid }) {
    super({
      eventName: 'JobAssignmentCreated',
      tenantId: props.tenantId,
      aggregateType: 'JobAssignment',
      aggregateId: props.aggregateId,
      correlationId: props.correlationId,
    });
    this.workerId = props.workerId.value;
    this.positionId = props.positionId?.value;
  }
}

export class JobAssignmentActivated extends DomainEvent {
  constructor(props: { tenantId: Uuid; aggregateId: Uuid; correlationId: Uuid }) {
    super({
      eventName: 'JobAssignmentActivated',
      tenantId: props.tenantId,
      aggregateType: 'JobAssignment',
      aggregateId: props.aggregateId,
      correlationId: props.correlationId,
    });
  }
}

export class JobAssignmentEnded extends DomainEvent {
  readonly endDate: Date;

  constructor(props: { tenantId: Uuid; aggregateId: Uuid; correlationId: Uuid; endDate: Date }) {
    super({
      eventName: 'JobAssignmentEnded',
      tenantId: props.tenantId,
      aggregateType: 'JobAssignment',
      aggregateId: props.aggregateId,
      correlationId: props.correlationId,
    });
    this.endDate = props.endDate;
  }
}

export class JobAssignmentUpdated extends DomainEvent {
  readonly jobTitle?: string;
  readonly departmentId?: string;
  readonly managerId?: string;

  constructor(props: {
    tenantId: Uuid;
    aggregateId: Uuid;
    correlationId: Uuid;
    jobTitle?: string;
    departmentId?: string;
    managerId?: string;
  }) {
    super({
      eventName: 'JobAssignmentUpdated',
      tenantId: props.tenantId,
      aggregateType: 'JobAssignment',
      aggregateId: props.aggregateId,
      correlationId: props.correlationId,
    });
    this.jobTitle = props.jobTitle;
    this.departmentId = props.departmentId;
    this.managerId = props.managerId;
  }
}

/* ------------------------------------------------------------------ */
/*  Aggregate                                                          */
/* ------------------------------------------------------------------ */

/**
 * Represents a job assignment for a worker.
 */
export class JobAssignment extends AggregateRoot {
  private _aggregateVersion = 0;

  readonly tenantId: Uuid;
  readonly workerId: Uuid;
  positionId?: Uuid;
  departmentId?: Uuid;
  managerId?: Uuid;
  jobTitle?: string;
  startDate: Date;
  endDate?: Date;
  assignmentType: string;
  state: JobAssignmentState;
  createdAt: Date;
  updatedAt: Date;

  get version(): number {
    return this._aggregateVersion;
  }

  get aggregateVersion(): number {
    return this._aggregateVersion;
  }

  incrementVersion(): void {
    this._aggregateVersion++;
  }

  constructor(props: JobAssignmentProps) {
    super(props.id);
    this.tenantId = props.tenantId;
    this.workerId = props.workerId;
    this.positionId = props.positionId;
    this.departmentId = props.departmentId;
    this.managerId = props.managerId;
    this.jobTitle = props.jobTitle;
    this.startDate = props.startDate;
    this.endDate = props.endDate;
    this.assignmentType = props.assignmentType;
    this.state = props.state;
    this.createdAt = props.createdAt ?? new Date();
    this.updatedAt = props.updatedAt ?? new Date();
    if (props.aggregateVersion !== undefined) {
      this._aggregateVersion = props.aggregateVersion;
    }
  }

  static create(props: JobAssignmentProps, correlationId: Uuid): JobAssignment {
    const assignment = new JobAssignment({
      ...props,
      state: 'DRAFT',
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    assignment.addDomainEvent(
      new JobAssignmentCreated({
        tenantId: assignment.tenantId,
        aggregateId: assignment.id,
        correlationId,
        workerId: assignment.workerId,
        positionId: assignment.positionId,
      }),
    );

    return assignment;
  }

  activate(correlationId: Uuid): void {
    if (this.state !== 'DRAFT') {
      throw new ValidationError(`Cannot activate job assignment from state ${this.state}`);
    }
    this.state = 'ACTIVE';
    this.addDomainEvent(
      new JobAssignmentActivated({ tenantId: this.tenantId, aggregateId: this.id, correlationId }),
    );
    this.incrementVersion();
    this.updatedAt = new Date();
  }

  end(endDate: Date, correlationId: Uuid): void {
    if (this.state === 'ENDED') {
      throw new ValidationError('Job assignment is already ended');
    }
    this.state = 'ENDED';
    this.endDate = endDate;
    this.addDomainEvent(
      new JobAssignmentEnded({ tenantId: this.tenantId, aggregateId: this.id, correlationId, endDate }),
    );
    this.incrementVersion();
    this.updatedAt = new Date();
  }

  update(
    props: { jobTitle?: string; departmentId?: Uuid; managerId?: Uuid; positionId?: Uuid },
    correlationId: Uuid,
  ): void {
    this.jobTitle = props.jobTitle ?? this.jobTitle;
    this.departmentId = props.departmentId ?? this.departmentId;
    this.managerId = props.managerId ?? this.managerId;
    this.positionId = props.positionId ?? this.positionId;
    this.addDomainEvent(
      new JobAssignmentUpdated({
        tenantId: this.tenantId,
        aggregateId: this.id,
        correlationId,
        jobTitle: this.jobTitle,
        departmentId: this.departmentId?.value,
        managerId: this.managerId?.value,
      }),
    );
    this.incrementVersion();
    this.updatedAt = new Date();
  }
}
