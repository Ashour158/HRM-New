import { AggregateRoot, DomainEvent, Uuid, Guard, ValidationError } from '@hcm/shared-kernel';

export type SowEngagementStatus = 'DRAFT' | 'ACTIVE' | 'IN_PROGRESS' | 'COMPLETED' | 'CLOSED' | 'CANCELLED';

export interface SowEngagementProps {
  id: Uuid;
  tenantId: Uuid;
  sowNumber: string;
  vendorId: Uuid;
  projectName: string;
  totalValue: number;
  currency: string;
  startDate: Date;
  endDate: Date;
  milestones?: string[];
  status?: SowEngagementStatus;
  aggregateVersion?: number;
  createdAt?: Date;
  updatedAt?: Date;
}

export class SowEngagementCreated extends DomainEvent {
  constructor(props: { tenantId: Uuid; aggregateId: Uuid; correlationId: Uuid }) {
    super({ eventName: 'SowEngagementCreated', tenantId: props.tenantId, aggregateType: 'SowEngagement', aggregateId: props.aggregateId, correlationId: props.correlationId });
  }
}

export class SowEngagementActivated extends DomainEvent {
  constructor(props: { tenantId: Uuid; aggregateId: Uuid; correlationId: Uuid }) {
    super({ eventName: 'SowEngagementActivated', tenantId: props.tenantId, aggregateType: 'SowEngagement', aggregateId: props.aggregateId, correlationId: props.correlationId });
  }
}

export class SowEngagementStarted extends DomainEvent {
  constructor(props: { tenantId: Uuid; aggregateId: Uuid; correlationId: Uuid }) {
    super({ eventName: 'SowEngagementStarted', tenantId: props.tenantId, aggregateType: 'SowEngagement', aggregateId: props.aggregateId, correlationId: props.correlationId });
  }
}

export class SowEngagementCompleted extends DomainEvent {
  constructor(props: { tenantId: Uuid; aggregateId: Uuid; correlationId: Uuid }) {
    super({ eventName: 'SowEngagementCompleted', tenantId: props.tenantId, aggregateType: 'SowEngagement', aggregateId: props.aggregateId, correlationId: props.correlationId });
  }
}

export class SowEngagementClosed extends DomainEvent {
  constructor(props: { tenantId: Uuid; aggregateId: Uuid; correlationId: Uuid }) {
    super({ eventName: 'SowEngagementClosed', tenantId: props.tenantId, aggregateType: 'SowEngagement', aggregateId: props.aggregateId, correlationId: props.correlationId });
  }
}

export class SowEngagement extends AggregateRoot {
  private _aggregateVersion = 0;
  readonly tenantId: Uuid;
  sowNumber: string;
  vendorId: Uuid;
  projectName: string;
  totalValue: number;
  currency: string;
  startDate: Date;
  endDate: Date;
  milestones?: string[];
  status: SowEngagementStatus;
  createdAt: Date;
  updatedAt: Date;

  get version(): number { return this._aggregateVersion; }
  get aggregateVersion(): number { return this._aggregateVersion; }
  incrementVersion(): void { this._aggregateVersion++; }

  constructor(props: SowEngagementProps) {
    super(props.id);
    this.tenantId = props.tenantId;
    this.sowNumber = props.sowNumber;
    this.vendorId = props.vendorId;
    this.projectName = props.projectName;
    this.totalValue = props.totalValue;
    this.currency = props.currency;
    this.startDate = props.startDate;
    this.endDate = props.endDate;
    this.milestones = props.milestones;
    this.status = props.status ?? 'DRAFT';
    this.createdAt = props.createdAt ?? new Date();
    this.updatedAt = props.updatedAt ?? new Date();
    if (props.aggregateVersion !== undefined) this._aggregateVersion = props.aggregateVersion;
  }

  static create(props: SowEngagementProps, correlationId: Uuid): SowEngagement {
    Guard.againstEmptyString(props.sowNumber, 'sowNumber');
    const se = new SowEngagement({ ...props, status: 'DRAFT', createdAt: new Date(), updatedAt: new Date() });
    se.addDomainEvent(new SowEngagementCreated({ tenantId: se.tenantId, aggregateId: se.id, correlationId }));
    return se;
  }

  activate(correlationId: Uuid): void {
    if (this.status !== 'DRAFT') throw new ValidationError(`Cannot activate from ${this.status}`);
    this.status = 'ACTIVE';
    this.addDomainEvent(new SowEngagementActivated({ tenantId: this.tenantId, aggregateId: this.id, correlationId }));
    this.incrementVersion();
    this.updatedAt = new Date();
  }

  start(correlationId: Uuid): void {
    if (this.status !== 'ACTIVE') throw new ValidationError(`Cannot start from ${this.status}`);
    this.status = 'IN_PROGRESS';
    this.addDomainEvent(new SowEngagementStarted({ tenantId: this.tenantId, aggregateId: this.id, correlationId }));
    this.incrementVersion();
    this.updatedAt = new Date();
  }

  complete(correlationId: Uuid): void {
    if (this.status !== 'IN_PROGRESS') throw new ValidationError(`Cannot complete from ${this.status}`);
    this.status = 'COMPLETED';
    this.addDomainEvent(new SowEngagementCompleted({ tenantId: this.tenantId, aggregateId: this.id, correlationId }));
    this.incrementVersion();
    this.updatedAt = new Date();
  }

  close(correlationId: Uuid): void {
    if (this.status !== 'COMPLETED') throw new ValidationError(`Cannot close from ${this.status}`);
    this.status = 'CLOSED';
    this.addDomainEvent(new SowEngagementClosed({ tenantId: this.tenantId, aggregateId: this.id, correlationId }));
    this.incrementVersion();
    this.updatedAt = new Date();
  }
}
