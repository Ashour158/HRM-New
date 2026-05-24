import { AggregateRoot, DomainEvent, Uuid, Guard, ValidationError } from '@hcm/shared-kernel';

export type ContractorRateCardStatus = 'DRAFT' | 'ACTIVE' | 'REVISED' | 'EXPIRED';

export interface ContractorRateCardProps {
  id: Uuid;
  tenantId: Uuid;
  vendorId: Uuid;
  jobTitle: string;
  rate: number;
  currency: string;
  effectiveFrom: Date;
  effectiveUntil?: Date;
  status?: ContractorRateCardStatus;
  aggregateVersion?: number;
  createdAt?: Date;
  updatedAt?: Date;
}

export class RateCardCreated extends DomainEvent {
  constructor(props: { tenantId: Uuid; aggregateId: Uuid; correlationId: Uuid }) {
    super({ eventName: 'RateCardCreated', tenantId: props.tenantId, aggregateType: 'ContractorRateCard', aggregateId: props.aggregateId, correlationId: props.correlationId });
  }
}

export class RateCardActivated extends DomainEvent {
  constructor(props: { tenantId: Uuid; aggregateId: Uuid; correlationId: Uuid }) {
    super({ eventName: 'RateCardActivated', tenantId: props.tenantId, aggregateType: 'ContractorRateCard', aggregateId: props.aggregateId, correlationId: props.correlationId });
  }
}

export class RateCardRevised extends DomainEvent {
  constructor(props: { tenantId: Uuid; aggregateId: Uuid; correlationId: Uuid }) {
    super({ eventName: 'RateCardRevised', tenantId: props.tenantId, aggregateType: 'ContractorRateCard', aggregateId: props.aggregateId, correlationId: props.correlationId });
  }
}

export class RateCardExpired extends DomainEvent {
  constructor(props: { tenantId: Uuid; aggregateId: Uuid; correlationId: Uuid }) {
    super({ eventName: 'RateCardExpired', tenantId: props.tenantId, aggregateType: 'ContractorRateCard', aggregateId: props.aggregateId, correlationId: props.correlationId });
  }
}

export class ContractorRateCard extends AggregateRoot {
  private _aggregateVersion = 0;
  readonly tenantId: Uuid;
  vendorId: Uuid;
  jobTitle: string;
  rate: number;
  currency: string;
  effectiveFrom: Date;
  effectiveUntil?: Date;
  status: ContractorRateCardStatus;
  createdAt: Date;
  updatedAt: Date;

  get version(): number { return this._aggregateVersion; }
  get aggregateVersion(): number { return this._aggregateVersion; }
  incrementVersion(): void { this._aggregateVersion++; }

  constructor(props: ContractorRateCardProps) {
    super(props.id);
    this.tenantId = props.tenantId;
    this.vendorId = props.vendorId;
    this.jobTitle = props.jobTitle;
    this.rate = props.rate;
    this.currency = props.currency;
    this.effectiveFrom = props.effectiveFrom;
    this.effectiveUntil = props.effectiveUntil;
    this.status = props.status ?? 'DRAFT';
    this.createdAt = props.createdAt ?? new Date();
    this.updatedAt = props.updatedAt ?? new Date();
    if (props.aggregateVersion !== undefined) this._aggregateVersion = props.aggregateVersion;
  }

  static create(props: ContractorRateCardProps, correlationId: Uuid): ContractorRateCard {
    Guard.againstEmptyString(props.jobTitle, 'jobTitle');
    const crc = new ContractorRateCard({ ...props, status: 'DRAFT', createdAt: new Date(), updatedAt: new Date() });
    crc.addDomainEvent(new RateCardCreated({ tenantId: crc.tenantId, aggregateId: crc.id, correlationId }));
    return crc;
  }

  activate(correlationId: Uuid): void {
    if (this.status !== 'DRAFT') throw new ValidationError(`Cannot activate from ${this.status}`);
    this.status = 'ACTIVE';
    this.addDomainEvent(new RateCardActivated({ tenantId: this.tenantId, aggregateId: this.id, correlationId }));
    this.incrementVersion();
    this.updatedAt = new Date();
  }

  revise(correlationId: Uuid): void {
    if (this.status !== 'ACTIVE') throw new ValidationError(`Cannot revise from ${this.status}`);
    this.status = 'REVISED';
    this.addDomainEvent(new RateCardRevised({ tenantId: this.tenantId, aggregateId: this.id, correlationId }));
    this.incrementVersion();
    this.updatedAt = new Date();
  }

  expire(correlationId: Uuid): void {
    if (this.status !== 'ACTIVE' && this.status !== 'REVISED') throw new ValidationError(`Cannot expire from ${this.status}`);
    this.status = 'EXPIRED';
    this.addDomainEvent(new RateCardExpired({ tenantId: this.tenantId, aggregateId: this.id, correlationId }));
    this.incrementVersion();
    this.updatedAt = new Date();
  }
}
