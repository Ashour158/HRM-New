import { AggregateRoot, DomainEvent, Uuid, Guard, ValidationError } from '@hcm/shared-kernel';

export type KpiStatus = 'DRAFT' | 'ACTIVE' | 'INACTIVE' | 'ARCHIVED';

export interface KpiProps {
  id: Uuid;
  tenantId: Uuid;
  orgUnitId?: Uuid;
  name: string;
  description?: string;
  targetValue?: number;
  actualValue?: number;
  unit?: string;
  frequency?: string;
  ownerId?: Uuid;
  formula?: string;
  dataSource?: string;
  department?: string;
  status?: KpiStatus;
  aggregateVersion?: number;
  createdAt?: Date;
  updatedAt?: Date;
}

export class KpiCreated extends DomainEvent {
  constructor(props: { tenantId: Uuid; aggregateId: Uuid; correlationId: Uuid }) {
    super({ eventName: 'KpiCreated', tenantId: props.tenantId, aggregateType: 'KeyPerformanceIndicator', aggregateId: props.aggregateId, correlationId: props.correlationId });
  }
}

export class KpiActivated extends DomainEvent {
  constructor(props: { tenantId: Uuid; aggregateId: Uuid; correlationId: Uuid }) {
    super({ eventName: 'KpiActivated', tenantId: props.tenantId, aggregateType: 'KeyPerformanceIndicator', aggregateId: props.aggregateId, correlationId: props.correlationId });
  }
}

export class KpiActualUpdated extends DomainEvent {
  constructor(props: { tenantId: Uuid; aggregateId: Uuid; correlationId: Uuid }) {
    super({ eventName: 'KpiActualUpdated', tenantId: props.tenantId, aggregateType: 'KeyPerformanceIndicator', aggregateId: props.aggregateId, correlationId: props.correlationId });
  }
}

export class KpiOwnerAssigned extends DomainEvent {
  constructor(props: { tenantId: Uuid; aggregateId: Uuid; correlationId: Uuid }) {
    super({ eventName: 'KpiOwnerAssigned', tenantId: props.tenantId, aggregateType: 'KeyPerformanceIndicator', aggregateId: props.aggregateId, correlationId: props.correlationId });
  }
}

export class KpiArchived extends DomainEvent {
  constructor(props: { tenantId: Uuid; aggregateId: Uuid; correlationId: Uuid }) {
    super({ eventName: 'KpiArchived', tenantId: props.tenantId, aggregateType: 'KeyPerformanceIndicator', aggregateId: props.aggregateId, correlationId: props.correlationId });
  }
}

export class KeyPerformanceIndicator extends AggregateRoot {
  private _aggregateVersion = 0;
  readonly tenantId: Uuid;
  orgUnitId?: Uuid;
  name: string;
  description?: string;
  targetValue?: number;
  actualValue?: number;
  unit?: string;
  frequency: string;
  ownerId?: Uuid;
  formula?: string;
  dataSource?: string;
  department?: string;
  status: KpiStatus;
  createdAt: Date;
  updatedAt: Date;

  get version(): number { return this._aggregateVersion; }
  get aggregateVersion(): number { return this._aggregateVersion; }
  incrementVersion(): void { this._aggregateVersion++; }

  constructor(props: KpiProps) {
    super(props.id);
    this.tenantId = props.tenantId;
    this.orgUnitId = props.orgUnitId;
    this.name = props.name;
    this.description = props.description;
    this.targetValue = props.targetValue;
    this.actualValue = props.actualValue;
    this.unit = props.unit;
    this.frequency = props.frequency ?? 'MONTHLY';
    this.ownerId = props.ownerId;
    this.formula = props.formula;
    this.dataSource = props.dataSource;
    this.department = props.department;
    this.status = props.status ?? 'DRAFT';
    this.createdAt = props.createdAt ?? new Date();
    this.updatedAt = props.updatedAt ?? new Date();
    if (props.aggregateVersion !== undefined) this._aggregateVersion = props.aggregateVersion;
  }

  static create(props: KpiProps, correlationId: Uuid): KeyPerformanceIndicator {
    Guard.againstEmptyString(props.name, 'name');
    const ar = new KeyPerformanceIndicator({ ...props, status: 'DRAFT', createdAt: new Date(), updatedAt: new Date() });
    ar.addDomainEvent(new KpiCreated({ tenantId: ar.tenantId, aggregateId: ar.id, correlationId }));
    return ar;
  }

  activate(correlationId: Uuid): void {
    if (this.status !== 'DRAFT') throw new ValidationError(`Cannot activate from ${this.status}`);
    this.status = 'ACTIVE';
    this.addDomainEvent(new KpiActivated({ tenantId: this.tenantId, aggregateId: this.id, correlationId }));
    this.incrementVersion();
    this.updatedAt = new Date();
  }

  updateActual(actualValue: number, correlationId: Uuid): void {
    if (this.status !== 'ACTIVE' && this.status !== 'INACTIVE') throw new ValidationError(`Cannot update actual from ${this.status}`);
    this.actualValue = actualValue;
    this.addDomainEvent(new KpiActualUpdated({ tenantId: this.tenantId, aggregateId: this.id, correlationId }));
    this.incrementVersion();
    this.updatedAt = new Date();
  }

  assignOwner(ownerId: Uuid, correlationId: Uuid): void {
    this.ownerId = ownerId;
    this.addDomainEvent(new KpiOwnerAssigned({ tenantId: this.tenantId, aggregateId: this.id, correlationId }));
    this.incrementVersion();
    this.updatedAt = new Date();
  }

  archive(correlationId: Uuid): void {
    if (this.status !== 'ACTIVE' && this.status !== 'INACTIVE') throw new ValidationError(`Cannot archive from ${this.status}`);
    this.status = 'ARCHIVED';
    this.addDomainEvent(new KpiArchived({ tenantId: this.tenantId, aggregateId: this.id, correlationId }));
    this.incrementVersion();
    this.updatedAt = new Date();
  }
}
