import { AggregateRoot, DomainEvent, Uuid, Guard, ValidationError } from '@hcm/shared-kernel';

export type HrServiceCatalogItemStatus = 'ACTIVE' | 'SUSPENDED' | 'RETIRED';

export interface HrServiceCatalogItemProps {
  id: Uuid;
  tenantId: Uuid;
  serviceCode: string;
  serviceName: string;
  description: string;
  category: string;
  slaHours: number;
  fulfillmentProcess: string;
  defaultOwnerGroup?: string;
  status?: HrServiceCatalogItemStatus;
  aggregateVersion?: number;
  createdAt?: Date;
  updatedAt?: Date;
}

export class HrServiceCatalogItemCreated extends DomainEvent {
  constructor(props: { tenantId: Uuid; aggregateId: Uuid; correlationId: Uuid }) {
    super({ eventName: 'HrServiceCatalogItemCreated', tenantId: props.tenantId, aggregateType: 'HrServiceCatalogItem', aggregateId: props.aggregateId, correlationId: props.correlationId });
  }
}

export class HrServiceCatalogItemActivated extends DomainEvent {
  constructor(props: { tenantId: Uuid; aggregateId: Uuid; correlationId: Uuid }) {
    super({ eventName: 'HrServiceCatalogItemActivated', tenantId: props.tenantId, aggregateType: 'HrServiceCatalogItem', aggregateId: props.aggregateId, correlationId: props.correlationId });
  }
}

export class HrServiceCatalogItemSuspended extends DomainEvent {
  constructor(props: { tenantId: Uuid; aggregateId: Uuid; correlationId: Uuid }) {
    super({ eventName: 'HrServiceCatalogItemSuspended', tenantId: props.tenantId, aggregateType: 'HrServiceCatalogItem', aggregateId: props.aggregateId, correlationId: props.correlationId });
  }
}

export class HrServiceCatalogItemRetired extends DomainEvent {
  constructor(props: { tenantId: Uuid; aggregateId: Uuid; correlationId: Uuid }) {
    super({ eventName: 'HrServiceCatalogItemRetired', tenantId: props.tenantId, aggregateType: 'HrServiceCatalogItem', aggregateId: props.aggregateId, correlationId: props.correlationId });
  }
}

export class HrServiceCatalogItem extends AggregateRoot {
  private _aggregateVersion = 0;
  readonly tenantId: Uuid;
  serviceCode: string;
  serviceName: string;
  description: string;
  category: string;
  slaHours: number;
  fulfillmentProcess: string;
  defaultOwnerGroup?: string;
  status: HrServiceCatalogItemStatus;
  createdAt: Date;
  updatedAt: Date;

  get version(): number { return this._aggregateVersion; }
  get aggregateVersion(): number { return this._aggregateVersion; }
  incrementVersion(): void { this._aggregateVersion++; }

  constructor(props: HrServiceCatalogItemProps) {
    super(props.id);
    this.tenantId = props.tenantId;
    this.serviceCode = props.serviceCode;
    this.serviceName = props.serviceName;
    this.description = props.description;
    this.category = props.category;
    this.slaHours = props.slaHours;
    this.fulfillmentProcess = props.fulfillmentProcess;
    this.defaultOwnerGroup = props.defaultOwnerGroup;
    this.status = props.status ?? 'ACTIVE';
    this.createdAt = props.createdAt ?? new Date();
    this.updatedAt = props.updatedAt ?? new Date();
    if (props.aggregateVersion !== undefined) this._aggregateVersion = props.aggregateVersion;
  }

  static create(props: HrServiceCatalogItemProps, correlationId: Uuid): HrServiceCatalogItem {
    Guard.againstEmptyString(props.serviceCode, 'serviceCode');
    Guard.againstEmptyString(props.serviceName, 'serviceName');
    const sci = new HrServiceCatalogItem({ ...props, status: 'ACTIVE', createdAt: new Date(), updatedAt: new Date() });
    sci.addDomainEvent(new HrServiceCatalogItemCreated({ tenantId: sci.tenantId, aggregateId: sci.id, correlationId }));
    return sci;
  }

  activate(correlationId: Uuid): void {
    if (this.status !== 'SUSPENDED') throw new ValidationError(`Cannot activate from ${this.status}`);
    this.status = 'ACTIVE';
    this.addDomainEvent(new HrServiceCatalogItemActivated({ tenantId: this.tenantId, aggregateId: this.id, correlationId }));
    this.incrementVersion();
    this.updatedAt = new Date();
  }

  suspend(correlationId: Uuid): void {
    if (this.status !== 'ACTIVE') throw new ValidationError(`Cannot suspend from ${this.status}`);
    this.status = 'SUSPENDED';
    this.addDomainEvent(new HrServiceCatalogItemSuspended({ tenantId: this.tenantId, aggregateId: this.id, correlationId }));
    this.incrementVersion();
    this.updatedAt = new Date();
  }

  retire(correlationId: Uuid): void {
    if (this.status !== 'ACTIVE' && this.status !== 'SUSPENDED') throw new ValidationError(`Cannot retire from ${this.status}`);
    this.status = 'RETIRED';
    this.addDomainEvent(new HrServiceCatalogItemRetired({ tenantId: this.tenantId, aggregateId: this.id, correlationId }));
    this.incrementVersion();
    this.updatedAt = new Date();
  }
}
