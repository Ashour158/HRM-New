/**
 * @hrDataClassification HIGH_SENSITIVITY - immigration, work authorization, statutory leave, international assignment, consultation, and country-rule fields.
 */
import { AggregateRoot, DomainEvent, Uuid, Guard, ValidationError } from '@hcm/shared-kernel';

/**
 * Status values for the {@link CountryRuleSet} lifecycle.
 */
export type CountryRuleSetStatus = 'DRAFT' | 'ACTIVE' | 'SUPERSEDED' | 'RETIRED';

/**
 * Properties required to construct a {@link CountryRuleSet}.
 */
export interface CountryRuleSetProps {
  id: Uuid;
  tenantId: Uuid;
  countryCode: string;
  ruleSetType: string;
  ruleSetVersion: string;
  effectiveFrom: Date;
  effectiveUntil?: Date;
  rules: Record<string, unknown>;
  status?: CountryRuleSetStatus;
  aggregateVersion?: number;
  createdAt?: Date;
  updatedAt?: Date;
}

/* ------------------------------------------------------------------ */
/*  Domain Events                                                      */
/* ------------------------------------------------------------------ */

export class CountryRuleSetCreated extends DomainEvent {
  readonly countryCode: string;
  readonly ruleSetType: string;

  constructor(props: {
    tenantId: Uuid;
    aggregateId: Uuid;
    correlationId: Uuid;
    countryCode: string;
    ruleSetType: string;
  }) {
    super({
      eventName: 'CountryRuleSetCreated',
      tenantId: props.tenantId,
      aggregateType: 'CountryRuleSet',
      aggregateId: props.aggregateId,
      correlationId: props.correlationId,
    });
    this.countryCode = props.countryCode;
    this.ruleSetType = props.ruleSetType;
  }
}

export class CountryRuleSetActivated extends DomainEvent {
  readonly countryCode: string;

  constructor(props: { tenantId: Uuid; aggregateId: Uuid; correlationId: Uuid; countryCode: string }) {
    super({
      eventName: 'CountryRuleSetActivated',
      tenantId: props.tenantId,
      aggregateType: 'CountryRuleSet',
      aggregateId: props.aggregateId,
      correlationId: props.correlationId,
    });
    this.countryCode = props.countryCode;
  }
}

export class CountryRuleSetSuperseded extends DomainEvent {
  readonly countryCode: string;
  readonly supersededBy?: string;

  constructor(props: {
    tenantId: Uuid;
    aggregateId: Uuid;
    correlationId: Uuid;
    countryCode: string;
    supersededBy?: string;
  }) {
    super({
      eventName: 'CountryRuleSetSuperseded',
      tenantId: props.tenantId,
      aggregateType: 'CountryRuleSet',
      aggregateId: props.aggregateId,
      correlationId: props.correlationId,
    });
    this.countryCode = props.countryCode;
    this.supersededBy = props.supersededBy;
  }
}

export class CountryRuleSetRetired extends DomainEvent {
  readonly countryCode: string;

  constructor(props: { tenantId: Uuid; aggregateId: Uuid; correlationId: Uuid; countryCode: string }) {
    super({
      eventName: 'CountryRuleSetRetired',
      tenantId: props.tenantId,
      aggregateType: 'CountryRuleSet',
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
 * Aggregate root representing a set of country-specific rules.
 *
 * FSM lifecycle: DRAFT → ACTIVE → SUPERSEDED (terminal) | RETIRED (terminal)
 *
 * No country-specific values are hardcoded in application code;
 * all rules are stored as external configuration.
 */
export class CountryRuleSet extends AggregateRoot {
  readonly tenantId: Uuid;
  countryCode: string;
  ruleSetType: string;
  ruleSetVersion: string;
  effectiveFrom: Date;
  effectiveUntil?: Date;
  rules: Record<string, unknown>;
  status: CountryRuleSetStatus;
  createdAt: Date;
  updatedAt: Date;

  get aggregateVersion(): number {
    return this.version;
  }

  constructor(props: CountryRuleSetProps) {
    super(props.id);
    this.tenantId = props.tenantId;
    this.countryCode = props.countryCode;
    this.ruleSetType = props.ruleSetType;
    this.ruleSetVersion = props.ruleSetVersion;
    this.effectiveFrom = props.effectiveFrom;
    this.effectiveUntil = props.effectiveUntil;
    this.rules = props.rules;
    this.status = props.status ?? 'DRAFT';
    this.createdAt = props.createdAt ?? new Date();
    this.updatedAt = props.updatedAt ?? new Date();
    if (props.aggregateVersion !== undefined) {
      this.restoreVersion(props.aggregateVersion);
    }
  }

  /**
   * Factory method to create a new CountryRuleSet in DRAFT state.
   */
  static create(props: CountryRuleSetProps, correlationId: Uuid): CountryRuleSet {
    Guard.againstEmptyString(props.countryCode, 'countryCode');
    Guard.againstEmptyString(props.ruleSetType, 'ruleSetType');

    const ruleSet = new CountryRuleSet({
      ...props,
      status: 'DRAFT',
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    ruleSet.addDomainEvent(
      new CountryRuleSetCreated({
        tenantId: ruleSet.tenantId,
        aggregateId: ruleSet.id,
        correlationId,
        countryCode: ruleSet.countryCode,
        ruleSetType: ruleSet.ruleSetType,
      }),
    );

    return ruleSet;
  }

  /**
   * Activate the rule set (DRAFT → ACTIVE).
   */
  activate(correlationId: Uuid): void {
    if (this.status !== 'DRAFT') {
      throw new ValidationError(`Cannot activate from state ${this.status}`);
    }
    this.status = 'ACTIVE';
    this.addDomainEvent(
      new CountryRuleSetActivated({
        tenantId: this.tenantId,
        aggregateId: this.id,
        correlationId,
        countryCode: this.countryCode,
      }),
    );
    this.incrementVersion();
    this.updatedAt = new Date();
  }

  /**
   * Supersede the rule set (ACTIVE → SUPERSEDED).
   */
  supersede(correlationId: Uuid, supersededBy?: string): void {
    if (this.status !== 'ACTIVE') {
      throw new ValidationError(`Cannot supersede from state ${this.status}`);
    }
    this.status = 'SUPERSEDED';
    this.addDomainEvent(
      new CountryRuleSetSuperseded({
        tenantId: this.tenantId,
        aggregateId: this.id,
        correlationId,
        countryCode: this.countryCode,
        supersededBy,
      }),
    );
    this.incrementVersion();
    this.updatedAt = new Date();
  }

  /**
   * Retire the rule set (ACTIVE → RETIRED).
   */
  retire(correlationId: Uuid): void {
    if (this.status !== 'ACTIVE') {
      throw new ValidationError(`Cannot retire from state ${this.status}`);
    }
    this.status = 'RETIRED';
    this.addDomainEvent(
      new CountryRuleSetRetired({
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
