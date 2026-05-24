import { AggregateRoot, DomainEvent, Uuid, ValidationError } from '@hcm/shared-kernel';

/**
 * Status values for the {@link CountryPolicyValidationRun} lifecycle.
 */
export type CountryPolicyValidationRunStatus = 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'FAILED';

/**
 * Properties required to construct a {@link CountryPolicyValidationRun}.
 */
export interface CountryPolicyValidationRunProps {
  id: Uuid;
  tenantId: Uuid;
  policyPackId: Uuid;
  validationType: string;
  results?: Record<string, unknown>;
  errors?: Record<string, unknown>;
  startedAt?: Date;
  completedAt?: Date;
  status?: CountryPolicyValidationRunStatus;
  aggregateVersion?: number;
  createdAt?: Date;
  updatedAt?: Date;
}

/* ------------------------------------------------------------------ */
/*  Domain Events                                                      */
/* ------------------------------------------------------------------ */

export class ValidationRunStarted extends DomainEvent {
  readonly policyPackId: string;
  readonly validationType: string;

  constructor(props: {
    tenantId: Uuid;
    aggregateId: Uuid;
    correlationId: Uuid;
    policyPackId: Uuid;
    validationType: string;
  }) {
    super({
      eventName: 'ValidationRunStarted',
      tenantId: props.tenantId,
      aggregateType: 'CountryPolicyValidationRun',
      aggregateId: props.aggregateId,
      correlationId: props.correlationId,
    });
    this.policyPackId = props.policyPackId.value;
    this.validationType = props.validationType;
  }
}

export class ValidationRunCompleted extends DomainEvent {
  readonly policyPackId: string;

  constructor(props: {
    tenantId: Uuid;
    aggregateId: Uuid;
    correlationId: Uuid;
    policyPackId: Uuid;
  }) {
    super({
      eventName: 'ValidationRunCompleted',
      tenantId: props.tenantId,
      aggregateType: 'CountryPolicyValidationRun',
      aggregateId: props.aggregateId,
      correlationId: props.correlationId,
    });
    this.policyPackId = props.policyPackId.value;
  }
}

export class ValidationRunFailed extends DomainEvent {
  readonly policyPackId: string;
  readonly reason: string;

  constructor(props: {
    tenantId: Uuid;
    aggregateId: Uuid;
    correlationId: Uuid;
    policyPackId: Uuid;
    reason: string;
  }) {
    super({
      eventName: 'ValidationRunFailed',
      tenantId: props.tenantId,
      aggregateType: 'CountryPolicyValidationRun',
      aggregateId: props.aggregateId,
      correlationId: props.correlationId,
    });
    this.policyPackId = props.policyPackId.value;
    this.reason = props.reason;
  }
}

/* ------------------------------------------------------------------ */
/*  Aggregate                                                          */
/* ------------------------------------------------------------------ */

/**
 * Aggregate root representing a validation run for a country policy pack.
 *
 * FSM lifecycle: PENDING → IN_PROGRESS → COMPLETED | FAILED (terminal)
 */
export class CountryPolicyValidationRun extends AggregateRoot {
  readonly tenantId: Uuid;
  policyPackId: Uuid;
  validationType: string;
  results: Record<string, unknown>;
  errors: Record<string, unknown>;
  startedAt?: Date;
  completedAt?: Date;
  status: CountryPolicyValidationRunStatus;
  createdAt: Date;
  updatedAt: Date;

  get aggregateVersion(): number {
    return this.version;
  }

  constructor(props: CountryPolicyValidationRunProps) {
    super(props.id);
    this.tenantId = props.tenantId;
    this.policyPackId = props.policyPackId;
    this.validationType = props.validationType;
    this.results = props.results ?? {};
    this.errors = props.errors ?? {};
    this.startedAt = props.startedAt;
    this.completedAt = props.completedAt;
    this.status = props.status ?? 'PENDING';
    this.createdAt = props.createdAt ?? new Date();
    this.updatedAt = props.updatedAt ?? new Date();
    if (props.aggregateVersion !== undefined) {
      this.restoreVersion(props.aggregateVersion);
    }
  }

  /**
   * Factory method to create a new CountryPolicyValidationRun in PENDING state.
   */
  static create(props: CountryPolicyValidationRunProps, _correlationId: Uuid): CountryPolicyValidationRun {
    const run = new CountryPolicyValidationRun({
      ...props,
      status: 'PENDING',
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    return run;
  }

  /**
   * Start the validation run (PENDING → IN_PROGRESS).
   */
  start(correlationId: Uuid): void {
    if (this.status !== 'PENDING') {
      throw new ValidationError(`Cannot start from state ${this.status}`);
    }
    this.status = 'IN_PROGRESS';
    this.startedAt = new Date();
    this.addDomainEvent(
      new ValidationRunStarted({
        tenantId: this.tenantId,
        aggregateId: this.id,
        correlationId,
        policyPackId: this.policyPackId,
        validationType: this.validationType,
      }),
    );
    this.incrementVersion();
    this.updatedAt = new Date();
  }

  /**
   * Complete the validation run (IN_PROGRESS → COMPLETED).
   */
  complete(correlationId: Uuid, results: Record<string, unknown>): void {
    if (this.status !== 'IN_PROGRESS') {
      throw new ValidationError(`Cannot complete from state ${this.status}`);
    }
    this.status = 'COMPLETED';
    this.results = results;
    this.completedAt = new Date();
    this.addDomainEvent(
      new ValidationRunCompleted({
        tenantId: this.tenantId,
        aggregateId: this.id,
        correlationId,
        policyPackId: this.policyPackId,
      }),
    );
    this.incrementVersion();
    this.updatedAt = new Date();
  }

  /**
   * Fail the validation run (IN_PROGRESS → FAILED).
   */
  fail(correlationId: Uuid, reason: string, errors: Record<string, unknown>): void {
    if (this.status !== 'IN_PROGRESS') {
      throw new ValidationError(`Cannot fail from state ${this.status}`);
    }
    this.status = 'FAILED';
    this.errors = errors;
    this.completedAt = new Date();
    this.addDomainEvent(
      new ValidationRunFailed({
        tenantId: this.tenantId,
        aggregateId: this.id,
        correlationId,
        policyPackId: this.policyPackId,
        reason,
      }),
    );
    this.incrementVersion();
    this.updatedAt = new Date();
  }
}
