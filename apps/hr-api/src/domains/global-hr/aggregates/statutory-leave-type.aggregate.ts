import { AggregateRoot, DomainEvent, Uuid, Guard, ValidationError } from '@hcm/shared-kernel';

/**
 * Status values for the {@link StatutoryLeaveType} lifecycle.
 */
export type StatutoryLeaveTypeStatus = 'ACTIVE' | 'SUPERSEDED';

/**
 * Properties required to construct a {@link StatutoryLeaveType}.
 */
export interface StatutoryLeaveTypeProps {
  id: Uuid;
  tenantId: Uuid;
  countryCode: string;
  leaveTypeCode: string;
  leaveTypeName: string;
  minimumEntitlement: number;
  unit: string;
  carryoverAllowed: boolean;
  maxCarryover: number;
  effectiveFrom: Date;
  status?: StatutoryLeaveTypeStatus;
  aggregateVersion?: number;
  createdAt?: Date;
  updatedAt?: Date;
}

/* ------------------------------------------------------------------ */
/*  Domain Events                                                      */
/* ------------------------------------------------------------------ */

export class StatutoryLeaveTypeCreated extends DomainEvent {
  readonly countryCode: string;
  readonly leaveTypeCode: string;

  constructor(props: {
    tenantId: Uuid;
    aggregateId: Uuid;
    correlationId: Uuid;
    countryCode: string;
    leaveTypeCode: string;
  }) {
    super({
      eventName: 'StatutoryLeaveTypeCreated',
      tenantId: props.tenantId,
      aggregateType: 'StatutoryLeaveType',
      aggregateId: props.aggregateId,
      correlationId: props.correlationId,
    });
    this.countryCode = props.countryCode;
    this.leaveTypeCode = props.leaveTypeCode;
  }
}

export class StatutoryLeaveTypeUpdated extends DomainEvent {
  readonly fields: string[];

  constructor(props: {
    tenantId: Uuid;
    aggregateId: Uuid;
    correlationId: Uuid;
    fields: string[];
  }) {
    super({
      eventName: 'StatutoryLeaveTypeUpdated',
      tenantId: props.tenantId,
      aggregateType: 'StatutoryLeaveType',
      aggregateId: props.aggregateId,
      correlationId: props.correlationId,
    });
    this.fields = props.fields;
  }
}

export class StatutoryLeaveTypeSuperseded extends DomainEvent {
  readonly countryCode: string;

  constructor(props: { tenantId: Uuid; aggregateId: Uuid; correlationId: Uuid; countryCode: string }) {
    super({
      eventName: 'StatutoryLeaveTypeSuperseded',
      tenantId: props.tenantId,
      aggregateType: 'StatutoryLeaveType',
      aggregateId: props.aggregateId,
      correlationId: props.correlationId,
    });
    this.countryCode = props.countryCode;
  }
}

/* ------------------------------------------------------------------ */
/*  Aggregate                                                          */
/* ------------------------------------------------------------------ */

/**
 * Aggregate root representing a statutory leave type for a country.
 *
 * FSM lifecycle: ACTIVE → SUPERSEDED (terminal)
 *
 * No country-specific entitlement values are hardcoded; all values are
 * loaded from external rule configuration.
 */
export class StatutoryLeaveType extends AggregateRoot {
  readonly tenantId: Uuid;
  countryCode: string;
  leaveTypeCode: string;
  leaveTypeName: string;
  minimumEntitlement: number;
  unit: string;
  carryoverAllowed: boolean;
  maxCarryover: number;
  effectiveFrom: Date;
  status: StatutoryLeaveTypeStatus;
  createdAt: Date;
  updatedAt: Date;

  get aggregateVersion(): number {
    return this.version;
  }

  constructor(props: StatutoryLeaveTypeProps) {
    super(props.id);
    this.tenantId = props.tenantId;
    this.countryCode = props.countryCode;
    this.leaveTypeCode = props.leaveTypeCode;
    this.leaveTypeName = props.leaveTypeName;
    this.minimumEntitlement = props.minimumEntitlement;
    this.unit = props.unit;
    this.carryoverAllowed = props.carryoverAllowed;
    this.maxCarryover = props.maxCarryover;
    this.effectiveFrom = props.effectiveFrom;
    this.status = props.status ?? 'ACTIVE';
    this.createdAt = props.createdAt ?? new Date();
    this.updatedAt = props.updatedAt ?? new Date();
    if (props.aggregateVersion !== undefined) {
      this.restoreVersion(props.aggregateVersion);
    }
  }

  /**
   * Factory method to create a new StatutoryLeaveType in ACTIVE state.
   */
  static create(props: StatutoryLeaveTypeProps, correlationId: Uuid): StatutoryLeaveType {
    Guard.againstEmptyString(props.countryCode, 'countryCode');
    Guard.againstEmptyString(props.leaveTypeCode, 'leaveTypeCode');
    Guard.againstNegativeNumber(props.minimumEntitlement, 'minimumEntitlement');

    const leaveType = new StatutoryLeaveType({
      ...props,
      status: 'ACTIVE',
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    leaveType.addDomainEvent(
      new StatutoryLeaveTypeCreated({
        tenantId: leaveType.tenantId,
        aggregateId: leaveType.id,
        correlationId,
        countryCode: leaveType.countryCode,
        leaveTypeCode: leaveType.leaveTypeCode,
      }),
    );

    return leaveType;
  }

  /**
   * Update mutable properties.
   */
  update(
    props: {
      leaveTypeName?: string;
      minimumEntitlement?: number;
      unit?: string;
      carryoverAllowed?: boolean;
      maxCarryover?: number;
    },
    correlationId: Uuid,
  ): void {
    if (this.status !== 'ACTIVE') {
      throw new ValidationError(`Cannot update from state ${this.status}`);
    }
    const fields: string[] = [];
    if (props.leaveTypeName !== undefined) {
      this.leaveTypeName = props.leaveTypeName;
      fields.push('leaveTypeName');
    }
    if (props.minimumEntitlement !== undefined) {
      this.minimumEntitlement = props.minimumEntitlement;
      fields.push('minimumEntitlement');
    }
    if (props.unit !== undefined) {
      this.unit = props.unit;
      fields.push('unit');
    }
    if (props.carryoverAllowed !== undefined) {
      this.carryoverAllowed = props.carryoverAllowed;
      fields.push('carryoverAllowed');
    }
    if (props.maxCarryover !== undefined) {
      this.maxCarryover = props.maxCarryover;
      fields.push('maxCarryover');
    }
    if (fields.length > 0) {
      this.addDomainEvent(
        new StatutoryLeaveTypeUpdated({
          tenantId: this.tenantId,
          aggregateId: this.id,
          correlationId,
          fields,
        }),
      );
      this.incrementVersion();
      this.updatedAt = new Date();
    }
  }

  /**
   * Supersede the leave type (ACTIVE → SUPERSEDED).
   */
  supersede(correlationId: Uuid): void {
    if (this.status !== 'ACTIVE') {
      throw new ValidationError(`Cannot supersede from state ${this.status}`);
    }
    this.status = 'SUPERSEDED';
    this.addDomainEvent(
      new StatutoryLeaveTypeSuperseded({
        tenantId: this.tenantId,
        aggregateId: this.id,
        correlationId,
        countryCode: this.countryCode,
      }),
    );
    this.incrementVersion();
    this.updatedAt = new Date();
  }
}
