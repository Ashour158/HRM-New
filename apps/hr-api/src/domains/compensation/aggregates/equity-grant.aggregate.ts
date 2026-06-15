/**
 * @hrDataClassification HIGH_SENSITIVITY - salary, band, bonus, equity, pay-scale, and worker-linked compensation fields.
 */
import { AggregateRoot, DomainEvent, Uuid, Guard } from '@hcm/shared-kernel';

/**
 * Equity grant lifecycle states.
 */
export type EquityGrantStatus = 'GRANTED' | 'VESTING' | 'VESTED' | 'EXERCISED' | 'EXPIRED' | 'FORFEITED';

/**
 * Vesting schedule entry.
 */
export interface VestingScheduleEntry {
  date: Date;
  percentage: number;
  units: number;
}

/**
 * Properties required to construct an {@link EquityGrant}.
 */
export interface EquityGrantProps {
  id: Uuid;
  tenantId: Uuid;
  workerId: Uuid;
  grantType: string;
  grantDate: Date;
  vestingSchedule: VestingScheduleEntry[];
  totalUnits: number;
  vestedUnits: number;
  exercisedUnits: number;
  strikePrice?: number;
  status: EquityGrantStatus;
  aggregateVersion?: number;
  createdAt?: Date;
  updatedAt?: Date;
}

/* ------------------------------------------------------------------ */
/*  Domain Events                                                      */
/* ------------------------------------------------------------------ */

export class EquityGrantIssued extends DomainEvent {
  readonly workerId: string;
  readonly grantType: string;
  readonly totalUnits: number;

  constructor(props: { tenantId: Uuid; aggregateId: Uuid; correlationId: Uuid; workerId: Uuid; grantType: string; totalUnits: number }) {
    super({ eventName: 'EquityGrantIssued', tenantId: props.tenantId, aggregateType: 'EquityGrant', aggregateId: props.aggregateId, correlationId: props.correlationId });
    this.workerId = props.workerId.value;
    this.grantType = props.grantType;
    this.totalUnits = props.totalUnits;
  }
}

export class EquityGrantVestingStarted extends DomainEvent {
  constructor(props: { tenantId: Uuid; aggregateId: Uuid; correlationId: Uuid }) {
    super({ eventName: 'EquityGrantVestingStarted', tenantId: props.tenantId, aggregateType: 'EquityGrant', aggregateId: props.aggregateId, correlationId: props.correlationId });
  }
}

export class EquityGrantVested extends DomainEvent {
  readonly vestedUnits: number;

  constructor(props: { tenantId: Uuid; aggregateId: Uuid; correlationId: Uuid; vestedUnits: number }) {
    super({ eventName: 'EquityGrantVested', tenantId: props.tenantId, aggregateType: 'EquityGrant', aggregateId: props.aggregateId, correlationId: props.correlationId });
    this.vestedUnits = props.vestedUnits;
  }
}

export class EquityGrantExercised extends DomainEvent {
  readonly exercisedUnits: number;

  constructor(props: { tenantId: Uuid; aggregateId: Uuid; correlationId: Uuid; exercisedUnits: number }) {
    super({ eventName: 'EquityGrantExercised', tenantId: props.tenantId, aggregateType: 'EquityGrant', aggregateId: props.aggregateId, correlationId: props.correlationId });
    this.exercisedUnits = props.exercisedUnits;
  }
}

export class EquityGrantExpired extends DomainEvent {
  constructor(props: { tenantId: Uuid; aggregateId: Uuid; correlationId: Uuid }) {
    super({ eventName: 'EquityGrantExpired', tenantId: props.tenantId, aggregateType: 'EquityGrant', aggregateId: props.aggregateId, correlationId: props.correlationId });
  }
}

export class EquityGrantForfeited extends DomainEvent {
  constructor(props: { tenantId: Uuid; aggregateId: Uuid; correlationId: Uuid }) {
    super({ eventName: 'EquityGrantForfeited', tenantId: props.tenantId, aggregateType: 'EquityGrant', aggregateId: props.aggregateId, correlationId: props.correlationId });
  }
}

/* ------------------------------------------------------------------ */
/*  Aggregate                                                          */
/* ------------------------------------------------------------------ */

/**
 * Aggregate root representing an equity grant for a worker.
 *
 * FSM lifecycle: GRANTED → VESTING → VESTED → EXERCISED → EXPIRED (terminal)
 *                                        ↘ FORFEITED (terminal)
 */
export class EquityGrant extends AggregateRoot {
  readonly tenantId: Uuid;
  workerId: Uuid;
  grantType: string;
  grantDate: Date;
  vestingSchedule: VestingScheduleEntry[];
  totalUnits: number;
  vestedUnits: number;
  exercisedUnits: number;
  strikePrice?: number;
  status: EquityGrantStatus;
  readonly createdAt: Date;
  updatedAt: Date;

  get aggregateVersion(): number {
    return this.version;
  }

