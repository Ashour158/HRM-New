import { AggregateRoot, DomainEvent, Uuid, Guard, ValidationError } from '@hcm/shared-kernel';

export type CollectiveBargainingSessionStatus = 'SCHEDULED' | 'IN_PROGRESS' | 'TENTATIVE_AGREEMENT' | 'RATIFIED' | 'FAILED' | 'CLOSED';

export interface CollectiveBargainingSessionProps {
  id: Uuid;
  tenantId: Uuid;
  unionRecognitionId: Uuid;
  sessionDate: Date;
  status?: CollectiveBargainingSessionStatus;
  location?: string;
  agenda?: string;
  minutes?: string;
  aggregateVersion?: number;
  createdAt?: Date;
  updatedAt?: Date;
}

export class CollectiveBargainingSessionCreated extends DomainEvent {
  constructor(props: { tenantId: Uuid; aggregateId: Uuid; correlationId: Uuid }) {
    super({ eventName: 'CollectiveBargainingSessionCreated', tenantId: props.tenantId, aggregateType: 'CollectiveBargainingSession', aggregateId: props.aggregateId, correlationId: props.correlationId });
  }
}

export class CollectiveBargainingSessionInProgress extends DomainEvent {
  constructor(props: { tenantId: Uuid; aggregateId: Uuid; correlationId: Uuid }) {
    super({ eventName: 'CollectiveBargainingSessionInProgress', tenantId: props.tenantId, aggregateType: 'CollectiveBargainingSession', aggregateId: props.aggregateId, correlationId: props.correlationId });
  }
}

export class CollectiveBargainingSessionTentativeAgreement extends DomainEvent {
  constructor(props: { tenantId: Uuid; aggregateId: Uuid; correlationId: Uuid }) {
    super({ eventName: 'CollectiveBargainingSessionTentativeAgreement', tenantId: props.tenantId, aggregateType: 'CollectiveBargainingSession', aggregateId: props.aggregateId, correlationId: props.correlationId });
  }
}

export class CollectiveBargainingSessionRatified extends DomainEvent {
  constructor(props: { tenantId: Uuid; aggregateId: Uuid; correlationId: Uuid }) {
    super({ eventName: 'CollectiveBargainingSessionRatified', tenantId: props.tenantId, aggregateType: 'CollectiveBargainingSession', aggregateId: props.aggregateId, correlationId: props.correlationId });
  }
}

export class CollectiveBargainingSessionFailed extends DomainEvent {
  constructor(props: { tenantId: Uuid; aggregateId: Uuid; correlationId: Uuid }) {
    super({ eventName: 'CollectiveBargainingSessionFailed', tenantId: props.tenantId, aggregateType: 'CollectiveBargainingSession', aggregateId: props.aggregateId, correlationId: props.correlationId });
  }
}

export class CollectiveBargainingSessionClosed extends DomainEvent {
  constructor(props: { tenantId: Uuid; aggregateId: Uuid; correlationId: Uuid }) {
    super({ eventName: 'CollectiveBargainingSessionClosed', tenantId: props.tenantId, aggregateType: 'CollectiveBargainingSession', aggregateId: props.aggregateId, correlationId: props.correlationId });
  }
}

export class CollectiveBargainingSession extends AggregateRoot {
  private _aggregateVersion = 0;
  readonly tenantId: Uuid;
  unionRecognitionId: Uuid;
  sessionDate: Date;
  status: CollectiveBargainingSessionStatus;
  location?: string;
  agenda?: string;
  minutes?: string;
  createdAt: Date;
  updatedAt: Date;

  get version(): number { return this._aggregateVersion; }
  get aggregateVersion(): number { return this._aggregateVersion; }
  incrementVersion(): void { this._aggregateVersion++; }

  constructor(props: CollectiveBargainingSessionProps) {
    super(props.id);
    this.tenantId = props.tenantId;
    this.unionRecognitionId = props.unionRecognitionId;
    this.sessionDate = props.sessionDate;
    this.status = props.status ?? 'SCHEDULED';
    this.location = props.location;
    this.agenda = props.agenda;
    this.minutes = props.minutes;
    this.createdAt = props.createdAt ?? new Date();
    this.updatedAt = props.updatedAt ?? new Date();
    if (props.aggregateVersion !== undefined) this._aggregateVersion = props.aggregateVersion;
  }

  static create(props: CollectiveBargainingSessionProps, correlationId: Uuid): CollectiveBargainingSession {
    Guard.againstNullOrUndefined(props.sessionDate, 'sessionDate');
    const ar = new CollectiveBargainingSession({ ...props, status: 'SCHEDULED', createdAt: new Date(), updatedAt: new Date() });
    ar.addDomainEvent(new CollectiveBargainingSessionCreated({ tenantId: ar.tenantId, aggregateId: ar.id, correlationId }));
    ar.incrementVersion();
    return ar;
  }

  start(correlationId: Uuid): void {
    if (this.status !== 'SCHEDULED') throw new ValidationError(`Cannot start from ${this.status}`);
    this.status = 'IN_PROGRESS';
    this.addDomainEvent(new CollectiveBargainingSessionInProgress({ tenantId: this.tenantId, aggregateId: this.id, correlationId }));
    this.incrementVersion();
    this.updatedAt = new Date();
  }

  recordTentativeAgreement(correlationId: Uuid): void {
    if (this.status !== 'IN_PROGRESS') throw new ValidationError(`Cannot record tentative agreement from ${this.status}`);
    this.status = 'TENTATIVE_AGREEMENT';
    this.addDomainEvent(new CollectiveBargainingSessionTentativeAgreement({ tenantId: this.tenantId, aggregateId: this.id, correlationId }));
    this.incrementVersion();
    this.updatedAt = new Date();
  }

  ratify(correlationId: Uuid): void {
    if (this.status !== 'TENTATIVE_AGREEMENT') throw new ValidationError(`Cannot ratify from ${this.status}`);
    this.status = 'RATIFIED';
    this.addDomainEvent(new CollectiveBargainingSessionRatified({ tenantId: this.tenantId, aggregateId: this.id, correlationId }));
    this.incrementVersion();
    this.updatedAt = new Date();
  }

  markFailed(correlationId: Uuid): void {
    if (this.status !== 'IN_PROGRESS') throw new ValidationError(`Cannot mark failed from ${this.status}`);
    this.status = 'FAILED';
    this.addDomainEvent(new CollectiveBargainingSessionFailed({ tenantId: this.tenantId, aggregateId: this.id, correlationId }));
    this.incrementVersion();
    this.updatedAt = new Date();
  }

  close(correlationId: Uuid): void {
    if (!['RATIFIED', 'FAILED'].includes(this.status)) throw new ValidationError(`Cannot close from ${this.status}`);
    this.status = 'CLOSED';
    this.addDomainEvent(new CollectiveBargainingSessionClosed({ tenantId: this.tenantId, aggregateId: this.id, correlationId }));
    this.incrementVersion();
    this.updatedAt = new Date();
  }
}
