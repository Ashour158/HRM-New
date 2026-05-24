import { AggregateRoot, DomainEvent, Uuid } from '@hcm/shared-kernel';

/**
 * Domain event emitted when a new LegalEntity is created.
 */
export class LegalEntityCreated extends DomainEvent {
  readonly name: string;
  readonly code: string;
  readonly countryCode: string;

  constructor(props: {
    tenantId: Uuid;
    aggregateId: Uuid;
    correlationId: Uuid;
    name: string;
    code: string;
    countryCode: string;
  }) {
    super({
      eventName: 'LegalEntityCreated',
      tenantId: props.tenantId,
      aggregateType: 'LegalEntity',
      aggregateId: props.aggregateId,
      correlationId: props.correlationId,
    });
    this.name = props.name;
    this.code = props.code;
    this.countryCode = props.countryCode;
  }
}

/**
 * Domain event emitted when a LegalEntity is activated.
 */
export class LegalEntityActivated extends DomainEvent {
  constructor(props: {
    tenantId: Uuid;
    aggregateId: Uuid;
    correlationId: Uuid;
  }) {
    super({
      eventName: 'LegalEntityActivated',
      tenantId: props.tenantId,
      aggregateType: 'LegalEntity',
      aggregateId: props.aggregateId,
      correlationId: props.correlationId,
    });
  }
}

/**
 * Domain event emitted when a LegalEntity is deactivated.
 */
export class LegalEntityDeactivated extends DomainEvent {
  constructor(props: {
    tenantId: Uuid;
    aggregateId: Uuid;
    correlationId: Uuid;
  }) {
    super({
      eventName: 'LegalEntityDeactivated',
      tenantId: props.tenantId,
      aggregateType: 'LegalEntity',
      aggregateId: props.aggregateId,
      correlationId: props.correlationId,
    });
  }
}

/**
 * Domain event emitted when a LegalEntity is dissolved.
 */
export class LegalEntityDissolved extends DomainEvent {
  constructor(props: {
    tenantId: Uuid;
    aggregateId: Uuid;
    correlationId: Uuid;
  }) {
    super({
      eventName: 'LegalEntityDissolved',
      tenantId: props.tenantId,
      aggregateType: 'LegalEntity',
      aggregateId: props.aggregateId,
      correlationId: props.correlationId,
    });
  }
}

/**
 * Domain event emitted when a LegalEntity is updated.
 */
export class LegalEntityUpdated extends DomainEvent {
  readonly name?: string;
  readonly registrationNumber?: string | null;

  constructor(props: {
    tenantId: Uuid;
    aggregateId: Uuid;
    correlationId: Uuid;
    name?: string;
    registrationNumber?: string | null;
  }) {
    super({
      eventName: 'LegalEntityUpdated',
      tenantId: props.tenantId,
      aggregateType: 'LegalEntity',
      aggregateId: props.aggregateId,
      correlationId: props.correlationId,
    });
    this.name = props.name;
    this.registrationNumber = props.registrationNumber;
  }
}

/**
 * LegalEntity aggregate root representing a registered legal entity
 * (company, subsidiary, branch) within a tenant.
 *
 * FSM lifecycle: DRAFT → ACTIVE → INACTIVE → DISSOLVED (terminal)
 */
export class LegalEntity extends AggregateRoot {
  readonly tenantId: Uuid;
  name: string;
  code: string;
  countryCode: string;
  registrationNumber: string | null;
  status: 'DRAFT' | 'ACTIVE' | 'INACTIVE' | 'DISSOLVED';
  readonly createdAt: Date;
  updatedAt: Date;

  private constructor(props: {
    id: Uuid;
    tenantId: Uuid;
    name: string;
    code: string;
    countryCode: string;
    registrationNumber: string | null;
    status: 'DRAFT' | 'ACTIVE' | 'INACTIVE' | 'DISSOLVED';
    createdAt: Date;
    updatedAt: Date;
    version: number;
  }) {
    super(props.id);
    this.tenantId = props.tenantId;
    this.name = props.name;
    this.code = props.code;
    this.countryCode = props.countryCode;
    this.registrationNumber = props.registrationNumber;
    this.status = props.status;
    this.createdAt = props.createdAt;
    this.updatedAt = props.updatedAt;
    this.restoreVersion(props.version);
  }

