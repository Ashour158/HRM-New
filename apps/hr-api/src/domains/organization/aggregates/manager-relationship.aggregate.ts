import { AggregateRoot, DomainEvent, Uuid } from '@hcm/shared-kernel';

/**
 * Domain event emitted when a new ManagerRelationship is created.
 */
export class ManagerRelationshipCreated extends DomainEvent {
  readonly workerId: Uuid;
  readonly managerId: Uuid;
  readonly departmentId?: Uuid;

  constructor(props: {
    tenantId: Uuid;
    aggregateId: Uuid;
    correlationId: Uuid;
    workerId: Uuid;
    managerId: Uuid;
    departmentId?: Uuid;
  }) {
    super({
      eventName: 'ManagerRelationshipCreated',
      tenantId: props.tenantId,
      aggregateType: 'ManagerRelationship',
      aggregateId: props.aggregateId,
      correlationId: props.correlationId,
    });
    this.workerId = props.workerId;
    this.managerId = props.managerId;
    this.departmentId = props.departmentId;
  }
}

/**
 * Domain event emitted when a ManagerRelationship is activated.
 */
export class ManagerRelationshipActivated extends DomainEvent {
  constructor(props: {
    tenantId: Uuid;
    aggregateId: Uuid;
    correlationId: Uuid;
  }) {
    super({
      eventName: 'ManagerRelationshipActivated',
      tenantId: props.tenantId,
      aggregateType: 'ManagerRelationship',
      aggregateId: props.aggregateId,
      correlationId: props.correlationId,
    });
  }
}

/**
 * Domain event emitted when a ManagerRelationship is ended.
 */
export class ManagerRelationshipEnded extends DomainEvent {
  readonly endDate: Date;

  constructor(props: {
    tenantId: Uuid;
    aggregateId: Uuid;
    correlationId: Uuid;
    endDate: Date;
  }) {
    super({
      eventName: 'ManagerRelationshipEnded',
      tenantId: props.tenantId,
      aggregateType: 'ManagerRelationship',
      aggregateId: props.aggregateId,
      correlationId: props.correlationId,
    });
    this.endDate = props.endDate;
  }
}

/**
 * Domain event emitted when a ManagerRelationship is updated.
 */
export class ManagerRelationshipUpdated extends DomainEvent {
  readonly isPrimary?: boolean;
  readonly departmentId?: Uuid;

  constructor(props: {
    tenantId: Uuid;
    aggregateId: Uuid;
    correlationId: Uuid;
    isPrimary?: boolean;
    departmentId?: Uuid;
  }) {
    super({
      eventName: 'ManagerRelationshipUpdated',
      tenantId: props.tenantId,
      aggregateType: 'ManagerRelationship',
      aggregateId: props.aggregateId,
      correlationId: props.correlationId,
    });
    this.isPrimary = props.isPrimary;
    this.departmentId = props.departmentId;
  }
}

/**
 * ManagerRelationship aggregate root linking a worker to their manager.
 *
 * FSM lifecycle: DRAFT → ACTIVE → ENDED (terminal)
 */
export class ManagerRelationship extends AggregateRoot {
  readonly tenantId: Uuid;
  workerId: Uuid;
  managerId: Uuid;
  departmentId?: Uuid;
  isPrimary: boolean;
  startDate: Date;
  endDate?: Date;
  status: 'DRAFT' | 'ACTIVE' | 'ENDED';
  readonly createdAt: Date;
  updatedAt: Date;

  private constructor(props: {
    id: Uuid;
    tenantId: Uuid;
    workerId: Uuid;
    managerId: Uuid;
    departmentId?: Uuid;
    isPrimary: boolean;
    startDate: Date;
    endDate?: Date;
    status: 'DRAFT' | 'ACTIVE' | 'ENDED';
    createdAt: Date;
    updatedAt: Date;
    version: number;
  }) {
    super(props.id);
    this.tenantId = props.tenantId;
    this.workerId = props.workerId;
    this.managerId = props.managerId;
    this.departmentId = props.departmentId;
    this.isPrimary = props.isPrimary;
    this.startDate = props.startDate;
    this.endDate = props.endDate;
    this.status = props.status;
    this.createdAt = props.createdAt;
    this.updatedAt = props.updatedAt;
    this.restoreVersion(props.version);
  }

