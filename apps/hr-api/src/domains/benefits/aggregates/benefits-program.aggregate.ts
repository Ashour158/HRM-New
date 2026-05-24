import { AggregateRoot, DomainEvent, Uuid, Guard } from '@hcm/shared-kernel';

/**
 * Benefits program lifecycle states.
 */
export type BenefitsProgramStatus = 'DRAFT' | 'ACTIVE' | 'SUSPENDED' | 'CLOSED';

/**
 * Properties required to construct a {@link BenefitsProgram}.
 */
export interface BenefitsProgramProps {
  id: Uuid;
  tenantId: Uuid;
  programName: string;
  programType: string;
  carrierId?: Uuid;
  effectiveFrom?: Date;
  effectiveUntil?: Date;
  status: BenefitsProgramStatus;
  aggregateVersion?: number;
  createdAt?: Date;
  updatedAt?: Date;
}

/* ------------------------------------------------------------------ */
/*  Domain Events                                                      */
/* ------------------------------------------------------------------ */

export class BenefitsProgramCreated extends DomainEvent {
  readonly programName: string;
  readonly programType: string;

  constructor(props: { tenantId: Uuid; aggregateId: Uuid; correlationId: Uuid; programName: string; programType: string }) {
    super({ eventName: 'BenefitsProgramCreated', tenantId: props.tenantId, aggregateType: 'BenefitsProgram', aggregateId: props.aggregateId, correlationId: props.correlationId });
    this.programName = props.programName;
    this.programType = props.programType;
  }
}

export class BenefitsProgramActivated extends DomainEvent {
  constructor(props: { tenantId: Uuid; aggregateId: Uuid; correlationId: Uuid }) {
    super({ eventName: 'BenefitsProgramActivated', tenantId: props.tenantId, aggregateType: 'BenefitsProgram', aggregateId: props.aggregateId, correlationId: props.correlationId });
  }
}

export class BenefitsProgramSuspended extends DomainEvent {
  constructor(props: { tenantId: Uuid; aggregateId: Uuid; correlationId: Uuid }) {
    super({ eventName: 'BenefitsProgramSuspended', tenantId: props.tenantId, aggregateType: 'BenefitsProgram', aggregateId: props.aggregateId, correlationId: props.correlationId });
  }
}

export class BenefitsProgramClosed extends DomainEvent {
  constructor(props: { tenantId: Uuid; aggregateId: Uuid; correlationId: Uuid }) {
    super({ eventName: 'BenefitsProgramClosed', tenantId: props.tenantId, aggregateType: 'BenefitsProgram', aggregateId: props.aggregateId, correlationId: props.correlationId });
  }
}

/* ------------------------------------------------------------------ */
/*  Aggregate                                                          */
/* ------------------------------------------------------------------ */

/**
 * Aggregate root representing a benefits program.
 *
 * FSM lifecycle: DRAFT → ACTIVE → SUSPENDED → CLOSED (terminal)
 */
export class BenefitsProgram extends AggregateRoot {
  readonly tenantId: Uuid;
  programName: string;
  programType: string;
  carrierId?: Uuid;
  effectiveFrom?: Date;
  effectiveUntil?: Date;
  status: BenefitsProgramStatus;
  readonly createdAt: Date;
  updatedAt: Date;

  get aggregateVersion(): number {
    return this.version;
  }

  constructor(props: BenefitsProgramProps) {
    super(props.id);
    this.tenantId = props.tenantId;
    this.programName = props.programName;
    this.programType = props.programType;
    this.carrierId = props.carrierId;
    this.effectiveFrom = props.effectiveFrom;
    this.effectiveUntil = props.effectiveUntil;
    this.status = props.status;
    this.createdAt = props.createdAt ?? new Date();
    this.updatedAt = props.updatedAt ?? new Date();
    if (props.aggregateVersion !== undefined) {
      this.restoreVersion(props.aggregateVersion);
    }
  }

  static create(props: Omit<BenefitsProgramProps, 'status' | 'createdAt' | 'updatedAt' | 'aggregateVersion'> & { correlationId: Uuid }): BenefitsProgram {
    Guard.againstEmptyString(props.programName, 'programName');
    Guard.againstEmptyString(props.programType, 'programType');

    const program = new BenefitsProgram({
      ...props,
      status: 'DRAFT',
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    program.addDomainEvent(new BenefitsProgramCreated({ tenantId: program.tenantId, aggregateId: program.id, correlationId: props.correlationId, programName: program.programName, programType: program.programType }));
    return program;
  }

  activate(correlationId: Uuid): void {
    if (this.status !== 'DRAFT' && this.status !== 'SUSPENDED') {
      throw new Error(`Cannot activate BenefitsProgram from state ${this.status}`);
    }
    this.status = 'ACTIVE';
    this.updatedAt = new Date();
    this.incrementVersion();
    this.addDomainEvent(new BenefitsProgramActivated({ tenantId: this.tenantId, aggregateId: this.id, correlationId }));
  }

  suspend(correlationId: Uuid): void {
    if (this.status !== 'ACTIVE') {
      throw new Error(`Cannot suspend BenefitsProgram from state ${this.status}`);
    }
    this.status = 'SUSPENDED';
    this.updatedAt = new Date();
    this.incrementVersion();
    this.addDomainEvent(new BenefitsProgramSuspended({ tenantId: this.tenantId, aggregateId: this.id, correlationId }));
  }

  close(correlationId: Uuid): void {
    if (this.status !== 'ACTIVE' && this.status !== 'SUSPENDED') {
      throw new Error(`Cannot close BenefitsProgram from state ${this.status}`);
    }
    this.status = 'CLOSED';
    this.updatedAt = new Date();
    this.incrementVersion();
    this.addDomainEvent(new BenefitsProgramClosed({ tenantId: this.tenantId, aggregateId: this.id, correlationId }));
  }
}
