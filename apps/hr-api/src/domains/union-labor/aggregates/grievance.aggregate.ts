import { AggregateRoot, DomainEvent, Uuid, Guard, ValidationError } from '@hcm/shared-kernel';

export type GrievanceStatus = 'FILED' | 'ACKNOWLEDGED' | 'UNDER_INVESTIGATION' | 'RESOLVED' | 'ARBITRATED' | 'WITHDRAWN';

export interface GrievanceProps {
  id: Uuid;
  tenantId: Uuid;
  workerId: Uuid;
  grievanceType: string;
  description: string;
  status?: GrievanceStatus;
  resolution?: string;
  arbitratorDecision?: string;
  aggregateVersion?: number;
  createdAt?: Date;
  updatedAt?: Date;
}

export class GrievanceFiled extends DomainEvent {
  constructor(props: { tenantId: Uuid; aggregateId: Uuid; correlationId: Uuid }) {
    super({ eventName: 'GrievanceFiled', tenantId: props.tenantId, aggregateType: 'Grievance', aggregateId: props.aggregateId, correlationId: props.correlationId });
  }
}

export class GrievanceAcknowledged extends DomainEvent {
  constructor(props: { tenantId: Uuid; aggregateId: Uuid; correlationId: Uuid }) {
    super({ eventName: 'GrievanceAcknowledged', tenantId: props.tenantId, aggregateType: 'Grievance', aggregateId: props.aggregateId, correlationId: props.correlationId });
  }
}

export class GrievanceUnderInvestigation extends DomainEvent {
  constructor(props: { tenantId: Uuid; aggregateId: Uuid; correlationId: Uuid }) {
    super({ eventName: 'GrievanceUnderInvestigation', tenantId: props.tenantId, aggregateType: 'Grievance', aggregateId: props.aggregateId, correlationId: props.correlationId });
  }
}

export class GrievanceResolved extends DomainEvent {
  constructor(props: { tenantId: Uuid; aggregateId: Uuid; correlationId: Uuid }) {
    super({ eventName: 'GrievanceResolved', tenantId: props.tenantId, aggregateType: 'Grievance', aggregateId: props.aggregateId, correlationId: props.correlationId });
  }
}

export class GrievanceArbitrated extends DomainEvent {
  constructor(props: { tenantId: Uuid; aggregateId: Uuid; correlationId: Uuid }) {
    super({ eventName: 'GrievanceArbitrated', tenantId: props.tenantId, aggregateType: 'Grievance', aggregateId: props.aggregateId, correlationId: props.correlationId });
  }
}

export class GrievanceWithdrawn extends DomainEvent {
  constructor(props: { tenantId: Uuid; aggregateId: Uuid; correlationId: Uuid }) {
    super({ eventName: 'GrievanceWithdrawn', tenantId: props.tenantId, aggregateType: 'Grievance', aggregateId: props.aggregateId, correlationId: props.correlationId });
  }
}

export class Grievance extends AggregateRoot {
  private _aggregateVersion = 0;
  readonly tenantId: Uuid;
  workerId: Uuid;
  grievanceType: string;
  description: string;
  status: GrievanceStatus;
  resolution?: string;
  arbitratorDecision?: string;
  createdAt: Date;
  updatedAt: Date;

  get version(): number { return this._aggregateVersion; }
  get aggregateVersion(): number { return this._aggregateVersion; }
  incrementVersion(): void { this._aggregateVersion++; }

  constructor(props: GrievanceProps) {
    super(props.id);
    this.tenantId = props.tenantId;
    this.workerId = props.workerId;
    this.grievanceType = props.grievanceType;
    this.description = props.description;
    this.status = props.status ?? 'FILED';
    this.resolution = props.resolution;
    this.arbitratorDecision = props.arbitratorDecision;
    this.createdAt = props.createdAt ?? new Date();
    this.updatedAt = props.updatedAt ?? new Date();
    if (props.aggregateVersion !== undefined) this._aggregateVersion = props.aggregateVersion;
  }

  static create(props: GrievanceProps, correlationId: Uuid): Grievance {
    Guard.againstEmptyString(props.grievanceType, 'grievanceType');
    const ar = new Grievance({ ...props, status: 'FILED', createdAt: new Date(), updatedAt: new Date() });
    ar.addDomainEvent(new GrievanceFiled({ tenantId: ar.tenantId, aggregateId: ar.id, correlationId }));
    ar.incrementVersion();
    return ar;
  }

  acknowledge(correlationId: Uuid): void {
    if (this.status !== 'FILED') throw new ValidationError(`Cannot acknowledge from ${this.status}`);
    this.status = 'ACKNOWLEDGED';
    this.addDomainEvent(new GrievanceAcknowledged({ tenantId: this.tenantId, aggregateId: this.id, correlationId }));
    this.incrementVersion();
    this.updatedAt = new Date();
  }

  startInvestigation(correlationId: Uuid): void {
    if (this.status !== 'ACKNOWLEDGED') throw new ValidationError(`Cannot start investigation from ${this.status}`);
    this.status = 'UNDER_INVESTIGATION';
    this.addDomainEvent(new GrievanceUnderInvestigation({ tenantId: this.tenantId, aggregateId: this.id, correlationId }));
    this.incrementVersion();
    this.updatedAt = new Date();
  }

  resolve(correlationId: Uuid): void {
    if (this.status !== 'UNDER_INVESTIGATION') throw new ValidationError(`Cannot resolve from ${this.status}`);
    this.status = 'RESOLVED';
    this.addDomainEvent(new GrievanceResolved({ tenantId: this.tenantId, aggregateId: this.id, correlationId }));
    this.incrementVersion();
    this.updatedAt = new Date();
  }

  arbitrate(correlationId: Uuid): void {
    if (this.status !== 'UNDER_INVESTIGATION') throw new ValidationError(`Cannot arbitrate from ${this.status}`);
    this.status = 'ARBITRATED';
    this.addDomainEvent(new GrievanceArbitrated({ tenantId: this.tenantId, aggregateId: this.id, correlationId }));
    this.incrementVersion();
    this.updatedAt = new Date();
  }

  withdraw(correlationId: Uuid): void {
    if (!['FILED', 'ACKNOWLEDGED', 'UNDER_INVESTIGATION'].includes(this.status)) throw new ValidationError(`Cannot withdraw from ${this.status}`);
    this.status = 'WITHDRAWN';
    this.addDomainEvent(new GrievanceWithdrawn({ tenantId: this.tenantId, aggregateId: this.id, correlationId }));
    this.incrementVersion();
    this.updatedAt = new Date();
  }
}
