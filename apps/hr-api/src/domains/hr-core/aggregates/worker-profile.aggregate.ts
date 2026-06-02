import { AggregateRoot, DomainEvent, Uuid, Email, Guard, ValidationError } from '@hcm/shared-kernel';

/**
 * Canonical worker status values.
 */
export type WorkerStatus = 'DRAFT' | 'PENDING_ACTIVATION' | 'ACTIVE' | 'SUSPENDED' | 'TERMINATED' | 'REHIRED';

/**
 * Supported employment types.
 */
export type EmploymentType = 'FULL_TIME' | 'PART_TIME' | 'CONTRACTOR' | 'INTERN' | 'TEMPORARY';

/**
 * Properties required to construct a {@link WorkerProfile}.
 */
export interface WorkerProfileProps {
  id: Uuid;
  tenantId: Uuid;
  employeeNumber: string;
  status: WorkerStatus;
  firstName: string;
  lastName: string;
  email: Email;
  hireDate: Date;
  terminationDate?: Date;
  legalEntityId?: Uuid;
  departmentId?: Uuid;
  managerId?: Uuid;
  jobTitle?: string;
  employmentType: EmploymentType;
  aggregateVersion?: number;
  dataClassification?: 'CONFIDENTIAL';
  createdAt?: Date;
  updatedAt?: Date;
}

/* ------------------------------------------------------------------ */
/*  Domain Events                                                      */
/* ------------------------------------------------------------------ */

export class WorkerProfileCreated extends DomainEvent {
  readonly employeeNumber: string;
  readonly email: string;

  constructor(props: { tenantId: Uuid; aggregateId: Uuid; correlationId: Uuid; employeeNumber: string; email: Email }) {
    super({
      eventName: 'WorkerProfileCreated',
      tenantId: props.tenantId,
      aggregateType: 'WorkerProfile',
      aggregateId: props.aggregateId,
      correlationId: props.correlationId,
    });
    this.employeeNumber = props.employeeNumber;
    this.email = props.email.toString();
  }
}

export class WorkerActivated extends DomainEvent {
  constructor(props: { tenantId: Uuid; aggregateId: Uuid; correlationId: Uuid }) {
    super({
      eventName: 'WorkerActivated',
      tenantId: props.tenantId,
      aggregateType: 'WorkerProfile',
      aggregateId: props.aggregateId,
      correlationId: props.correlationId,
    });
  }
}

export class WorkerTerminated extends DomainEvent {
  readonly terminationDate: Date;
  readonly reason: string;

  constructor(props: { tenantId: Uuid; aggregateId: Uuid; correlationId: Uuid; terminationDate: Date; reason: string }) {
    super({
      eventName: 'WorkerTerminated',
      tenantId: props.tenantId,
      aggregateType: 'WorkerProfile',
      aggregateId: props.aggregateId,
      correlationId: props.correlationId,
    });
    this.terminationDate = props.terminationDate;
    this.reason = props.reason;
  }
}

export class WorkerSuspended extends DomainEvent {
  readonly reason: string;

  constructor(props: { tenantId: Uuid; aggregateId: Uuid; correlationId: Uuid; reason: string }) {
    super({
      eventName: 'WorkerSuspended',
      tenantId: props.tenantId,
      aggregateType: 'WorkerProfile',
      aggregateId: props.aggregateId,
      correlationId: props.correlationId,
    });
    this.reason = props.reason;
  }
}

export class WorkerReinstated extends DomainEvent {
  constructor(props: { tenantId: Uuid; aggregateId: Uuid; correlationId: Uuid }) {
    super({
      eventName: 'WorkerReinstated',
      tenantId: props.tenantId,
      aggregateType: 'WorkerProfile',
      aggregateId: props.aggregateId,
      correlationId: props.correlationId,
    });
  }
}

export class WorkerRehired extends DomainEvent {
  constructor(props: { tenantId: Uuid; aggregateId: Uuid; correlationId: Uuid }) {
    super({
      eventName: 'WorkerRehired',
      tenantId: props.tenantId,
      aggregateType: 'WorkerProfile',
      aggregateId: props.aggregateId,
      correlationId: props.correlationId,
    });
  }
}

export class PersonalDataUpdated extends DomainEvent {
  readonly fields: string[];

  constructor(props: { tenantId: Uuid; aggregateId: Uuid; correlationId: Uuid; fields: string[] }) {
    super({
      eventName: 'PersonalDataUpdated',
      tenantId: props.tenantId,
      aggregateType: 'WorkerProfile',
      aggregateId: props.aggregateId,
      correlationId: props.correlationId,
    });
    this.fields = props.fields;
  }
}

