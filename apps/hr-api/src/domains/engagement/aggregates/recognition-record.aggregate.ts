import { AggregateRoot, DomainEvent, Uuid, ValidationError } from '@hcm/shared-kernel';

export type RecognitionRecordStatus = 'SUBMITTED' | 'APPROVED' | 'AWARDED' | 'CANCELLED' | 'REJECTED';

export interface RecognitionRecordProps {
  id: Uuid;
  tenantId: Uuid;
  fromWorkerId: Uuid;
  toWorkerId: Uuid;
  programId: Uuid;
  points?: number;
  message?: string;
  approvedBy?: Uuid;
  status?: RecognitionRecordStatus;
  aggregateVersion?: number;
  createdAt?: Date;
  updatedAt?: Date;
}

export class RecognitionSubmitted extends DomainEvent {
  constructor(props: { tenantId: Uuid; aggregateId: Uuid; correlationId: Uuid }) {
    super({ eventName: 'RecognitionSubmitted', tenantId: props.tenantId, aggregateType: 'RecognitionRecord', aggregateId: props.aggregateId, correlationId: props.correlationId });
  }
}

export class RecognitionApproved extends DomainEvent {
  constructor(props: { tenantId: Uuid; aggregateId: Uuid; correlationId: Uuid }) {
    super({ eventName: 'RecognitionApproved', tenantId: props.tenantId, aggregateType: 'RecognitionRecord', aggregateId: props.aggregateId, correlationId: props.correlationId });
  }
}

export class RecognitionAwarded extends DomainEvent {
  constructor(props: { tenantId: Uuid; aggregateId: Uuid; correlationId: Uuid }) {
    super({ eventName: 'RecognitionAwarded', tenantId: props.tenantId, aggregateType: 'RecognitionRecord', aggregateId: props.aggregateId, correlationId: props.correlationId });
  }
}

export class RecognitionCancelled extends DomainEvent {
  constructor(props: { tenantId: Uuid; aggregateId: Uuid; correlationId: Uuid }) {
    super({ eventName: 'RecognitionCancelled', tenantId: props.tenantId, aggregateType: 'RecognitionRecord', aggregateId: props.aggregateId, correlationId: props.correlationId });
  }
}

export class RecognitionRejected extends DomainEvent {
  constructor(props: { tenantId: Uuid; aggregateId: Uuid; correlationId: Uuid }) {
    super({ eventName: 'RecognitionRejected', tenantId: props.tenantId, aggregateType: 'RecognitionRecord', aggregateId: props.aggregateId, correlationId: props.correlationId });
  }
}

/**
 * RecognitionRecord aggregate tracks individual recognition records.
 */
export class RecognitionRecord extends AggregateRoot {
  private _aggregateVersion = 0;
  readonly tenantId: Uuid;
  fromWorkerId: Uuid;
  toWorkerId: Uuid;
  programId: Uuid;
  points?: number;
  message?: string;
  approvedBy?: Uuid;
  status: RecognitionRecordStatus;
  createdAt: Date;
  updatedAt: Date;

  get version(): number { return this._aggregateVersion; }
  get aggregateVersion(): number { return this._aggregateVersion; }
  incrementVersion(): void { this._aggregateVersion++; }

  constructor(props: RecognitionRecordProps) {
    super(props.id);
    this.tenantId = props.tenantId;
    this.fromWorkerId = props.fromWorkerId;
    this.toWorkerId = props.toWorkerId;
    this.programId = props.programId;
    this.points = props.points;
    this.message = props.message;
    this.approvedBy = props.approvedBy;
    this.status = props.status ?? 'SUBMITTED';
    this.createdAt = props.createdAt ?? new Date();
    this.updatedAt = props.updatedAt ?? new Date();
    if (props.aggregateVersion !== undefined) this._aggregateVersion = props.aggregateVersion;
  }

  static create(props: RecognitionRecordProps, correlationId: Uuid): RecognitionRecord {
    const ar = new RecognitionRecord({ ...props, status: 'SUBMITTED', createdAt: new Date(), updatedAt: new Date() });
    ar.addDomainEvent(new RecognitionSubmitted({ tenantId: ar.tenantId, aggregateId: ar.id, correlationId }));
    return ar;
  }

  approve(approvedBy: Uuid, correlationId: Uuid): void {
    if (this.status !== 'SUBMITTED') throw new ValidationError(`Cannot approve from ${this.status}`);
    this.approvedBy = approvedBy;
    this.status = 'APPROVED';
    this.addDomainEvent(new RecognitionApproved({ tenantId: this.tenantId, aggregateId: this.id, correlationId }));
    this.incrementVersion();
    this.updatedAt = new Date();
  }

  award(correlationId: Uuid): void {
    if (this.status !== 'APPROVED') throw new ValidationError(`Cannot award from ${this.status}`);
    this.status = 'AWARDED';
    this.addDomainEvent(new RecognitionAwarded({ tenantId: this.tenantId, aggregateId: this.id, correlationId }));
    this.incrementVersion();
    this.updatedAt = new Date();
  }

  cancel(correlationId: Uuid): void {
    if (this.status === 'AWARDED' || this.status === 'CANCELLED' || this.status === 'REJECTED') throw new ValidationError(`Cannot cancel from ${this.status}`);
    this.status = 'CANCELLED';
    this.addDomainEvent(new RecognitionCancelled({ tenantId: this.tenantId, aggregateId: this.id, correlationId }));
    this.incrementVersion();
    this.updatedAt = new Date();
  }

  reject(correlationId: Uuid): void {
    if (this.status !== 'SUBMITTED' && this.status !== 'APPROVED') throw new ValidationError(`Cannot reject from ${this.status}`);
    this.status = 'REJECTED';
    this.addDomainEvent(new RecognitionRejected({ tenantId: this.tenantId, aggregateId: this.id, correlationId }));
    this.incrementVersion();
    this.updatedAt = new Date();
  }
}
