import { AggregateRoot, DomainEvent, Uuid, Guard, ValidationError } from '@hcm/shared-kernel';

export type WellnessProgramStatus = 'DRAFT' | 'ACTIVE' | 'COMPLETED' | 'CANCELLED' | 'ARCHIVED';

export interface WellnessProgramProps {
  id: Uuid;
  tenantId: Uuid;
  name: string;
  type: string;
  status?: WellnessProgramStatus;
  startDate?: Date;
  endDate?: Date;
  description?: string;
  aggregateVersion?: number;
  createdAt?: Date;
  updatedAt?: Date;
}

export class WellnessProgramCreated extends DomainEvent {
  constructor(props: { tenantId: Uuid; aggregateId: Uuid; correlationId: Uuid }) {
    super({ eventName: 'WellnessProgramCreated', tenantId: props.tenantId, aggregateType: 'WellnessProgram', aggregateId: props.aggregateId, correlationId: props.correlationId });
  }
}

export class WellnessProgramActivated extends DomainEvent {
  constructor(props: { tenantId: Uuid; aggregateId: Uuid; correlationId: Uuid }) {
    super({ eventName: 'WellnessProgramActivated', tenantId: props.tenantId, aggregateType: 'WellnessProgram', aggregateId: props.aggregateId, correlationId: props.correlationId });
  }
}

export class WellnessProgramEnrolled extends DomainEvent {
  constructor(props: { tenantId: Uuid; aggregateId: Uuid; correlationId: Uuid }) {
    super({ eventName: 'WellnessProgramEnrolled', tenantId: props.tenantId, aggregateType: 'WellnessProgram', aggregateId: props.aggregateId, correlationId: props.correlationId });
  }
}

export class WellnessProgramCompleted extends DomainEvent {
  constructor(props: { tenantId: Uuid; aggregateId: Uuid; correlationId: Uuid }) {
    super({ eventName: 'WellnessProgramCompleted', tenantId: props.tenantId, aggregateType: 'WellnessProgram', aggregateId: props.aggregateId, correlationId: props.correlationId });
  }
}

export class WellnessProgramCancelled extends DomainEvent {
  constructor(props: { tenantId: Uuid; aggregateId: Uuid; correlationId: Uuid }) {
    super({ eventName: 'WellnessProgramCancelled', tenantId: props.tenantId, aggregateType: 'WellnessProgram', aggregateId: props.aggregateId, correlationId: props.correlationId });
  }
}

export class WellnessProgramArchived extends DomainEvent {
  constructor(props: { tenantId: Uuid; aggregateId: Uuid; correlationId: Uuid }) {
    super({ eventName: 'WellnessProgramArchived', tenantId: props.tenantId, aggregateType: 'WellnessProgram', aggregateId: props.aggregateId, correlationId: props.correlationId });
  }
}

export class WellnessProgram extends AggregateRoot {
  private _aggregateVersion = 0;
  readonly tenantId: Uuid;
  name: string;
  type: string;
  status: WellnessProgramStatus;
  startDate?: Date;
  endDate?: Date;
  description?: string;
  createdAt: Date;
  updatedAt: Date;

  get version(): number { return this._aggregateVersion; }
  get aggregateVersion(): number { return this._aggregateVersion; }
  incrementVersion(): void { this._aggregateVersion++; }

  constructor(props: WellnessProgramProps) {
    super(props.id);
    this.tenantId = props.tenantId;
    this.name = props.name;
    this.type = props.type;
    this.status = props.status ?? 'DRAFT';
    this.startDate = props.startDate;
    this.endDate = props.endDate;
    this.description = props.description;
    this.createdAt = props.createdAt ?? new Date();
    this.updatedAt = props.updatedAt ?? new Date();
    if (props.aggregateVersion !== undefined) this._aggregateVersion = props.aggregateVersion;
  }

  static create(props: WellnessProgramProps, correlationId: Uuid): WellnessProgram {
    Guard.againstEmptyString(props.name, 'name');
    const ar = new WellnessProgram({ ...props, status: 'DRAFT', createdAt: new Date(), updatedAt: new Date() });
    ar.addDomainEvent(new WellnessProgramCreated({ tenantId: ar.tenantId, aggregateId: ar.id, correlationId }));
    ar.incrementVersion();
    return ar;
  }

  activate(correlationId: Uuid): void {
    if (this.status !== 'DRAFT') throw new ValidationError(`Cannot activate from ${this.status}`);
    this.status = 'ACTIVE';
    this.addDomainEvent(new WellnessProgramActivated({ tenantId: this.tenantId, aggregateId: this.id, correlationId }));
    this.incrementVersion();
    this.updatedAt = new Date();
  }

  enroll(_workerId: Uuid, correlationId: Uuid): void {
    if (this.status !== 'ACTIVE') throw new ValidationError(`Cannot enroll from ${this.status}`);
    this.addDomainEvent(new WellnessProgramEnrolled({ tenantId: this.tenantId, aggregateId: this.id, correlationId }));
    this.incrementVersion();
    this.updatedAt = new Date();
  }

  complete(correlationId: Uuid): void {
    if (this.status !== 'ACTIVE') throw new ValidationError(`Cannot complete from ${this.status}`);
    this.status = 'COMPLETED';
    this.addDomainEvent(new WellnessProgramCompleted({ tenantId: this.tenantId, aggregateId: this.id, correlationId }));
    this.incrementVersion();
    this.updatedAt = new Date();
  }

  cancel(correlationId: Uuid): void {
    if (!['DRAFT', 'ACTIVE'].includes(this.status)) throw new ValidationError(`Cannot cancel from ${this.status}`);
    this.status = 'CANCELLED';
    this.addDomainEvent(new WellnessProgramCancelled({ tenantId: this.tenantId, aggregateId: this.id, correlationId }));
    this.incrementVersion();
    this.updatedAt = new Date();
  }

  archive(correlationId: Uuid): void {
    if (!['COMPLETED', 'CANCELLED'].includes(this.status)) throw new ValidationError(`Cannot archive from ${this.status}`);
    this.status = 'ARCHIVED';
    this.addDomainEvent(new WellnessProgramArchived({ tenantId: this.tenantId, aggregateId: this.id, correlationId }));
    this.incrementVersion();
    this.updatedAt = new Date();
  }
}