  /**
   * Rehydrates a ManagerRelationship from persistence.
   */
  static rehydrate(props: {
    id: Uuid;
    tenantId: Uuid;
    workerId: Uuid;
    managerId: Uuid;
    departmentId?: Uuid;
    isPrimary: boolean;
    startDate: Date;
    endDate?: Date;
    status: 'DRAFT' | 'ACTIVE' | 'ENDED';
    createdAt: Date;
    updatedAt: Date;
    version: number;
  }): ManagerRelationship {
    return new ManagerRelationship(props);
  }

  /**
   * Factory method that creates a new ManagerRelationship in DRAFT state.
   */
  static restore(props: {
    id: Uuid;
    tenantId: Uuid;
    workerId: Uuid;
    managerId: Uuid;
    departmentId?: Uuid;
    isPrimary: boolean;
    startDate: Date;
    endDate?: Date;
    status: 'DRAFT' | 'ACTIVE' | 'ENDED';
    createdAt: Date;
    updatedAt: Date;
    version: number;
  }): ManagerRelationship {
    return new ManagerRelationship(props);
  }

  static create(props: {
    id: Uuid;
    tenantId: Uuid;
    workerId: Uuid;
    managerId: Uuid;
    departmentId?: Uuid;
    correlationId: Uuid;
  }): ManagerRelationship {
    const entity = new ManagerRelationship({
      id: props.id,
      tenantId: props.tenantId,
      workerId: props.workerId,
      managerId: props.managerId,
      departmentId: props.departmentId,
      isPrimary: true,
      startDate: new Date(),
      status: 'DRAFT',
      createdAt: new Date(),
      updatedAt: new Date(),
      version: 0,
    });
    entity.addDomainEvent(
      new ManagerRelationshipCreated({
        tenantId: props.tenantId,
        aggregateId: props.id,
        correlationId: props.correlationId,
        workerId: props.workerId,
        managerId: props.managerId,
        departmentId: props.departmentId,
      }),
    );
    return entity;
  }

  /**
   * Activates the manager relationship (DRAFT → ACTIVE).
   */
  activate(correlationId: Uuid): void {
    if (this.status !== 'DRAFT') {
      throw new Error(`Cannot activate ManagerRelationship from state ${this.status}`);
    }
    this.status = 'ACTIVE';
    this.updatedAt = new Date();
    this.incrementVersion();
    this.addDomainEvent(
      new ManagerRelationshipActivated({
        tenantId: this.tenantId,
        aggregateId: this.id,
        correlationId,
      }),
    );
  }

  /**
   * Ends the manager relationship (ACTIVE → ENDED).
   */
  end(endDate: Date, correlationId: Uuid): void {
    if (this.status !== 'ACTIVE') {
      throw new Error(`Cannot end ManagerRelationship from state ${this.status}`);
    }
    this.status = 'ENDED';
    this.endDate = endDate;
    this.updatedAt = new Date();
    this.incrementVersion();
    this.addDomainEvent(
      new ManagerRelationshipEnded({
        tenantId: this.tenantId,
        aggregateId: this.id,
        correlationId,
        endDate,
      }),
    );
  }

  /**
   * Updates mutable properties of the manager relationship.
   */
  update(
    props: { isPrimary?: boolean; departmentId?: Uuid },
    correlationId: Uuid,
  ): void {
    if (this.status === 'ENDED') {
      throw new Error('Cannot update ended ManagerRelationship');
    }
    if (props.isPrimary !== undefined) {
      this.isPrimary = props.isPrimary;
    }
    if (props.departmentId !== undefined) {
      this.departmentId = props.departmentId;
    }
    this.updatedAt = new Date();
    this.incrementVersion();
    this.addDomainEvent(
      new ManagerRelationshipUpdated({
        tenantId: this.tenantId,
        aggregateId: this.id,
        correlationId,
        isPrimary: props.isPrimary,
        departmentId: props.departmentId,
      }),
    );
  }
}