export class JobInfoUpdated extends DomainEvent {
  readonly jobTitle?: string;
  readonly departmentId?: string;
  readonly legalEntityId?: string;
  readonly managerId?: string;

  constructor(props: {
    tenantId: Uuid;
    aggregateId: Uuid;
    correlationId: Uuid;
    jobTitle?: string;
    departmentId?: string;
    legalEntityId?: string;
    managerId?: string;
  }) {
    super({
      eventName: 'JobInfoUpdated',
      tenantId: props.tenantId,
      aggregateType: 'WorkerProfile',
      aggregateId: props.aggregateId,
      correlationId: props.correlationId,
    });
    this.jobTitle = props.jobTitle;
    this.departmentId = props.departmentId;
    this.legalEntityId = props.legalEntityId;
    this.managerId = props.managerId;
  }
}

export class ManagerAssigned extends DomainEvent {
  readonly managerId: string;

  constructor(props: { tenantId: Uuid; aggregateId: Uuid; correlationId: Uuid; managerId: Uuid }) {
    super({
      eventName: 'ManagerAssigned',
      tenantId: props.tenantId,
      aggregateType: 'WorkerProfile',
      aggregateId: props.aggregateId,
      correlationId: props.correlationId,
    });
    this.managerId = props.managerId.value;
  }
}

/* ------------------------------------------------------------------ */
/*  Aggregate                                                          */
/* ------------------------------------------------------------------ */

/**
 * The most important aggregate in the system. Represents a worker's profile
 * and lifecycle.
 */
export class WorkerProfile extends AggregateRoot {
  private _aggregateVersion = 0;

  readonly tenantId: Uuid;
  employeeNumber: string;
  status: WorkerStatus;
  firstName: string;
  lastName: string;
  email: Email;
  hireDate: Date;
  terminationDate?: Date;
  legalEntityId?: Uuid;
  departmentId?: Uuid;
  managerId?: Uuid;
  jobTitle?: string;
  employmentType: EmploymentType;
  dataClassification: 'CONFIDENTIAL';
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

  constructor(props: WorkerProfileProps) {
    super(props.id);
    this.tenantId = props.tenantId;
    this.employeeNumber = props.employeeNumber;
    this.status = props.status;
    this.firstName = props.firstName;
    this.lastName = props.lastName;
    this.email = props.email;
    this.hireDate = props.hireDate;
    this.terminationDate = props.terminationDate;
    this.legalEntityId = props.legalEntityId;
    this.departmentId = props.departmentId;
    this.managerId = props.managerId;
    this.jobTitle = props.jobTitle;
    this.employmentType = props.employmentType;
    this.dataClassification = props.dataClassification ?? 'CONFIDENTIAL';
    this.createdAt = props.createdAt ?? new Date();
    this.updatedAt = props.updatedAt ?? new Date();
    if (props.aggregateVersion !== undefined) {
      this._aggregateVersion = props.aggregateVersion;
    }
  }

