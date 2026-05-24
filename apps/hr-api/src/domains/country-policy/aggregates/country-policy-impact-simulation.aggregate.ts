import { AggregateRoot, DomainEvent, Uuid, ValidationError } from '@hcm/shared-kernel';

/**
 * Status values for the {@link CountryPolicyImpactSimulation} lifecycle.
 */
export type CountryPolicyImpactSimulationStatus = 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'FAILED';

/**
 * Risk level of the impact simulation.
 */
export type ImpactSimulationRiskLevel = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

/**
 * Properties required to construct a {@link CountryPolicyImpactSimulation}.
 */
export interface CountryPolicyImpactSimulationProps {
  id: Uuid;
  tenantId: Uuid;
  policyPackId: Uuid;
  impactedWorkers?: string[];
  impactedPayrollRuns?: string[];
  impactedTaxAssignments?: string[];
  impactedLeaveBalances?: string[];
  impactedBenefits?: string[];
  riskLevel?: ImpactSimulationRiskLevel;
  results?: Record<string, unknown>;
  status?: CountryPolicyImpactSimulationStatus;
  aggregateVersion?: number;
  createdAt?: Date;
  updatedAt?: Date;
}

/* ------------------------------------------------------------------ */
/*  Domain Events                                                      */
/* ------------------------------------------------------------------ */

export class ImpactSimulationStarted extends DomainEvent {
  readonly policyPackId: string;

  constructor(props: {
    tenantId: Uuid;
    aggregateId: Uuid;
    correlationId: Uuid;
    policyPackId: Uuid;
  }) {
    super({
      eventName: 'ImpactSimulationStarted',
      tenantId: props.tenantId,
      aggregateType: 'CountryPolicyImpactSimulation',
      aggregateId: props.aggregateId,
      correlationId: props.correlationId,
    });
    this.policyPackId = props.policyPackId.value;
  }
}

export class ImpactSimulationCompleted extends DomainEvent {
  readonly policyPackId: string;
  readonly riskLevel: string;

  constructor(props: {
    tenantId: Uuid;
    aggregateId: Uuid;
    correlationId: Uuid;
    policyPackId: Uuid;
    riskLevel: string;
  }) {
    super({
      eventName: 'ImpactSimulationCompleted',
      tenantId: props.tenantId,
      aggregateType: 'CountryPolicyImpactSimulation',
      aggregateId: props.aggregateId,
      correlationId: props.correlationId,
    });
    this.policyPackId = props.policyPackId.value;
    this.riskLevel = props.riskLevel;
  }
}

export class ImpactSimulationFailed extends DomainEvent {
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
      eventName: 'ImpactSimulationFailed',
      tenantId: props.tenantId,
      aggregateType: 'CountryPolicyImpactSimulation',
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
 * Aggregate root representing an impact simulation for a country policy pack.
 *
 * FSM lifecycle: PENDING → IN_PROGRESS → COMPLETED | FAILED (terminal)
 */
export class CountryPolicyImpactSimulation extends AggregateRoot {
  readonly tenantId: Uuid;
  policyPackId: Uuid;
  impactedWorkers: string[];
  impactedPayrollRuns: string[];
  impactedTaxAssignments: string[];
  impactedLeaveBalances: string[];
  impactedBenefits: string[];
  riskLevel?: ImpactSimulationRiskLevel;
  results: Record<string, unknown>;
  status: CountryPolicyImpactSimulationStatus;
  createdAt: Date;
  updatedAt: Date;

  get aggregateVersion(): number {
    return this.version;
  }

  constructor(props: CountryPolicyImpactSimulationProps) {
    super(props.id);
    this.tenantId = props.tenantId;
    this.policyPackId = props.policyPackId;
    this.impactedWorkers = props.impactedWorkers ?? [];
    this.impactedPayrollRuns = props.impactedPayrollRuns ?? [];
    this.impactedTaxAssignments = props.impactedTaxAssignments ?? [];
    this.impactedLeaveBalances = props.impactedLeaveBalances ?? [];
    this.impactedBenefits = props.impactedBenefits ?? [];
    this.riskLevel = props.riskLevel;
    this.results = props.results ?? {};
    this.status = props.status ?? 'PENDING';
    this.createdAt = props.createdAt ?? new Date();
    this.updatedAt = props.updatedAt ?? new Date();
    if (props.aggregateVersion !== undefined) {
      this.restoreVersion(props.aggregateVersion);
    }
  }

  /**
   * Factory method to create a new CountryPolicyImpactSimulation in PENDING state.
   */
  static create(
    props: CountryPolicyImpactSimulationProps,
    _correlationId: Uuid,
  ): CountryPolicyImpactSimulation {
    const sim = new CountryPolicyImpactSimulation({
      ...props,
      status: 'PENDING',
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    return sim;
  }

  /**
   * Start the simulation (PENDING → IN_PROGRESS).
   */
  start(correlationId: Uuid): void {
    if (this.status !== 'PENDING') {
      throw new ValidationError(`Cannot start from state ${this.status}`);
    }
    this.status = 'IN_PROGRESS';
    this.addDomainEvent(
      new ImpactSimulationStarted({
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
   * Complete the simulation (IN_PROGRESS → COMPLETED).
   */
  complete(
    correlationId: Uuid,
    results: Record<string, unknown>,
    riskLevel: ImpactSimulationRiskLevel,
    impacted: {
      workers?: string[];
      payrollRuns?: string[];
      taxAssignments?: string[];
      leaveBalances?: string[];
      benefits?: string[];
    },
  ): void {
    if (this.status !== 'IN_PROGRESS') {
      throw new ValidationError(`Cannot complete from state ${this.status}`);
    }
    this.status = 'COMPLETED';
    this.results = results;
    this.riskLevel = riskLevel;
    this.impactedWorkers = impacted.workers ?? [];
    this.impactedPayrollRuns = impacted.payrollRuns ?? [];
    this.impactedTaxAssignments = impacted.taxAssignments ?? [];
    this.impactedLeaveBalances = impacted.leaveBalances ?? [];
    this.impactedBenefits = impacted.benefits ?? [];
    this.addDomainEvent(
      new ImpactSimulationCompleted({
        tenantId: this.tenantId,
        aggregateId: this.id,
        correlationId,
        policyPackId: this.policyPackId,
        riskLevel,
      }),
    );
    this.incrementVersion();
    this.updatedAt = new Date();
  }

  /**
   * Fail the simulation (IN_PROGRESS → FAILED).
   */
  fail(correlationId: Uuid, reason: string): void {
    if (this.status !== 'IN_PROGRESS') {
      throw new ValidationError(`Cannot fail from state ${this.status}`);
    }
    this.status = 'FAILED';
    this.addDomainEvent(
      new ImpactSimulationFailed({
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
