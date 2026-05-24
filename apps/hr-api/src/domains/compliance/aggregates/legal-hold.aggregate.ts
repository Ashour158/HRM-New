import { AggregateRoot, DomainEvent, Uuid, Guard, ValidationError } from '@hcm/shared-kernel';

/**
 * Status values for the {@link LegalHold} lifecycle.
 */
export type LegalHoldStatus = 'ACTIVE' | 'RELEASED';

/**
 * Properties required to construct a {@link LegalHold}.
 */
export interface LegalHoldProps {
  id: Uuid;
  tenantId: Uuid;
  holdName: string;
  description?: string;
  reason: string;
  affectedWorkerIds: Uuid[];
  placedBy: Uuid;
  placedAt?: Date;
  releasedBy?: Uuid;
  releasedAt?: Date;
  status?: LegalHoldStatus;
  aggregateVersion?: number;
  createdAt?: Date;
  updatedAt?: Date;
}

/* ------------------------------------------------------------------ */
/*  Domain Events                                                      */
/* ------------------------------------------------------------------ */

export class LegalHoldPlaced extends DomainEvent {
  readonly holdName: string;
  readonly reason: string;

  constructor(props: {
    tenantId: Uuid;
    aggregateId: Uuid;
    correlationId: Uuid;
    holdName: string;
    reason: string;
  }) {
    super({
      eventName: 'LegalHoldPlaced',
      tenantId: props.tenantId,
      aggregateType: 'LegalHold',
      aggregateId: props.aggregateId,
      correlationId: props.correlationId,
    });
    this.holdName = props.holdName;
    this.reason = props.reason;
  }
}

export class LegalHoldReleased extends DomainEvent {
  readonly releasedBy: string;

  constructor(props: {
    tenantId: Uuid;
    aggregateId: Uuid;
    correlationId: Uuid;
    releasedBy: Uuid;
  }) {
    super({
      eventName: 'LegalHoldReleased',
      tenantId: props.tenantId,
      aggregateType: 'LegalHold',
      aggregateId: props.aggregateId,
      correlationId: props.correlationId,
    });
    this.releasedBy = props.releasedBy.value;
  }
}

/* ------------------------------------------------------------------ */
/*  Aggregate                                                          */
/* ------------------------------------------------------------------ */

/**
 * Aggregate root representing a legal hold on worker data.
 *
 * FSM lifecycle: ACTIVE → RELEASED (terminal)
 *
 * A legal hold is immutable once placed; it blocks deletion and anonymization
 * of affected worker records until released.
 */
export class LegalHold extends AggregateRoot {
  readonly tenantId: Uuid;
  holdName: string;
  description: string;
  reason: string;
  affectedWorkerIds: Uuid[];
  placedBy: Uuid;
  placedAt: Date;
  releasedBy?: Uuid;
  releasedAt?: Date;
  status: LegalHoldStatus;
  createdAt: Date;
  updatedAt: Date;

  get aggregateVersion(): number {
    return this.version;
  }

  constructor(props: LegalHoldProps) {
    super(props.id);
    this.tenantId = props.tenantId;
    this.holdName = props.holdName;
    this.description = props.description ?? '';
    this.reason = props.reason;
    this.affectedWorkerIds = props.affectedWorkerIds;
    this.placedBy = props.placedBy;
    this.placedAt = props.placedAt ?? new Date();
    this.releasedBy = props.releasedBy;
    this.releasedAt = props.releasedAt;
    this.status = props.status ?? 'ACTIVE';
    this.createdAt = props.createdAt ?? new Date();
    this.updatedAt = props.updatedAt ?? new Date();
    if (props.aggregateVersion !== undefined) {
      this.restoreVersion(props.aggregateVersion);
    }
  }

  /**
   * Factory method to create a new LegalHold in ACTIVE state.
   */
  static create(props: LegalHoldProps, correlationId: Uuid): LegalHold {
    Guard.againstEmptyString(props.holdName, 'holdName');
    Guard.againstEmptyString(props.reason, 'reason');

    const hold = new LegalHold({
      ...props,
      status: 'ACTIVE',
      placedAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    hold.addDomainEvent(
      new LegalHoldPlaced({
        tenantId: hold.tenantId,
        aggregateId: hold.id,
        correlationId,
        holdName: hold.holdName,
        reason: hold.reason,
      }),
    );

    return hold;
  }

  /**
   * Release the legal hold (ACTIVE → RELEASED).
   *
   * Once released, deletion and anonymization of affected workers may proceed.
   */
  release(releasedBy: Uuid, correlationId: Uuid): void {
    if (this.status !== 'ACTIVE') {
      throw new ValidationError(`Cannot release legal hold from state ${this.status}`);
    }
    this.status = 'RELEASED';
    this.releasedBy = releasedBy;
    this.releasedAt = new Date();
    this.addDomainEvent(
      new LegalHoldReleased({
        tenantId: this.tenantId,
        aggregateId: this.id,
        correlationId,
        releasedBy,
      }),
    );
    this.incrementVersion();
    this.updatedAt = new Date();
  }

  /**
   * Check whether this legal hold blocks deletion for a given worker.
   */
  blocksDeletion(workerId: Uuid): boolean {
    return this.status === 'ACTIVE' && this.affectedWorkerIds.some((id) => id.value === workerId.value);
  }
}
