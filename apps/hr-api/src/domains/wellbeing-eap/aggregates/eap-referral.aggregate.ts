/**
 * @hrDataClassification SPECIAL_CATEGORY - wellness, EAP referral, mental-health case, accommodation, and worker health-support fields.
 */
import { AggregateRoot, DomainEvent, Uuid, Guard, ValidationError } from '@hcm/shared-kernel';

export type EapReferralStatus = 'REQUESTED' | 'SCHEDULED' | 'IN_PROGRESS' | 'COMPLETED' | 'CLOSED' | 'CANCELLED';

export interface EapReferralProps {
  id: Uuid;
  tenantId: Uuid;
  workerId: Uuid;
  reason: string;
  status?: EapReferralStatus;
  scheduledDate?: Date;
  completedDate?: Date;
  providerId?: Uuid;
  notes?: string;
  aggregateVersion?: number;
  createdAt?: Date;
  updatedAt?: Date;
}

export class EapReferralCreated extends DomainEvent {
  constructor(props: { tenantId: Uuid; aggregateId: Uuid; correlationId: Uuid }) {
    super({ eventName: 'EapReferralCreated', tenantId: props.tenantId, aggregateType: 'EapReferral', aggregateId: props.aggregateId, correlationId: props.correlationId });
  }
}

export class EapReferralScheduled extends DomainEvent {
  constructor(props: { tenantId: Uuid; aggregateId: Uuid; correlationId: Uuid }) {
    super({ eventName: 'EapReferralScheduled', tenantId: props.tenantId, aggregateType: 'EapReferral', aggregateId: props.aggregateId, correlationId: props.correlationId });
  }
}

export class EapReferralStarted extends DomainEvent {
  constructor(props: { tenantId: Uuid; aggregateId: Uuid; correlationId: Uuid }) {
    super({ eventName: 'EapReferralStarted', tenantId: props.tenantId, aggregateType: 'EapReferral', aggregateId: props.aggregateId, correlationId: props.correlationId });
  }
}

export class EapReferralCompleted extends DomainEvent {
  constructor(props: { tenantId: Uuid; aggregateId: Uuid; correlationId: Uuid }) {
    super({ eventName: 'EapReferralCompleted', tenantId: props.tenantId, aggregateType: 'EapReferral', aggregateId: props.aggregateId, correlationId: props.correlationId });
  }
}

export class EapReferralClosed extends DomainEvent {
  constructor(props: { tenantId: Uuid; aggregateId: Uuid; correlationId: Uuid }) {
    super({ eventName: 'EapReferralClosed', tenantId: props.tenantId, aggregateType: 'EapReferral', aggregateId: props.aggregateId, correlationId: props.correlationId });
  }
}

export class EapReferralCancelled extends DomainEvent {
  constructor(props: { tenantId: Uuid; aggregateId: Uuid; correlationId: Uuid }) {
    super({ eventName: 'EapReferralCancelled', tenantId: props.tenantId, aggregateType: 'EapReferral', aggregateId: props.aggregateId, correlationId: props.correlationId });
  }
}

export class EapReferral extends AggregateRoot {
  private _aggregateVersion = 0;
  readonly tenantId: Uuid;
  workerId: Uuid;
  reason: string;
  status: EapReferralStatus;
  scheduledDate?: Date;
  completedDate?: Date;
  providerId?: Uuid;
  notes?: string; /* @special_category Encrypted at rest; ANONYMIZED usage statistics stripped of PII for reporting */
  createdAt: Date;
  updatedAt: Date;

  get version(): number { return this._aggregateVersion; }
  get aggregateVersion(): number { return this._aggregateVersion; }
  incrementVersion(): void { this._aggregateVersion++; }

  constructor(props: EapReferralProps) {
    super(props.id);
    this.tenantId = props.tenantId;
    this.workerId = props.workerId;
    this.reason = props.reason;
    this.status = props.status ?? 'REQUESTED';
    this.scheduledDate = props.scheduledDate;
    this.completedDate = props.completedDate;
    this.providerId = props.providerId;
    this.notes = props.notes;
    this.createdAt = props.createdAt ?? new Date();
    this.updatedAt = props.updatedAt ?? new Date();
    if (props.aggregateVersion !== undefined) this._aggregateVersion = props.aggregateVersion;
  }

  static create(props: EapReferralProps, correlationId: Uuid): EapReferral {
    Guard.againstEmptyString(props.reason, 'reason');
    const ar = new EapReferral({ ...props, status: 'REQUESTED', createdAt: new Date(), updatedAt: new Date() });
    ar.addDomainEvent(new EapReferralCreated({ tenantId: ar.tenantId, aggregateId: ar.id, correlationId }));
    ar.incrementVersion();
    return ar;
  }

  schedule(scheduledDate: Date, correlationId: Uuid): void {
    if (this.status !== 'REQUESTED') throw new ValidationError(`Cannot schedule from ${this.status}`);
    this.status = 'SCHEDULED';
    this.scheduledDate = scheduledDate;
    this.addDomainEvent(new EapReferralScheduled({ tenantId: this.tenantId, aggregateId: this.id, correlationId }));
    this.incrementVersion();
    this.updatedAt = new Date();
  }

  start(correlationId: Uuid): void {
    if (this.status !== 'SCHEDULED') throw new ValidationError(`Cannot start from ${this.status}`);
    this.status = 'IN_PROGRESS';
    this.addDomainEvent(new EapReferralStarted({ tenantId: this.tenantId, aggregateId: this.id, correlationId }));
    this.incrementVersion();
    this.updatedAt = new Date();
  }

  complete(correlationId: Uuid): void {
    if (this.status !== 'IN_PROGRESS') throw new ValidationError(`Cannot complete from ${this.status}`);
    this.status = 'COMPLETED';
    this.completedDate = new Date();
    this.addDomainEvent(new EapReferralCompleted({ tenantId: this.tenantId, aggregateId: this.id, correlationId }));
    this.incrementVersion();
    this.updatedAt = new Date();
  }

  close(correlationId: Uuid): void {
    if (!['COMPLETED', 'CANCELLED'].includes(this.status)) throw new ValidationError(`Cannot close from ${this.status}`);
    this.status = 'CLOSED';
    this.addDomainEvent(new EapReferralClosed({ tenantId: this.tenantId, aggregateId: this.id, correlationId }));
    this.incrementVersion();
    this.updatedAt = new Date();
  }

  cancel(correlationId: Uuid): void {
    if (!['REQUESTED', 'SCHEDULED', 'IN_PROGRESS'].includes(this.status)) throw new ValidationError(`Cannot cancel from ${this.status}`);
    this.status = 'CANCELLED';
    this.addDomainEvent(new EapReferralCancelled({ tenantId: this.tenantId, aggregateId: this.id, correlationId }));
    this.incrementVersion();
    this.updatedAt = new Date();
  }
}
