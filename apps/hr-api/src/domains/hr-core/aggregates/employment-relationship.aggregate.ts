import { AggregateRoot, DomainEvent, Uuid, ValidationError } from '@hcm/shared-kernel';

export type EmploymentRelationshipState = 'DRAFT' | 'ACTIVE' | 'PROBATION' | 'CONFIRMED' | 'ENDED';

export interface EmploymentRelationshipProps {
  id: Uuid;
  tenantId: Uuid;
  workerId: Uuid;
  relationshipType: string;
  startDate: Date;
  endDate?: Date;
  legalEntityId?: Uuid;
  contractType?: string;
  probationEndDate?: Date;
  state: EmploymentRelationshipState;
  aggregateVersion?: number;
  createdAt?: Date;
  updatedAt?: Date;
}

/* ------------------------------------------------------------------ */
/*  Domain Events                                                      */
/* ------------------------------------------------------------------ */

export class EmploymentRelationshipCreated extends DomainEvent {
  readonly workerId: string;
  readonly relationshipType: string;

  constructor(props: { tenantId: Uuid; aggregateId: Uuid; correlationId: Uuid; workerId: Uuid; relationshipType: string }) {
    super({
      eventName: 'EmploymentRelationshipCreated',
      tenantId: props.tenantId,
      aggregateType: 'EmploymentRelationship',
      aggregateId: props.aggregateId,
      correlationId: props.correlationId,
    });
    this.workerId = props.workerId.value;
    this.relationshipType = props.relationshipType;
  }
}

export class EmploymentRelationshipActivated extends DomainEvent {
  constructor(props: { tenantId: Uuid; aggregateId: Uuid; correlationId: Uuid }) {
    super({
      eventName: 'EmploymentRelationshipActivated',
      tenantId: props.tenantId,
      aggregateType: 'EmploymentRelationship',
      aggregateId: props.aggregateId,
      correlationId: props.correlationId,
    });
  }
}

export class ProbationStarted extends DomainEvent {
  readonly probationEndDate?: Date;

  constructor(props: { tenantId: Uuid; aggregateId: Uuid; correlationId: Uuid; probationEndDate?: Date }) {
    super({
      eventName: 'ProbationStarted',
      tenantId: props.tenantId,
      aggregateType: 'EmploymentRelationship',
      aggregateId: props.aggregateId,
      correlationId: props.correlationId,
    });
    this.probationEndDate = props.probationEndDate;
  }
}

export class EmploymentConfirmed extends DomainEvent {
  constructor(props: { tenantId: Uuid; aggregateId: Uuid; correlationId: Uuid }) {
    super({
      eventName: 'EmploymentConfirmed',
      tenantId: props.tenantId,
      aggregateType: 'EmploymentRelationship',
      aggregateId: props.aggregateId,
      correlationId: props.correlationId,
    });
  }
}

export class EmploymentRelationshipEnded extends DomainEvent {
  readonly endDate: Date;

  constructor(props: { tenantId: Uuid; aggregateId: Uuid; correlationId: Uuid; endDate: Date }) {
    super({
      eventName: 'EmploymentRelationshipEnded',
      tenantId: props.tenantId,
      aggregateType: 'EmploymentRelationship',
      aggregateId: props.aggregateId,
      correlationId: props.correlationId,
    });
    this.endDate = props.endDate;
  }
}

/* ------------------------------------------------------------------ */
/*  Aggregate                                                          */
/* ------------------------------------------------------------------ */

/**
 * Represents the employment relationship between a worker and the organisation.
 */
export class EmploymentRelationship extends AggregateRoot {
  private _aggregateVersion = 0;

  readonly tenantId: Uuid;
  readonly workerId: Uuid;
  relationshipType: string;
  startDate: Date;
  endDate?: Date;
  legalEntityId?: Uuid;
  contractType?: string;
  probationEndDate?: Date;
  state: EmploymentRelationshipState;
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

  constructor(props: EmploymentRelationshipProps) {
    super(props.id);
    this.tenantId = props.tenantId;
    this.workerId = props.workerId;
    this.relationshipType = props.relationshipType;
    this.startDate = props.startDate;
    this.endDate = props.endDate;
    this.legalEntityId = props.legalEntityId;
    this.contractType = props.contractType;
    this.probationEndDate = props.probationEndDate;
    this.state = props.state;
    this.createdAt = props.createdAt ?? new Date();
    this.updatedAt = props.updatedAt ?? new Date();
    if (props.aggregateVersion !== undefined) {
      this._aggregateVersion = props.aggregateVersion;
    }
  }

  static create(props: EmploymentRelationshipProps, correlationId: Uuid): EmploymentRelationship {
    const relationship = new EmploymentRelationship({
      ...props,
      state: 'DRAFT',
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    relationship.addDomainEvent(
      new EmploymentRelationshipCreated({
        tenantId: relationship.tenantId,
        aggregateId: relationship.id,
        correlationId,
        workerId: relationship.workerId,
        relationshipType: relationship.relationshipType,
      }),
    );

    return relationship;
  }

  activate(correlationId: Uuid): void {
    if (this.state !== 'DRAFT') {
      throw new ValidationError(`Cannot activate employment relationship from state ${this.state}`);
    }
    this.state = 'ACTIVE';
    this.addDomainEvent(
      new EmploymentRelationshipActivated({ tenantId: this.tenantId, aggregateId: this.id, correlationId }),
    );
    this.incrementVersion();
    this.updatedAt = new Date();
  }

  startProbation(probationEndDate: Date, correlationId: Uuid): void {
    if (this.state !== 'ACTIVE') {
      throw new ValidationError(`Cannot start probation from state ${this.state}`);
    }
    this.state = 'PROBATION';
    this.probationEndDate = probationEndDate;
    this.addDomainEvent(
      new ProbationStarted({ tenantId: this.tenantId, aggregateId: this.id, correlationId, probationEndDate }),
    );
    this.incrementVersion();
    this.updatedAt = new Date();
  }

  confirm(correlationId: Uuid): void {
    if (this.state !== 'PROBATION') {
      throw new ValidationError(`Cannot confirm employment from state ${this.state}`);
    }
    this.state = 'CONFIRMED';
    this.addDomainEvent(
      new EmploymentConfirmed({ tenantId: this.tenantId, aggregateId: this.id, correlationId }),
    );
    this.incrementVersion();
    this.updatedAt = new Date();
  }

  end(endDate: Date, correlationId: Uuid): void {
    if (this.state === 'ENDED') {
      throw new ValidationError('Employment relationship is already ended');
    }
    this.state = 'ENDED';
    this.endDate = endDate;
    this.addDomainEvent(
      new EmploymentRelationshipEnded({ tenantId: this.tenantId, aggregateId: this.id, correlationId, endDate }),
    );
    this.incrementVersion();
    this.updatedAt = new Date();
  }
}
