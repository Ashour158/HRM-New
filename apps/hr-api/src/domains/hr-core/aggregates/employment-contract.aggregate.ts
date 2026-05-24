import { AggregateRoot, DomainEvent, Uuid, ValidationError } from '@hcm/shared-kernel';

export type EmploymentContractState = 'DRAFT' | 'OFFERED' | 'SIGNED' | 'ACTIVE' | 'EXPIRED' | 'TERMINATED';

export interface EmploymentContractProps {
  id: Uuid;
  tenantId: Uuid;
  workerId: Uuid;
  contractType: string;
  startDate: Date;
  endDate?: Date;
  terms?: Record<string, unknown>;
  signedAt?: Date;
  state: EmploymentContractState;
  aggregateVersion?: number;
  createdAt?: Date;
  updatedAt?: Date;
}

/* ------------------------------------------------------------------ */
/*  Domain Events                                                      */
/* ------------------------------------------------------------------ */

export class EmploymentContractCreated extends DomainEvent {
  readonly workerId: string;
  readonly contractType: string;

  constructor(props: { tenantId: Uuid; aggregateId: Uuid; correlationId: Uuid; workerId: Uuid; contractType: string }) {
    super({
      eventName: 'EmploymentContractCreated',
      tenantId: props.tenantId,
      aggregateType: 'EmploymentContract',
      aggregateId: props.aggregateId,
      correlationId: props.correlationId,
    });
    this.workerId = props.workerId.value;
    this.contractType = props.contractType;
  }
}

export class EmploymentContractOffered extends DomainEvent {
  constructor(props: { tenantId: Uuid; aggregateId: Uuid; correlationId: Uuid }) {
    super({
      eventName: 'EmploymentContractOffered',
      tenantId: props.tenantId,
      aggregateType: 'EmploymentContract',
      aggregateId: props.aggregateId,
      correlationId: props.correlationId,
    });
  }
}

export class EmploymentContractSigned extends DomainEvent {
  readonly signedAt: Date;

  constructor(props: { tenantId: Uuid; aggregateId: Uuid; correlationId: Uuid; signedAt: Date }) {
    super({
      eventName: 'EmploymentContractSigned',
      tenantId: props.tenantId,
      aggregateType: 'EmploymentContract',
      aggregateId: props.aggregateId,
      correlationId: props.correlationId,
    });
    this.signedAt = props.signedAt;
  }
}

export class EmploymentContractActivated extends DomainEvent {
  constructor(props: { tenantId: Uuid; aggregateId: Uuid; correlationId: Uuid }) {
    super({
      eventName: 'EmploymentContractActivated',
      tenantId: props.tenantId,
      aggregateType: 'EmploymentContract',
      aggregateId: props.aggregateId,
      correlationId: props.correlationId,
    });
  }
}

export class EmploymentContractTerminated extends DomainEvent {
  readonly reason: string;

  constructor(props: { tenantId: Uuid; aggregateId: Uuid; correlationId: Uuid; reason: string }) {
    super({
      eventName: 'EmploymentContractTerminated',
      tenantId: props.tenantId,
      aggregateType: 'EmploymentContract',
      aggregateId: props.aggregateId,
      correlationId: props.correlationId,
    });
    this.reason = props.reason;
  }
}

export class EmploymentContractExpired extends DomainEvent {
  constructor(props: { tenantId: Uuid; aggregateId: Uuid; correlationId: Uuid }) {
    super({
      eventName: 'EmploymentContractExpired',
      tenantId: props.tenantId,
      aggregateType: 'EmploymentContract',
      aggregateId: props.aggregateId,
      correlationId: props.correlationId,
    });
  }
}

/* ------------------------------------------------------------------ */
/*  Aggregate                                                          */
/* ------------------------------------------------------------------ */

/**
 * Represents an employment contract for a worker.
 */
export class EmploymentContract extends AggregateRoot {
  private _aggregateVersion = 0;

  readonly tenantId: Uuid;
  readonly workerId: Uuid;
  contractType: string;
  startDate: Date;
  endDate?: Date;
  terms?: Record<string, unknown>;
  signedAt?: Date;
  state: EmploymentContractState;
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

  constructor(props: EmploymentContractProps) {
    super(props.id);
    this.tenantId = props.tenantId;
    this.workerId = props.workerId;
    this.contractType = props.contractType;
    this.startDate = props.startDate;
    this.endDate = props.endDate;
    this.terms = props.terms;
    this.signedAt = props.signedAt;
    this.state = props.state;
    this.createdAt = props.createdAt ?? new Date();
    this.updatedAt = props.updatedAt ?? new Date();
    if (props.aggregateVersion !== undefined) {
      this._aggregateVersion = props.aggregateVersion;
    }
  }

  static create(props: EmploymentContractProps, correlationId: Uuid): EmploymentContract {
    const contract = new EmploymentContract({
      ...props,
      state: 'DRAFT',
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    contract.addDomainEvent(
      new EmploymentContractCreated({
        tenantId: contract.tenantId,
        aggregateId: contract.id,
        correlationId,
        workerId: contract.workerId,
        contractType: contract.contractType,
      }),
    );

    return contract;
  }

  offer(correlationId: Uuid): void {
    if (this.state !== 'DRAFT') {
      throw new ValidationError(`Cannot offer contract from state ${this.state}`);
    }
    this.state = 'OFFERED';
    this.addDomainEvent(
      new EmploymentContractOffered({ tenantId: this.tenantId, aggregateId: this.id, correlationId }),
    );
    this.incrementVersion();
    this.updatedAt = new Date();
  }

  sign(signedAt: Date, correlationId: Uuid): void {
    if (this.state !== 'OFFERED') {
      throw new ValidationError(`Cannot sign contract from state ${this.state}`);
    }
    this.state = 'SIGNED';
    this.signedAt = signedAt;
    this.addDomainEvent(
      new EmploymentContractSigned({ tenantId: this.tenantId, aggregateId: this.id, correlationId, signedAt }),
    );
    this.incrementVersion();
    this.updatedAt = new Date();
  }

  activate(correlationId: Uuid): void {
    if (this.state !== 'SIGNED') {
      throw new ValidationError(`Cannot activate contract from state ${this.state}`);
    }
    this.state = 'ACTIVE';
    this.addDomainEvent(
      new EmploymentContractActivated({ tenantId: this.tenantId, aggregateId: this.id, correlationId }),
    );
    this.incrementVersion();
    this.updatedAt = new Date();
  }

  terminate(reason: string, correlationId: Uuid): void {
    if (this.state !== 'ACTIVE' && this.state !== 'SIGNED' && this.state !== 'OFFERED') {
      throw new ValidationError(`Cannot terminate contract from state ${this.state}`);
    }
    this.state = 'TERMINATED';
    this.addDomainEvent(
      new EmploymentContractTerminated({ tenantId: this.tenantId, aggregateId: this.id, correlationId, reason }),
    );
    this.incrementVersion();
    this.updatedAt = new Date();
  }

  expire(correlationId: Uuid): void {
    if (this.state !== 'ACTIVE') {
      throw new ValidationError(`Cannot expire contract from state ${this.state}`);
    }
    this.state = 'EXPIRED';
    this.addDomainEvent(
      new EmploymentContractExpired({ tenantId: this.tenantId, aggregateId: this.id, correlationId }),
    );
    this.incrementVersion();
    this.updatedAt = new Date();
  }
}