  /**
   * Factory method to create a new WorkerProfile in DRAFT state.
   * Generates an employee number if one is not provided.
   */
  static create(props: WorkerProfileProps, correlationId: Uuid): WorkerProfile {
    Guard.againstEmptyString(props.firstName, 'firstName');
    Guard.againstEmptyString(props.lastName, 'lastName');
    Guard.againstFutureDate(props.hireDate, 'hireDate');

    const id = props.id instanceof Uuid ? props.id : new Uuid(props.id as unknown as string);
    const tenantId = props.tenantId instanceof Uuid ? props.tenantId : new Uuid(props.tenantId as unknown as string);
    const employeeNumber = props.employeeNumber || `EMP-${tenantId.value.slice(0, 8)}-${Date.now()}`;

    const profile = new WorkerProfile({
      ...props,
      id,
      tenantId,
      employeeNumber,
      status: 'DRAFT',
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    profile.addDomainEvent(
      new WorkerProfileCreated({
        tenantId: profile.tenantId,
        aggregateId: profile.id,
        correlationId,
        employeeNumber: profile.employeeNumber,
        email: profile.email,
      }),
    );

    return profile;
  }

  /**
   * Activate the worker.
   * DRAFT → PENDING_ACTIVATION, PENDING_ACTIVATION → ACTIVE,
   * SUSPENDED → ACTIVE, REHIRED → ACTIVE.
   */
  activate(correlationId: Uuid): void {
    if (this.status === 'DRAFT') {
      this.status = 'PENDING_ACTIVATION';
    } else if (this.status === 'PENDING_ACTIVATION' || this.status === 'SUSPENDED' || this.status === 'REHIRED') {
      this.status = 'ACTIVE';
    } else {
      throw new ValidationError(`Cannot activate worker from state ${this.status}`);
    }
    this.addDomainEvent(new WorkerActivated({ tenantId: this.tenantId, aggregateId: this.id, correlationId }));
    this.incrementVersion();
    this.updatedAt = new Date();
  }

  /**
   * Terminate the worker.
   */
  terminate(terminationDate: Date, reason: string, correlationId: Uuid): void {
    if (this.status !== 'ACTIVE' && this.status !== 'SUSPENDED') {
      throw new ValidationError(`Cannot terminate worker from state ${this.status}`);
    }
    if (terminationDate < this.hireDate) {
      throw new ValidationError('Termination date must be >= hire date');
    }
    this.status = 'TERMINATED';
    this.terminationDate = terminationDate;
    this.addDomainEvent(
      new WorkerTerminated({ tenantId: this.tenantId, aggregateId: this.id, correlationId, terminationDate, reason }),
    );
    this.incrementVersion();
    this.updatedAt = new Date();
  }

  /**
   * Suspend the worker.
   */
  suspend(reason: string, correlationId: Uuid): void {
    if (this.status !== 'ACTIVE') {
      throw new ValidationError(`Cannot suspend worker from state ${this.status}`);
    }
    this.status = 'SUSPENDED';
    this.addDomainEvent(new WorkerSuspended({ tenantId: this.tenantId, aggregateId: this.id, correlationId, reason }));
    this.incrementVersion();
    this.updatedAt = new Date();
  }

  /**
   * Reinstate a suspended worker back to ACTIVE.
   */
  reinstate(correlationId: Uuid): void {
    if (this.status !== 'SUSPENDED') {
      throw new ValidationError(`Cannot reinstate worker from state ${this.status}`);
    }
    this.status = 'ACTIVE';
    this.addDomainEvent(new WorkerReinstated({ tenantId: this.tenantId, aggregateId: this.id, correlationId }));
    this.incrementVersion();
    this.updatedAt = new Date();
  }

  /**
   * Rehire a terminated worker (transitions to REHIRED).
   */
  rehire(correlationId: Uuid): void {
    if (this.status !== 'TERMINATED') {
      throw new ValidationError(`Cannot rehire worker from state ${this.status}`);
    }
    this.status = 'REHIRED';
    this.addDomainEvent(new WorkerRehired({ tenantId: this.tenantId, aggregateId: this.id, correlationId }));
    this.incrementVersion();
    this.updatedAt = new Date();
  }

  /**
   * Update personal data fields.
   */
  updatePersonalData(props: { firstName?: string; lastName?: string; email?: Email }, correlationId: Uuid): void {
    const fields: string[] = [];
    if (props.firstName !== undefined) {
      this.firstName = props.firstName;
      fields.push('firstName');
    }
    if (props.lastName !== undefined) {
      this.lastName = props.lastName;
      fields.push('lastName');
    }
    if (props.email !== undefined) {
      this.email = props.email;
      fields.push('email');
    }
    if (fields.length > 0) {
      this.addDomainEvent(
        new PersonalDataUpdated({ tenantId: this.tenantId, aggregateId: this.id, correlationId, fields }),
      );
      this.incrementVersion();
      this.updatedAt = new Date();
    }
  }

  /**
   * Update job information.
   */
  updateJobInfo(
    props: { jobTitle?: string | null; departmentId?: Uuid | null; legalEntityId?: Uuid | null; managerId?: Uuid | null },
    correlationId: Uuid,
  ): void {
    if ('jobTitle' in props && props.jobTitle !== undefined) {
      this.jobTitle = props.jobTitle ?? undefined;
    }
    if ('departmentId' in props && props.departmentId !== undefined) {
      this.departmentId = props.departmentId ?? undefined;
    }
    if ('legalEntityId' in props && props.legalEntityId !== undefined) {
      this.legalEntityId = props.legalEntityId ?? undefined;
    }
    if ('managerId' in props && props.managerId !== undefined) {
      this.managerId = props.managerId ?? undefined;
    }
    this.addDomainEvent(
      new JobInfoUpdated({
        tenantId: this.tenantId,
        aggregateId: this.id,
        correlationId,
        jobTitle: this.jobTitle,
        departmentId: this.departmentId?.value,
        legalEntityId: this.legalEntityId?.value,
        managerId: this.managerId?.value,
      }),
    );
    this.incrementVersion();
    this.updatedAt = new Date();
  }

  /**
   * Assign a manager to the worker.
   */
  assignManager(managerId: Uuid, correlationId: Uuid): void {
    this.managerId = managerId;
    this.addDomainEvent(
      new ManagerAssigned({ tenantId: this.tenantId, aggregateId: this.id, correlationId, managerId }),
    );
    this.incrementVersion();
    this.updatedAt = new Date();
  }
}
