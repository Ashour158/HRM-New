import { AggregateRoot, DomainEvent, Uuid, Guard, ValidationError } from '@hcm/shared-kernel';

export type UnionRecognitionStatus = 'RECOGNIZED' | 'NEGOTIATING' | 'RATIFIED' | 'ACTIVE' | 'EXPIRED' | 'RENEWED';

export interface UnionRecognitionProps {
  id: Uuid;
  tenantId: Uuid;
  unionName: string;
  bargainingUnitId: Uuid;
  status?: UnionRecognitionStatus;
  effectiveDate?: Date;
  expirationDate?: Date;
  agreementDocument?: string;
  aggregateVersion?: number;
  createdAt?: Date;
  updatedAt?: Date;
}

export class UnionRecognitionCreated extends DomainEvent {
  constructor(props: { tenantId: Uuid; aggregateId: Uuid; correlationId: Uuid }) {
    super({ eventName: 'UnionRecognitionCreated', tenantId: props.tenantId, aggregateType: 'UnionRecognition', aggregateId: props.aggregateId, correlationId: props.correlationId });
  }
}

export class UnionRecognitionNegotiating extends DomainEvent {
  constructor(props: { tenantId: Uuid; aggregateId: Uuid; correlationId: Uuid }) {
    super({ eventName: 'UnionRecognitionNegotiating', tenantId: props.tenantId, aggregateType: 'UnionRecognition', aggregateId: props.aggregateId, correlationId: props.correlationId });
  }
}

export class UnionRecognitionRatified extends DomainEvent {
  constructor(props: { tenantId: Uuid; aggregateId: Uuid; correlationId: Uuid }) {
    super({ eventName: 'UnionRecognitionRatified', tenantId: props.tenantId, aggregateType: 'UnionRecognition', aggregateId: props.aggregateId, correlationId: props.correlationId });
  }
}

export class UnionRecognitionActive extends DomainEvent {
  constructor(props: { tenantId: Uuid; aggregateId: Uuid; correlationId: Uuid }) {
    super({ eventName: 'UnionRecognitionActive', tenantId: props.tenantId, aggregateType: 'UnionRecognition', aggregateId: props.aggregateId, correlationId: props.correlationId });
  }
}

export class UnionRecognitionExpired extends DomainEvent {
  constructor(props: { tenantId: Uuid; aggregateId: Uuid; correlationId: Uuid }) {
    super({ eventName: 'UnionRecognitionExpired', tenantId: props.tenantId, aggregateType: 'UnionRecognition', aggregateId: props.aggregateId, correlationId: props.correlationId });
  }
}

export class UnionRecognitionRenewed extends DomainEvent {
  constructor(props: { tenantId: Uuid; aggregateId: Uuid; correlationId: Uuid }) {
    super({ eventName: 'UnionRecognitionRenewed', tenantId: props.tenantId, aggregateType: 'UnionRecognition', aggregateId: props.aggregateId, correlationId: props.correlationId });
  }
}

export class UnionRecognition extends AggregateRoot {
  private _aggregateVersion = 0;
  readonly tenantId: Uuid;
  unionName: string;
  bargainingUnitId: Uuid;
  status: UnionRecognitionStatus;
  effectiveDate?: Date;
  expirationDate?: Date;
  agreementDocument?: string;
  createdAt: Date;
  updatedAt: Date;

  get version(): number { return this._aggregateVersion; }
  get aggregateVersion(): number { return this._aggregateVersion; }
  incrementVersion(): void { this._aggregateVersion++; }

  constructor(props: UnionRecognitionProps) {
    super(props.id);
    this.tenantId = props.tenantId;
    this.unionName = props.unionName;
    this.bargainingUnitId = props.bargainingUnitId;
    this.status = props.status ?? 'RECOGNIZED';
    this.effectiveDate = props.effectiveDate;
    this.expirationDate = props.expirationDate;
    this.agreementDocument = props.agreementDocument;
    this.createdAt = props.createdAt ?? new Date();
    this.updatedAt = props.updatedAt ?? new Date();
    if (props.aggregateVersion !== undefined) this._aggregateVersion = props.aggregateVersion;
  }

  static create(props: UnionRecognitionProps, correlationId: Uuid): UnionRecognition {
    Guard.againstEmptyString(props.unionName, 'unionName');
    const ar = new UnionRecognition({ ...props, status: 'RECOGNIZED', createdAt: new Date(), updatedAt: new Date() });
    ar.addDomainEvent(new UnionRecognitionCreated({ tenantId: ar.tenantId, aggregateId: ar.id, correlationId }));
    ar.incrementVersion();
    return ar;
  }

  negotiate(correlationId: Uuid): void {
    if (this.status !== 'RECOGNIZED') throw new ValidationError(`Cannot negotiate from ${this.status}`);
    this.status = 'NEGOTIATING';
    this.addDomainEvent(new UnionRecognitionNegotiating({ tenantId: this.tenantId, aggregateId: this.id, correlationId }));
    this.incrementVersion();
    this.updatedAt = new Date();
  }

  ratify(correlationId: Uuid): void {
    if (this.status !== 'NEGOTIATING') throw new ValidationError(`Cannot ratify from ${this.status}`);
    this.status = 'RATIFIED';
    this.addDomainEvent(new UnionRecognitionRatified({ tenantId: this.tenantId, aggregateId: this.id, correlationId }));
    this.incrementVersion();
    this.updatedAt = new Date();
  }

  activate(correlationId: Uuid): void {
    if (this.status !== 'RATIFIED') throw new ValidationError(`Cannot activate from ${this.status}`);
    this.status = 'ACTIVE';
    this.addDomainEvent(new UnionRecognitionActive({ tenantId: this.tenantId, aggregateId: this.id, correlationId }));
    this.incrementVersion();
    this.updatedAt = new Date();
  }

  expire(correlationId: Uuid): void {
    if (!['ACTIVE', 'RATIFIED'].includes(this.status)) throw new ValidationError(`Cannot expire from ${this.status}`);
    this.status = 'EXPIRED';
    this.addDomainEvent(new UnionRecognitionExpired({ tenantId: this.tenantId, aggregateId: this.id, correlationId }));
    this.incrementVersion();
    this.updatedAt = new Date();
  }

  renew(correlationId: Uuid): void {
    if (this.status !== 'EXPIRED') throw new ValidationError(`Cannot renew from ${this.status}`);
    this.status = 'RENEWED';
    this.addDomainEvent(new UnionRecognitionRenewed({ tenantId: this.tenantId, aggregateId: this.id, correlationId }));
    this.incrementVersion();
    this.updatedAt = new Date();
  }
}