  constructor(props: EquityGrantProps) {
    super(props.id);
    this.tenantId = props.tenantId;
    this.workerId = props.workerId;
    this.grantType = props.grantType;
    this.grantDate = props.grantDate;
    this.vestingSchedule = props.vestingSchedule;
    this.totalUnits = props.totalUnits;
    this.vestedUnits = props.vestedUnits;
    this.exercisedUnits = props.exercisedUnits;
    this.strikePrice = props.strikePrice;
    this.status = props.status;
    this.createdAt = props.createdAt ?? new Date();
    this.updatedAt = props.updatedAt ?? new Date();
    if (props.aggregateVersion !== undefined) {
      this.restoreVersion(props.aggregateVersion);
    }
  }

  static create(props: Omit<EquityGrantProps, 'status' | 'vestedUnits' | 'exercisedUnits' | 'createdAt' | 'updatedAt' | 'aggregateVersion'> & { correlationId: Uuid }): EquityGrant {
    Guard.againstEmptyString(props.grantType, 'grantType');
    Guard.againstNegativeNumber(props.totalUnits, 'totalUnits');
    if (props.vestingSchedule.length === 0) {
      throw new Error('Vesting schedule must contain at least one entry');
    }

    const grant = new EquityGrant({
      ...props,
      status: 'GRANTED',
      vestedUnits: 0,
      exercisedUnits: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    grant.addDomainEvent(new EquityGrantIssued({ tenantId: grant.tenantId, aggregateId: grant.id, correlationId: props.correlationId, workerId: grant.workerId, grantType: grant.grantType, totalUnits: grant.totalUnits }));
    return grant;
  }

  /**
   * Start vesting (GRANTED → VESTING).
   */
  startVesting(correlationId: Uuid): void {
    if (this.status !== 'GRANTED') {
      throw new Error(`Cannot start vesting for EquityGrant from state ${this.status}`);
    }
    this.status = 'VESTING';
    this.updatedAt = new Date();
    this.incrementVersion();
    this.addDomainEvent(new EquityGrantVestingStarted({ tenantId: this.tenantId, aggregateId: this.id, correlationId }));
  }

  /**
   * Record vested units (VESTING → VESTED or VESTED → VESTED).
   */
  recordVesting(units: number, correlationId: Uuid): void {
    if (this.status !== 'VESTING' && this.status !== 'VESTED') {
      throw new Error(`Cannot record vesting for EquityGrant from state ${this.status}`);
    }
    if (units < 0 || this.vestedUnits + units > this.totalUnits) {
      throw new Error('Invalid vesting units');
    }
    this.vestedUnits += units;
    this.status = this.vestedUnits >= this.totalUnits ? 'VESTED' : 'VESTING';
    this.updatedAt = new Date();
    this.incrementVersion();
    this.addDomainEvent(new EquityGrantVested({ tenantId: this.tenantId, aggregateId: this.id, correlationId, vestedUnits: this.vestedUnits }));
  }

  /**
   * Exercise vested units (VESTED → EXERCISED).
   */
  exercise(units: number, correlationId: Uuid): void {
    if (this.status !== 'VESTED' && this.status !== 'EXERCISED') {
      throw new Error(`Cannot exercise EquityGrant from state ${this.status}`);
    }
    if (units < 0 || this.exercisedUnits + units > this.vestedUnits) {
      throw new Error('Cannot exercise more units than vested');
    }
    this.exercisedUnits += units;
    this.status = 'EXERCISED';
    this.updatedAt = new Date();
    this.incrementVersion();
    this.addDomainEvent(new EquityGrantExercised({ tenantId: this.tenantId, aggregateId: this.id, correlationId, exercisedUnits: this.exercisedUnits }));
  }

  /**
   * Expire the grant (VESTED or EXERCISED → EXPIRED).
   */
  expire(correlationId: Uuid): void {
    if (this.status !== 'VESTED' && this.status !== 'EXERCISED' && this.status !== 'GRANTED' && this.status !== 'VESTING') {
      throw new Error(`Cannot expire EquityGrant from state ${this.status}`);
    }
    this.status = 'EXPIRED';
    this.updatedAt = new Date();
    this.incrementVersion();
    this.addDomainEvent(new EquityGrantExpired({ tenantId: this.tenantId, aggregateId: this.id, correlationId }));
  }

  /**
   * Forfeit the grant (GRANTED, VESTING, or VESTED → FORFEITED).
   */
  forfeit(correlationId: Uuid): void {
    if (this.status !== 'GRANTED' && this.status !== 'VESTING' && this.status !== 'VESTED') {
      throw new Error(`Cannot forfeit EquityGrant from state ${this.status}`);
    }
    this.status = 'FORFEITED';
    this.updatedAt = new Date();
    this.incrementVersion();
    this.addDomainEvent(new EquityGrantForfeited({ tenantId: this.tenantId, aggregateId: this.id, correlationId }));
  }
}
