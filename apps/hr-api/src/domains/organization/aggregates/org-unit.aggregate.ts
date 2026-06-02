import { AggregateRoot, DomainEvent, Uuid } from '@hcm/shared-kernel';

/**
 * Domain event emitted when a new OrgUnit is created.
 */
export class OrgUnitCreated extends DomainEvent {
  readonly name: string;
  readonly legalEntityId: Uuid;
  readonly parentId?: Uuid;

  constructor(props: {
    tenantId: Uuid;
    aggregateId: Uuid;
    correlationId: Uuid;
    name: string;
    legalEntityId: Uuid;
    parentId?: Uuid;
  }) {
    super({
      eventName: 'OrgUnitCreated',
      tenantId: props.tenantId,
      aggregateType: 'OrgUnit',
      aggregateId: props.aggregateId,
      correlationId: props.correlationId,
    });
    this.name = props.name;
    this.legalEntityId = props.legalEntityId;
    this.parentId = props.parentId;
  }
}

/**
 * Domain event emitted when an OrgUnit is activated.
 */
export class OrgUnitActivated extends DomainEvent {
  constructor(props: {
    tenantId: Uuid;
    aggregateId: Uuid;
    correlationId: Uuid;
  }) {
    super({
      eventName: 'OrgUnitActivated',
      tenantId: props.tenantId,
      aggregateType: 'OrgUnit',
      aggregateId: props.aggregateId,
      correlationId: props.correlationId,
    });
  }
}

/**
 * Domain event emitted when an OrgUnit is restructured.
 */
export class OrgUnitRestructured extends DomainEvent {
  readonly previousParentId?: Uuid;
  readonly newParentId?: Uuid;
  readonly newName?: string;

  constructor(props: {
    tenantId: Uuid;
    aggregateId: Uuid;
    correlationId: Uuid;
    previousParentId?: Uuid;
    newParentId?: Uuid;
    newName?: string;
  }) {
    super({
      eventName: 'OrgUnitRestructured',
      tenantId: props.tenantId,
      aggregateType: 'OrgUnit',
      aggregateId: props.aggregateId,
      correlationId: props.correlationId,
    });
    this.previousParentId = props.previousParentId;
    this.newParentId = props.newParentId;
    this.newName = props.newName;
  }
}

/**
 * Domain event emitted when an OrgUnit is dissolved.
 */
export class OrgUnitDissolved extends DomainEvent {
  constructor(props: {
    tenantId: Uuid;
    aggregateId: Uuid;
    correlationId: Uuid;
  }) {
    super({
      eventName: 'OrgUnitDissolved',
      tenantId: props.tenantId,
      aggregateType: 'OrgUnit',
      aggregateId: props.aggregateId,
      correlationId: props.correlationId,
    });
  }
}

/**
 * Domain event emitted when an OrgUnit is updated.
 */
export class OrgUnitUpdated extends DomainEvent {
  readonly name?: string;
  readonly parentId?: Uuid;

  constructor(props: {
    tenantId: Uuid;
    aggregateId: Uuid;
    correlationId: Uuid;
    name?: string;
    parentId?: Uuid;
  }) {
    super({
      eventName: 'OrgUnitUpdated',
      tenantId: props.tenantId,
      aggregateType: 'OrgUnit',
      aggregateId: props.aggregateId,
      correlationId: props.correlationId,
    });
    this.name = props.name;
    this.parentId = props.parentId;
  }
}

/**
 * OrgUnit aggregate root representing an organizational unit
 * (department, division, team) within a legal entity.
 *
 * FSM lifecycle: DRAFT → ACTIVE → INACTIVE → DISSOLVED (terminal)
 */
export class OrgUnit extends AggregateRoot {
  readonly tenantId: Uuid;
  name: string;
  code: string | null;
  parentId?: Uuid;
  legalEntityId?: Uuid;
  level: number;
  path: string | null;
  status: 'DRAFT' | 'ACTIVE' | 'INACTIVE' | 'DISSOLVED';
  readonly createdAt: Date;
  updatedAt: Date;

  private constructor(props: {
    id: Uuid;
    tenantId: Uuid;
    name: string;
    code: string | null;
    parentId?: Uuid;
    legalEntityId?: Uuid;
    level: number;
    path: string | null;
    status: 'DRAFT' | 'ACTIVE' | 'INACTIVE' | 'DISSOLVED';
    createdAt: Date;
    updatedAt: Date;
    version: number;
  }) {
    super(props.id);
    this.tenantId = props.tenantId;
    this.name = props.name;
    this.code = props.code;
    this.parentId = props.parentId;
    this.legalEntityId = props.legalEntityId;
    this.level = props.level;
    this.path = props.path;
    this.status = props.status;
    this.createdAt = props.createdAt;
    this.updatedAt = props.updatedAt;
    this.restoreVersion(props.version);
  }

