import { AggregateRoot, DomainEvent, Uuid, ConflictError } from '@hcm/shared-kernel';

/**
 * Canonical position status values.
 */
export type PositionStatus = 'DRAFT' | 'ACTIVE' | 'FROZEN' | 'FILLED' | 'VACANT' | 'CLOSED';

/**
 * Properties required to construct or rehydrate a {@link Position} aggregate.
 */
export interface PositionProps {
  id: Uuid;
  tenantId: Uuid;
  positionCode: string;
  title: string;
  departmentId?: Uuid;
  legalEntityId?: Uuid;
  jobFamily?: string;
  jobLevel?: string;
  employmentType: string;
  status?: PositionStatus;
  filledByWorkerId?: Uuid;
  headcountRequestId?: Uuid;
  aggregateVersion?: number;
  createdAt?: Date;
  updatedAt?: Date;
}

/* ── Domain Events ─────────────────────────────────────────────── */

class PositionCreated extends DomainEvent {}
class PositionActivated extends DomainEvent {}
class PositionFrozen extends DomainEvent {}
class PositionUnfrozen extends DomainEvent {}
class PositionFilled extends DomainEvent {}
class PositionVacated extends DomainEvent {}
class PositionClosed extends DomainEvent {}
class PositionUpdated extends DomainEvent {}

/* ── Aggregate ─────────────────────────────────────────────────── */

/**
 * Position aggregate root.
 *
 * Owns the lifecycle of an approved headcount slot including activation,
 * freezing, filling, vacating, and closure.
 */
export class Position extends AggregateRoot {
  readonly tenantId: Uuid;
  positionCode: string;
  title: string;
  departmentId?: Uuid;
  legalEntityId?: Uuid;
  jobFamily?: string;
  jobLevel?: string;
  employmentType: string;
  status: PositionStatus;
  filledByWorkerId?: Uuid;
  headcountRequestId?: Uuid;
  createdAt: Date;
  updatedAt: Date;

  private constructor(props: PositionProps) {
    super(props.id);
    this.tenantId = props.tenantId;
    this.positionCode = props.positionCode;
    this.title = props.title;
    this.departmentId = props.departmentId;
    this.legalEntityId = props.legalEntityId;
    this.jobFamily = props.jobFamily;
    this.jobLevel = props.jobLevel;
    this.employmentType = props.employmentType;
    this.status = props.status ?? 'DRAFT';
    this.filledByWorkerId = props.filledByWorkerId;
    this.headcountRequestId = props.headcountRequestId;
    this.createdAt = props.createdAt ?? new Date();
    this.updatedAt = props.updatedAt ?? new Date();

    if (props.aggregateVersion) {
      for (let i = 0; i < props.aggregateVersion; i++) {
        this.incrementVersion();
      }
    }
  }

  /**
   * Factory method that creates a new Position in DRAFT state.
   */
  static create(props: PositionProps): Position {
    const position = new Position(props);
    position.addDomainEvent(
      new PositionCreated({
        eventName: 'PositionCreated',
        tenantId: position.tenantId,
        aggregateType: 'position',
        aggregateId: position.id,
        correlationId: props.id,
      }),
    );
    return position;
  }

  /**
   * Rehydrate an existing Position without emitting creation events.
   */
  static restore(props: PositionProps): Position {
    return new Position(props);
  }

  /**
   * Activate the position (DRAFT → ACTIVE).
   */
  activate(correlationId: Uuid): void {
    if (this.status !== 'DRAFT') {
      throw new ConflictError('Position can only be activated from DRAFT state');
    }
    this.status = 'ACTIVE';
    this.bumpVersion();
    this.addDomainEvent(
      new PositionActivated({
        eventName: 'PositionActivated',
        tenantId: this.tenantId,
        aggregateType: 'position',
        aggregateId: this.id,
        correlationId,
        version: this.version,
      }),
    );
  }

