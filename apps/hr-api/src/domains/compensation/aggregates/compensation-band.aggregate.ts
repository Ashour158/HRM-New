/**
 * @hrDataClassification HIGH_SENSITIVITY - salary, band, bonus, equity, pay-scale, and worker-linked compensation fields.
 */
import { AggregateRoot, DomainEvent, Uuid, Guard } from '@hcm/shared-kernel';

/**
 * Compensation band lifecycle states.
 */
export type CompensationBandStatus = 'DRAFT' | 'ACTIVE' | 'REVISED' | 'CLOSED';

/**
 * Properties required to construct a {@link CompensationBand}.
 */
export interface CompensationBandProps {
  id: Uuid;
  tenantId: Uuid;
  bandCode: string;
  jobLevel: string;
  jobFamily: string;
  minSalary: number;
  midSalary: number;
  maxSalary: number;
  currency: string;
  status: CompensationBandStatus;
  aggregateVersion?: number;
  createdAt?: Date;
  updatedAt?: Date;
}

/* ------------------------------------------------------------------ */
/*  Domain Events                                                      */
/* ------------------------------------------------------------------ */

export class CompensationBandCreated extends DomainEvent {
  readonly bandCode: string;
  readonly jobLevel: string;
  readonly jobFamily: string;

  constructor(props: { tenantId: Uuid; aggregateId: Uuid; correlationId: Uuid; bandCode: string; jobLevel: string; jobFamily: string }) {
    super({ eventName: 'CompensationBandCreated', tenantId: props.tenantId, aggregateType: 'CompensationBand', aggregateId: props.aggregateId, correlationId: props.correlationId });
    this.bandCode = props.bandCode;
    this.jobLevel = props.jobLevel;
    this.jobFamily = props.jobFamily;
  }
}

export class CompensationBandActivated extends DomainEvent {
  constructor(props: { tenantId: Uuid; aggregateId: Uuid; correlationId: Uuid }) {
    super({ eventName: 'CompensationBandActivated', tenantId: props.tenantId, aggregateType: 'CompensationBand', aggregateId: props.aggregateId, correlationId: props.correlationId });
  }
}

export class CompensationBandRevised extends DomainEvent {
  readonly minSalary: number;
  readonly midSalary: number;
  readonly maxSalary: number;

  constructor(props: { tenantId: Uuid; aggregateId: Uuid; correlationId: Uuid; minSalary: number; midSalary: number; maxSalary: number }) {
    super({ eventName: 'CompensationBandRevised', tenantId: props.tenantId, aggregateType: 'CompensationBand', aggregateId: props.aggregateId, correlationId: props.correlationId });
    this.minSalary = props.minSalary;
    this.midSalary = props.midSalary;
    this.maxSalary = props.maxSalary;
  }
}

export class CompensationBandClosed extends DomainEvent {
  constructor(props: { tenantId: Uuid; aggregateId: Uuid; correlationId: Uuid }) {
    super({ eventName: 'CompensationBandClosed', tenantId: props.tenantId, aggregateType: 'CompensationBand', aggregateId: props.aggregateId, correlationId: props.correlationId });
  }
}

/* ------------------------------------------------------------------ */
/*  Aggregate                                                          */
/* ------------------------------------------------------------------ */

/**
 * Aggregate root representing a compensation band (salary range for a job level/family).
 *
 * FSM lifecycle: DRAFT → ACTIVE → REVISED → CLOSED (terminal)
 */
export class CompensationBand extends AggregateRoot {
  readonly tenantId: Uuid;
  bandCode: string;
  jobLevel: string;
  jobFamily: string;
  minSalary: number;
  midSalary: number;
  maxSalary: number;
  currency: string;
  status: CompensationBandStatus;
  readonly createdAt: Date;
  updatedAt: Date;

  get aggregateVersion(): number {
    return this.version;
  }

  constructor(props: CompensationBandProps) {
    super(props.id);
    this.tenantId = props.tenantId;
    this.bandCode = props.bandCode;
    this.jobLevel = props.jobLevel;
    this.jobFamily = props.jobFamily;
    this.minSalary = props.minSalary;
    this.midSalary = props.midSalary;
    this.maxSalary = props.maxSalary;
    this.currency = props.currency;
    this.status = props.status;
    this.createdAt = props.createdAt ?? new Date();
    this.updatedAt = props.updatedAt ?? new Date();
    if (props.aggregateVersion !== undefined) {
      this.restoreVersion(props.aggregateVersion);
    }
  }

  static create(props: Omit<CompensationBandProps, 'status' | 'createdAt' | 'updatedAt' | 'aggregateVersion'> & { correlationId: Uuid }): CompensationBand {
    Guard.againstEmptyString(props.bandCode, 'bandCode');
    Guard.againstEmptyString(props.jobLevel, 'jobLevel');
    Guard.againstEmptyString(props.jobFamily, 'jobFamily');
    Guard.againstNegativeNumber(props.minSalary, 'minSalary');
    Guard.againstNegativeNumber(props.midSalary, 'midSalary');
    Guard.againstNegativeNumber(props.maxSalary, 'maxSalary');

    const band = new CompensationBand({
      ...props,
      status: 'DRAFT',
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    band.addDomainEvent(new CompensationBandCreated({ tenantId: band.tenantId, aggregateId: band.id, correlationId: props.correlationId, bandCode: band.bandCode, jobLevel: band.jobLevel, jobFamily: band.jobFamily }));
    return band;
  }

  /**
   * Activate the band (DRAFT → ACTIVE).
   */
  activate(correlationId: Uuid): void {
    if (this.status !== 'DRAFT') {
      throw new Error(`Cannot activate CompensationBand from state ${this.status}`);
    }
    this.status = 'ACTIVE';
    this.updatedAt = new Date();
    this.incrementVersion();
    this.addDomainEvent(new CompensationBandActivated({ tenantId: this.tenantId, aggregateId: this.id, correlationId }));
  }

  /**
   * Revise salary ranges (ACTIVE → REVISED or REVISED → REVISED).
   */
  revise(props: { minSalary: number; midSalary: number; maxSalary: number }, correlationId: Uuid): void {
    if (this.status !== 'ACTIVE' && this.status !== 'REVISED') {
      throw new Error(`Cannot revise CompensationBand from state ${this.status}`);
    }
    Guard.againstNegativeNumber(props.minSalary, 'minSalary');
    Guard.againstNegativeNumber(props.midSalary, 'midSalary');
    Guard.againstNegativeNumber(props.maxSalary, 'maxSalary');
    this.minSalary = props.minSalary;
    this.midSalary = props.midSalary;
    this.maxSalary = props.maxSalary;
    this.status = 'REVISED';
    this.updatedAt = new Date();
    this.incrementVersion();
    this.addDomainEvent(new CompensationBandRevised({ tenantId: this.tenantId, aggregateId: this.id, correlationId, minSalary: this.minSalary, midSalary: this.midSalary, maxSalary: this.maxSalary }));
  }

  /**
   * Close the band (ACTIVE or REVISED → CLOSED).
   */
  close(correlationId: Uuid): void {
    if (this.status !== 'ACTIVE' && this.status !== 'REVISED') {
      throw new Error(`Cannot close CompensationBand from state ${this.status}`);
    }
    this.status = 'CLOSED';
    this.updatedAt = new Date();
    this.incrementVersion();
    this.addDomainEvent(new CompensationBandClosed({ tenantId: this.tenantId, aggregateId: this.id, correlationId }));
  }
}
