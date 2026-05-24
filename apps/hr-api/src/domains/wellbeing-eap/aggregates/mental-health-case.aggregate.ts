import { AggregateRoot, DomainEvent, Uuid, Guard, ValidationError } from '@hcm/shared-kernel';

export type MentalHealthCaseStatus = 'OPEN' | 'ASSIGNED' | 'IN_PROGRESS' | 'RESOLVED' | 'CLOSED';

export interface MentalHealthCaseProps {
  id: Uuid;
  tenantId: Uuid;
  workerId: Uuid;
  severity: string;
  status?: MentalHealthCaseStatus;
  providerId?: Uuid;
  notes?: string;
  aggregateVersion?: number;
  createdAt?: Date;
  updatedAt?: Date;
}

export class MentalHealthCaseOpened extends DomainEvent {
  constructor(props: { tenantId: Uuid; aggregateId: Uuid; correlationId: Uuid }) {
    super({ eventName: 'MentalHealthCaseOpened', tenantId: props.tenantId, aggregateType: 'MentalHealthCase', aggregateId: props.aggregateId, correlationId: props.correlationId });
  }
}

export class MentalHealthCaseAssigned extends DomainEvent {
  constructor(props: { tenantId: Uuid; aggregateId: Uuid; correlationId: Uuid }) {
    super({ eventName: 'MentalHealthCaseAssigned', tenantId: props.tenantId, aggregateType: 'MentalHealthCase', aggregateId: props.aggregateId, correlationId: props.correlationId });
  }
}

export class MentalHealthCaseInProgress extends DomainEvent {
  constructor(props: { tenantId: Uuid; aggregateId: Uuid; correlationId: Uuid }) {
    super({ eventName: 'MentalHealthCaseInProgress', tenantId: props.tenantId, aggregateType: 'MentalHealthCase', aggregateId: props.aggregateId, correlationId: props.correlationId });
  }
}

export class MentalHealthCaseResolved extends DomainEvent {
  constructor(props: { tenantId: Uuid; aggregateId: Uuid; correlationId: Uuid }) {
    super({ eventName: 'MentalHealthCaseResolved', tenantId: props.tenantId, aggregateType: 'MentalHealthCase', aggregateId: props.aggregateId, correlationId: props.correlationId });
  }
}

export class MentalHealthCaseClosed extends DomainEvent {
  constructor(props: { tenantId: Uuid; aggregateId: Uuid; correlationId: Uuid }) {
    super({ eventName: 'MentalHealthCaseClosed', tenantId: props.tenantId, aggregateType: 'MentalHealthCase', aggregateId: props.aggregateId, correlationId: props.correlationId });
  }
}

export class MentalHealthCase extends AggregateRoot {
  private _aggregateVersion = 0;
  readonly tenantId: Uuid;
  workerId: Uuid;
  severity: string;
  status: MentalHealthCaseStatus;
  providerId?: Uuid;
  notes?: string; /* @special_category Encrypted at rest */
  createdAt: Date;
  updatedAt: Date;

  get version(): number { return this._aggregateVersion; }
  get aggregateVersion(): number { return this._aggregateVersion; }
  incrementVersion(): void { this._aggregateVersion++; }

  constructor(props: MentalHealthCaseProps) {
    super(props.id);
    this.tenantId = props.tenantId;
    this.workerId = props.workerId;
    this.severity = props.severity;
    this.status = props.status ?? 'OPEN';
    this.providerId = props.providerId;
    this.notes = props.notes;
    this.createdAt = props.createdAt ?? new Date();
    this.updatedAt = props.updatedAt ?? new Date();
    if (props.aggregateVersion !== undefined) this._aggregateVersion = props.aggregateVersion;
  }

  static create(props: MentalHealthCaseProps, correlationId: Uuid): MentalHealthCase {
    Guard.againstEmptyString(props.severity, 'severity');
    const ar = new MentalHealthCase({ ...props, status: 'OPEN', createdAt: new Date(), updatedAt: new Date() });
    ar.addDomainEvent(new MentalHealthCaseOpened({ tenantId: ar.tenantId, aggregateId: ar.id, correlationId }));
    ar.incrementVersion();
    return ar;
  }

  assignTo(providerId: Uuid, correlationId: Uuid): void {
    if (this.status !== 'OPEN') throw new ValidationError(`Cannot assign from ${this.status}`);
    this.status = 'ASSIGNED';
    this.providerId = providerId;
    this.addDomainEvent(new MentalHealthCaseAssigned({ tenantId: this.tenantId, aggregateId: this.id, correlationId }));
    this.incrementVersion();
    this.updatedAt = new Date();
  }

  start(correlationId: Uuid): void {
    if (this.status !== 'ASSIGNED') throw new ValidationError(`Cannot start from ${this.status}`);
    this.status = 'IN_PROGRESS';
    this.addDomainEvent(new MentalHealthCaseInProgress({ tenantId: this.tenantId, aggregateId: this.id, correlationId }));
    this.incrementVersion();
    this.updatedAt = new Date();
  }

  resolve(correlationId: Uuid): void {
    if (this.status !== 'IN_PROGRESS') throw new ValidationError(`Cannot resolve from ${this.status}`);
    this.status = 'RESOLVED';
    this.addDomainEvent(new MentalHealthCaseResolved({ tenantId: this.tenantId, aggregateId: this.id, correlationId }));
    this.incrementVersion();
    this.updatedAt = new Date();
  }

  close(correlationId: Uuid): void {
    if (this.status !== 'RESOLVED') throw new ValidationError(`Cannot close from ${this.status}`);
    this.status = 'CLOSED';
    this.addDomainEvent(new MentalHealthCaseClosed({ tenantId: this.tenantId, aggregateId: this.id, correlationId }));
    this.incrementVersion();
    this.updatedAt = new Date();
  }
}
