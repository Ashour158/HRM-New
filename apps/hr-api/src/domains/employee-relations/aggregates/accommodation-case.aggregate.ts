/**
 * @hrDataClassification SPECIAL_CATEGORY - ER allegations, investigation evidence, disciplinary outcomes, accommodation, and worker-linked case fields.
 */
import { AggregateRoot, DomainEvent, Uuid, Guard, ValidationError } from '@hcm/shared-kernel';

export type AccommodationCaseStatus = 'REQUESTED' | 'UNDER_REVIEW' | 'APPROVED' | 'IMPLEMENTED' | 'CLOSED' | 'REJECTED';

export interface AccommodationCaseProps {
  id: Uuid;
  tenantId: Uuid;
  workerId: Uuid;
  requestType: string;
  description: string;
  medicalDocumentation?: string;
  accommodationDetails?: string;
  approvedBy?: Uuid;
  status?: AccommodationCaseStatus;
  aggregateVersion?: number;
  createdAt?: Date;
  updatedAt?: Date;
}

export class AccommodationRequested extends DomainEvent {
  constructor(props: { tenantId: Uuid; aggregateId: Uuid; correlationId: Uuid }) {
    super({ eventName: 'AccommodationRequested', tenantId: props.tenantId, aggregateType: 'AccommodationCase', aggregateId: props.aggregateId, correlationId: props.correlationId });
  }
}

export class AccommodationUnderReview extends DomainEvent {
  constructor(props: { tenantId: Uuid; aggregateId: Uuid; correlationId: Uuid }) {
    super({ eventName: 'AccommodationUnderReview', tenantId: props.tenantId, aggregateType: 'AccommodationCase', aggregateId: props.aggregateId, correlationId: props.correlationId });
  }
}

export class AccommodationApproved extends DomainEvent {
  constructor(props: { tenantId: Uuid; aggregateId: Uuid; correlationId: Uuid }) {
    super({ eventName: 'AccommodationApproved', tenantId: props.tenantId, aggregateType: 'AccommodationCase', aggregateId: props.aggregateId, correlationId: props.correlationId });
  }
}

export class AccommodationImplemented extends DomainEvent {
  constructor(props: { tenantId: Uuid; aggregateId: Uuid; correlationId: Uuid }) {
    super({ eventName: 'AccommodationImplemented', tenantId: props.tenantId, aggregateType: 'AccommodationCase', aggregateId: props.aggregateId, correlationId: props.correlationId });
  }
}

export class AccommodationClosed extends DomainEvent {
  constructor(props: { tenantId: Uuid; aggregateId: Uuid; correlationId: Uuid }) {
    super({ eventName: 'AccommodationClosed', tenantId: props.tenantId, aggregateType: 'AccommodationCase', aggregateId: props.aggregateId, correlationId: props.correlationId });
  }
}

export class AccommodationRejected extends DomainEvent {
  constructor(props: { tenantId: Uuid; aggregateId: Uuid; correlationId: Uuid }) {
    super({ eventName: 'AccommodationRejected', tenantId: props.tenantId, aggregateType: 'AccommodationCase', aggregateId: props.aggregateId, correlationId: props.correlationId });
  }
}

/** AccommodationCase aggregate. SPECIAL_CATEGORY: medical documentation is encrypted. */
export class AccommodationCase extends AggregateRoot {
  private _aggregateVersion = 0;
  readonly tenantId: Uuid;
  workerId: Uuid;
  requestType: string;
  description: string;
  medicalDocumentation?: string;
  accommodationDetails?: string;
  approvedBy?: Uuid;
  status: AccommodationCaseStatus;
  createdAt: Date;
  updatedAt: Date;

  get version(): number { return this._aggregateVersion; }
  get aggregateVersion(): number { return this._aggregateVersion; }
  incrementVersion(): void { this._aggregateVersion++; }

  constructor(props: AccommodationCaseProps) {
    super(props.id);
    this.tenantId = props.tenantId;
    this.workerId = props.workerId;
    this.requestType = props.requestType;
    this.description = props.description;
    this.medicalDocumentation = props.medicalDocumentation;
    this.accommodationDetails = props.accommodationDetails;
    this.approvedBy = props.approvedBy;
    this.status = props.status ?? 'REQUESTED';
    this.createdAt = props.createdAt ?? new Date();
    this.updatedAt = props.updatedAt ?? new Date();
    if (props.aggregateVersion !== undefined) this._aggregateVersion = props.aggregateVersion;
  }

  static create(props: AccommodationCaseProps, correlationId: Uuid): AccommodationCase {
    Guard.againstEmptyString(props.requestType, 'requestType');
    const ac = new AccommodationCase({ ...props, status: 'REQUESTED', createdAt: new Date(), updatedAt: new Date() });
    ac.addDomainEvent(new AccommodationRequested({ tenantId: ac.tenantId, aggregateId: ac.id, correlationId }));
    return ac;
  }

  review(correlationId: Uuid): void {
    if (this.status !== 'REQUESTED') throw new ValidationError(`Cannot review from ${this.status}`);
    this.status = 'UNDER_REVIEW';
    this.addDomainEvent(new AccommodationUnderReview({ tenantId: this.tenantId, aggregateId: this.id, correlationId }));
    this.incrementVersion();
    this.updatedAt = new Date();
  }

  approve(approvedBy: Uuid, correlationId: Uuid): void {
    if (this.status !== 'REQUESTED' && this.status !== 'UNDER_REVIEW') throw new ValidationError(`Cannot approve from ${this.status}`);
    this.status = 'APPROVED';
    this.approvedBy = approvedBy;
    this.addDomainEvent(new AccommodationApproved({ tenantId: this.tenantId, aggregateId: this.id, correlationId }));
    this.incrementVersion();
    this.updatedAt = new Date();
  }

  implement(correlationId: Uuid): void {
    if (this.status !== 'APPROVED') throw new ValidationError(`Cannot implement from ${this.status}`);
    this.status = 'IMPLEMENTED';
    this.addDomainEvent(new AccommodationImplemented({ tenantId: this.tenantId, aggregateId: this.id, correlationId }));
    this.incrementVersion();
    this.updatedAt = new Date();
  }

  close(correlationId: Uuid): void {
    if (this.status !== 'IMPLEMENTED') throw new ValidationError(`Cannot close from ${this.status}`);
    this.status = 'CLOSED';
    this.addDomainEvent(new AccommodationClosed({ tenantId: this.tenantId, aggregateId: this.id, correlationId }));
    this.incrementVersion();
    this.updatedAt = new Date();
  }

  reject(correlationId: Uuid): void {
    if (this.status !== 'REQUESTED' && this.status !== 'UNDER_REVIEW') throw new ValidationError(`Cannot reject from ${this.status}`);
    this.status = 'REJECTED';
    this.addDomainEvent(new AccommodationRejected({ tenantId: this.tenantId, aggregateId: this.id, correlationId }));
    this.incrementVersion();
    this.updatedAt = new Date();
  }
}