  /**
   * Rehydrates a LegalEntity from persistence.
   */
  static rehydrate(props: {
    id: Uuid;
    tenantId: Uuid;
    name: string;
    code: string;
    countryCode: string;
    registrationNumber: string | null;
    status: 'DRAFT' | 'ACTIVE' | 'INACTIVE' | 'DISSOLVED';
    createdAt: Date;
    updatedAt: Date;
    version: number;
  }): LegalEntity {
    return new LegalEntity(props);
  }

  /**
   * Factory method that creates a new LegalEntity in DRAFT state.
   */
  static restore(props: {
    id: Uuid;
    tenantId: Uuid;
    name: string;
    code: string;
    countryCode: string;
    registrationNumber: string | null;
    status: 'DRAFT' | 'ACTIVE' | 'INACTIVE' | 'DISSOLVED';
    createdAt: Date;
    updatedAt: Date;
    version: number;
  }): LegalEntity {
    return new LegalEntity(props);
  }

  static create(props: {
    id: Uuid;
    tenantId: Uuid;
    name: string;
    code: string;
    countryCode: string;
    registrationNumber?: string;
    correlationId: Uuid;
  }): LegalEntity {
    const entity = new LegalEntity({
      id: props.id,
      tenantId: props.tenantId,
      name: props.name,
      code: props.code,
      countryCode: props.countryCode,
      registrationNumber: props.registrationNumber ?? null,
      status: 'DRAFT',
      createdAt: new Date(),
      updatedAt: new Date(),
      version: 0,
    });
    entity.addDomainEvent(
      new LegalEntityCreated({
        tenantId: props.tenantId,
        aggregateId: props.id,
        correlationId: props.correlationId,
        name: props.name,
        code: props.code,
        countryCode: props.countryCode,
      }),
    );
    return entity;
  }

  /**
   * Activates the legal entity (DRAFT or INACTIVE → ACTIVE).
   */
  activate(correlationId: Uuid): void {
    if (this.status !== 'DRAFT' && this.status !== 'INACTIVE') {
      throw new Error(`Cannot activate LegalEntity from state ${this.status}`);
    }
    this.status = 'ACTIVE';
    this.updatedAt = new Date();
    this.incrementVersion();
    this.addDomainEvent(
      new LegalEntityActivated({
        tenantId: this.tenantId,
        aggregateId: this.id,
        correlationId,
      }),
    );
  }

  /**
   * Deactivates the legal entity (ACTIVE → INACTIVE).
   */
  deactivate(correlationId: Uuid): void {
    if (this.status !== 'ACTIVE') {
      throw new Error(`Cannot deactivate LegalEntity from state ${this.status}`);
    }
    this.status = 'INACTIVE';
    this.updatedAt = new Date();
    this.incrementVersion();
    this.addDomainEvent(
      new LegalEntityDeactivated({
        tenantId: this.tenantId,
        aggregateId: this.id,
        correlationId,
      }),
    );
  }

  /**
   * Dissolves the legal entity (ACTIVE or INACTIVE → DISSOLVED).
   */
  dissolve(correlationId: Uuid): void {
    if (this.status !== 'ACTIVE' && this.status !== 'INACTIVE') {
      throw new Error(`Cannot dissolve LegalEntity from state ${this.status}`);
    }
    this.status = 'DISSOLVED';
    this.updatedAt = new Date();
    this.incrementVersion();
    this.addDomainEvent(
      new LegalEntityDissolved({
        tenantId: this.tenantId,
        aggregateId: this.id,
        correlationId,
      }),
    );
  }

  /**
   * Updates mutable properties of the legal entity.
   */
  update(
    props: { name?: string; registrationNumber?: string },
    correlationId: Uuid,
  ): void {
    if (this.status === 'DISSOLVED') {
      throw new Error('Cannot update dissolved LegalEntity');
    }
    if (props.name !== undefined) {
      this.name = props.name;
    }
    if (props.registrationNumber !== undefined) {
      this.registrationNumber = props.registrationNumber;
    }
    this.updatedAt = new Date();
    this.incrementVersion();
    this.addDomainEvent(
      new LegalEntityUpdated({
        tenantId: this.tenantId,
        aggregateId: this.id,
        correlationId,
        name: props.name,
        registrationNumber: props.registrationNumber,
      }),
    );
  }
}