  /**
   * Rehydrates an OrgUnit from persistence.
   */
  static rehydrate(props: {
    id: Uuid;
    tenantId: Uuid;
    name: string;
    code: string | null;
    parentId?: Uuid;
    legalEntityId?: Uuid;
    level: number;
    path: string | null;
    status: 'DRAFT' | 'ACTIVE' | 'INACTIVE' | 'DISSOLVED';
    createdAt: Date;
    updatedAt: Date;
    version: number;
  }): OrgUnit {
    return new OrgUnit(props);
  }

  /**
   * Factory method that creates a new OrgUnit in DRAFT state.
   */
  static restore(props: {
    id: Uuid;
    tenantId: Uuid;
    name: string;
    code: string | null;
    parentId?: Uuid;
    legalEntityId?: Uuid;
    level: number;
    path: string | null;
    status: 'DRAFT' | 'ACTIVE' | 'INACTIVE' | 'DISSOLVED';
    createdAt: Date;
    updatedAt: Date;
    version: number;
  }): OrgUnit {
    return new OrgUnit(props);
  }

  static create(props: {
    id: Uuid;
    tenantId: Uuid;
    name: string;
    legalEntityId: Uuid;
    parentId?: Uuid;
    correlationId: Uuid;
  }): OrgUnit {
    const entity = new OrgUnit({
      id: props.id,
      tenantId: props.tenantId,
      name: props.name,
      code: null,
      parentId: props.parentId,
      legalEntityId: props.legalEntityId,
      level: 0,
      path: null,
      status: 'DRAFT',
      createdAt: new Date(),
      updatedAt: new Date(),
      version: 0,
    });
    entity.addDomainEvent(
      new OrgUnitCreated({
        tenantId: props.tenantId,
        aggregateId: props.id,
        correlationId: props.correlationId,
        name: props.name,
        legalEntityId: props.legalEntityId,
        parentId: props.parentId,
      }),
    );
    return entity;
  }

  /**
   * Activates the org unit (DRAFT or INACTIVE → ACTIVE).
   */
  activate(correlationId: Uuid): void {
    if (this.status !== 'DRAFT' && this.status !== 'INACTIVE') {
      throw new Error(`Cannot activate OrgUnit from state ${this.status}`);
    }
    this.status = 'ACTIVE';
    this.updatedAt = new Date();
    this.incrementVersion();
    this.addDomainEvent(
      new OrgUnitActivated({
        tenantId: this.tenantId,
        aggregateId: this.id,
        correlationId,
      }),
    );
  }

  /**
   * Restructures the org unit under a new parent and/or with a new name.
   */
  restructure(
    newParentId: Uuid | null | undefined,
    newName: string | undefined,
    correlationId: Uuid,
  ): void {
    if (this.status !== 'ACTIVE') {
      throw new Error(`Cannot restructure OrgUnit from state ${this.status}`);
    }
    const previousParentId = this.parentId;
    if (newParentId !== undefined) {
      this.parentId = newParentId ?? undefined;
    }
    if (newName !== undefined) {
      this.name = newName;
    }
    this.updatedAt = new Date();
    this.incrementVersion();
    this.addDomainEvent(
      new OrgUnitRestructured({
        tenantId: this.tenantId,
        aggregateId: this.id,
        correlationId,
        previousParentId,
        newParentId: newParentId ?? undefined,
        newName: newName,
      }),
    );
  }

  /**
   * Dissolves the org unit (ACTIVE or INACTIVE → DISSOLVED).
   */
  dissolve(correlationId: Uuid): void {
    if (this.status !== 'ACTIVE' && this.status !== 'INACTIVE') {
      throw new Error(`Cannot dissolve OrgUnit from state ${this.status}`);
    }
    this.status = 'DISSOLVED';
    this.updatedAt = new Date();
    this.incrementVersion();
    this.addDomainEvent(
      new OrgUnitDissolved({
        tenantId: this.tenantId,
        aggregateId: this.id,
        correlationId,
      }),
    );
  }

  /**
   * Updates mutable properties of the org unit.
   */
  update(
    props: { name?: string; parentId?: Uuid },
    correlationId: Uuid,
  ): void {
    if (this.status === 'DISSOLVED') {
      throw new Error('Cannot update dissolved OrgUnit');
    }
    if (props.name !== undefined) {
      this.name = props.name;
    }
    if (props.parentId !== undefined) {
      this.parentId = props.parentId;
    }
    this.updatedAt = new Date();
    this.incrementVersion();
    this.addDomainEvent(
      new OrgUnitUpdated({
        tenantId: this.tenantId,
        aggregateId: this.id,
        correlationId,
        name: props.name,
        parentId: props.parentId,
      }),
    );
  }
}