  /**
   * Freeze the position (ACTIVE → FROZEN).
   */
  freeze(correlationId: Uuid): void {
    if (this.status !== 'ACTIVE') {
      throw new ConflictError('Position can only be frozen from ACTIVE state');
    }
    this.status = 'FROZEN';
    this.bumpVersion();
    this.addDomainEvent(
      new PositionFrozen({
        eventName: 'PositionFrozen',
        tenantId: this.tenantId,
        aggregateType: 'position',
        aggregateId: this.id,
        correlationId,
        version: this.version,
      }),
    );
  }

  /**
   * Unfreeze the position (FROZEN → ACTIVE).
   */
  unfreeze(correlationId: Uuid): void {
    if (this.status !== 'FROZEN') {
      throw new ConflictError('Position can only be unfrozen from FROZEN state');
    }
    this.status = 'ACTIVE';
    this.bumpVersion();
    this.addDomainEvent(
      new PositionUnfrozen({
        eventName: 'PositionUnfrozen',
        tenantId: this.tenantId,
        aggregateType: 'position',
        aggregateId: this.id,
        correlationId,
        version: this.version,
      }),
    );
  }

  /**
   * Fill the position with a worker (ACTIVE → FILLED or VACANT → FILLED).
   */
  fill(workerId: Uuid, correlationId: Uuid): void {
    if (this.status === 'FROZEN') {
      throw new ConflictError('Cannot fill a FROZEN position');
    }
    if (this.status !== 'ACTIVE' && this.status !== 'VACANT') {
      throw new ConflictError('Position can only be filled from ACTIVE or VACANT state');
    }
    this.status = 'FILLED';
    this.filledByWorkerId = workerId;
    this.bumpVersion();
    this.addDomainEvent(
      new PositionFilled({
        eventName: 'PositionFilled',
        tenantId: this.tenantId,
        aggregateType: 'position',
        aggregateId: this.id,
        correlationId,
        version: this.version,
      }),
    );
  }

  /**
   * Vacate the position (FILLED → VACANT).
   */
  vacate(correlationId: Uuid): void {
    if (this.status !== 'FILLED') {
      throw new ConflictError('Position can only be vacated from FILLED state');
    }
    this.status = 'VACANT';
    this.filledByWorkerId = undefined;
    this.bumpVersion();
    this.addDomainEvent(
      new PositionVacated({
        eventName: 'PositionVacated',
        tenantId: this.tenantId,
        aggregateType: 'position',
        aggregateId: this.id,
        correlationId,
        version: this.version,
      }),
    );
  }

  /**
   * Close the position (terminal state).
   */
  close(correlationId: Uuid): void {
    if (this.status === 'FILLED') {
      throw new ConflictError('Cannot close a FILLED position; vacate first');
    }
    if (this.status === 'CLOSED') {
      throw new ConflictError('Position is already closed');
    }
    this.status = 'CLOSED';
    this.bumpVersion();
    this.addDomainEvent(
      new PositionClosed({
        eventName: 'PositionClosed',
        tenantId: this.tenantId,
        aggregateType: 'position',
        aggregateId: this.id,
        correlationId,
        version: this.version,
      }),
    );
  }

  /**
   * Update mutable position attributes.
   */
  update(props: Partial<Pick<PositionProps, 'title' | 'departmentId' | 'legalEntityId' | 'jobFamily' | 'jobLevel' | 'employmentType'>>, correlationId: Uuid): void {
    if (props.title !== undefined) this.title = props.title;
    if (props.departmentId !== undefined) this.departmentId = props.departmentId;
    if (props.legalEntityId !== undefined) this.legalEntityId = props.legalEntityId;
    if (props.jobFamily !== undefined) this.jobFamily = props.jobFamily;
    if (props.jobLevel !== undefined) this.jobLevel = props.jobLevel;
    if (props.employmentType !== undefined) this.employmentType = props.employmentType;
    this.updatedAt = new Date();
    this.bumpVersion();
    this.addDomainEvent(
      new PositionUpdated({
        eventName: 'PositionUpdated',
        tenantId: this.tenantId,
        aggregateType: 'position',
        aggregateId: this.id,
        correlationId,
        version: this.version,
      }),
    );
  }

  private bumpVersion(): void {
    this.incrementVersion();
    this.updatedAt = new Date();
  }
}
