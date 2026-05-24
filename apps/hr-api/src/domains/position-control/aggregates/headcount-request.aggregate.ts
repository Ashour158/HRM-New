import { AggregateRoot, DomainEvent, Uuid, ConflictError, ForbiddenError } from '@hcm/shared-kernel';

/**
 * Canonical headcount request status values.
 */
export type HeadcountStatus = 'DRAFT' | 'SUBMITTED' | 'UNDER_REVIEW' | 'APPROVED' | 'REJECTED' | 'CANCELLED';

/**
 * Properties required to construct or rehydrate a {@link HeadcountRequest} aggregate.
 */
export interface HeadcountRequestProps {
  id: Uuid;
  tenantId: Uuid;
  requestNumber: string;
  departmentId?: Uuid;
  legalEntityId?: Uuid;
  justification: string;
  requestedBy: Uuid;
  approvedBy?: Uuid;
  approvedAt?: Date;
  status?: HeadcountStatus;
  positionsRequested: number;
  positionsApproved?: number;
  autoCreatePosition?: boolean;
  aggregateVersion?: number;
  createdAt?: Date;
  updatedAt?: Date;
}

/* ── Domain Events ─────────────────────────────────────────────── */

class HeadcountRequestCreated extends DomainEvent {}
class HeadcountRequestSubmitted extends DomainEvent {}
class HeadcountRequestReviewStarted extends DomainEvent {}
class HeadcountRequestApproved extends DomainEvent {}
class HeadcountRequestRejected extends DomainEvent {}
class HeadcountRequestCancelled extends DomainEvent {}

/* ── Aggregate ─────────────────────────────────────────────────── */

/**
 * HeadcountRequest aggregate root.
 *
 * Represents a request for additional headcount and tracks its approval workflow.
 */
export class HeadcountRequest extends AggregateRoot {
  readonly tenantId: Uuid;
  requestNumber: string;
  departmentId?: Uuid;
  legalEntityId?: Uuid;
  justification: string;
  requestedBy: Uuid;
  approvedBy?: Uuid;
  approvedAt?: Date;
  status: HeadcountStatus;
  positionsRequested: number;
  positionsApproved?: number;
  autoCreatePosition: boolean;
  createdAt: Date;
  updatedAt: Date;

  private constructor(props: HeadcountRequestProps) {
    super(props.id);
    this.tenantId = props.tenantId;
    this.requestNumber = props.requestNumber;
    this.departmentId = props.departmentId;
    this.legalEntityId = props.legalEntityId;
    this.justification = props.justification;
    this.requestedBy = props.requestedBy;
    this.approvedBy = props.approvedBy;
    this.approvedAt = props.approvedAt;
    this.status = props.status ?? 'DRAFT';
    this.positionsRequested = props.positionsRequested;
    this.positionsApproved = props.positionsApproved;
    this.autoCreatePosition = props.autoCreatePosition ?? false;
    this.createdAt = props.createdAt ?? new Date();
    this.updatedAt = props.updatedAt ?? new Date();

    if (props.aggregateVersion) {
      for (let i = 0; i < props.aggregateVersion; i++) {
        this.incrementVersion();
      }
    }
  }

  /**
   * Factory method that creates a new HeadcountRequest in DRAFT state.
   */
  static create(props: HeadcountRequestProps): HeadcountRequest {
    const request = new HeadcountRequest(props);
    request.addDomainEvent(
      new HeadcountRequestCreated({
        eventName: 'HeadcountRequestCreated',
        tenantId: request.tenantId,
        aggregateType: 'headcountRequest',
        aggregateId: request.id,
        correlationId: props.id,
      }),
    );
    return request;
  }

  /**
   * Submit the request (DRAFT → SUBMITTED).
   */
  submit(correlationId: Uuid): void {
    if (this.status !== 'DRAFT') {
      throw new ConflictError('Headcount request can only be submitted from DRAFT state');
    }
    this.status = 'SUBMITTED';
    this.bumpVersion();
    this.addDomainEvent(
      new HeadcountRequestSubmitted({
        eventName: 'HeadcountRequestSubmitted',
        tenantId: this.tenantId,
        aggregateType: 'headcountRequest',
        aggregateId: this.id,
        correlationId,
        version: this.version,
      }),
    );
  }

  /**
   * Start review (SUBMITTED → UNDER_REVIEW).
   */
  startReview(correlationId: Uuid): void {
    if (this.status !== 'SUBMITTED') {
      throw new ConflictError('Headcount request can only start review from SUBMITTED state');
    }
    this.status = 'UNDER_REVIEW';
    this.bumpVersion();
    this.addDomainEvent(
      new HeadcountRequestReviewStarted({
        eventName: 'HeadcountRequestReviewStarted',
        tenantId: this.tenantId,
        aggregateType: 'headcountRequest',
        aggregateId: this.id,
        correlationId,
        version: this.version,
      }),
    );
  }

  /**
   * Approve the request (UNDER_REVIEW → APPROVED).
   *
   * Enforces SoD: approver cannot be the requester.
   */
  approve(approverId: Uuid, positionsApproved: number, correlationId: Uuid): void {
    if (this.status !== 'UNDER_REVIEW') {
      throw new ConflictError('Headcount request can only be approved from UNDER_REVIEW state');
    }
    if (approverId.equals(this.requestedBy)) {
      throw new ForbiddenError('Requester cannot approve their own headcount request (SoD)');
    }
    if (positionsApproved > this.positionsRequested) {
      throw new ConflictError('Approved positions cannot exceed requested positions');
    }
    this.status = 'APPROVED';
    this.approvedBy = approverId;
    this.approvedAt = new Date();
    this.positionsApproved = positionsApproved;
    this.bumpVersion();
    this.addDomainEvent(
      new HeadcountRequestApproved({
        eventName: 'HeadcountRequestApproved',
        tenantId: this.tenantId,
        aggregateType: 'headcountRequest',
        aggregateId: this.id,
        correlationId,
        version: this.version,
      }),
    );
  }

  /**
   * Reject the request (UNDER_REVIEW → REJECTED).
   */
  reject(approverId: Uuid, correlationId: Uuid): void {
    if (this.status !== 'UNDER_REVIEW') {
      throw new ConflictError('Headcount request can only be rejected from UNDER_REVIEW state');
    }
    if (approverId.equals(this.requestedBy)) {
      throw new ForbiddenError('Requester cannot reject their own headcount request (SoD)');
    }
    this.status = 'REJECTED';
    this.approvedBy = approverId;
    this.approvedAt = new Date();
    this.bumpVersion();
    this.addDomainEvent(
      new HeadcountRequestRejected({
        eventName: 'HeadcountRequestRejected',
        tenantId: this.tenantId,
        aggregateType: 'headcountRequest',
        aggregateId: this.id,
        correlationId,
        version: this.version,
      }),
    );
  }

  /**
   * Cancel the request (terminal state).
   */
  cancel(correlationId: Uuid): void {
    if (this.status !== 'DRAFT' && this.status !== 'SUBMITTED') {
      throw new ConflictError('Headcount request can only be cancelled from DRAFT or SUBMITTED state');
    }
    this.status = 'CANCELLED';
    this.bumpVersion();
    this.addDomainEvent(
      new HeadcountRequestCancelled({
        eventName: 'HeadcountRequestCancelled',
        tenantId: this.tenantId,
        aggregateType: 'headcountRequest',
        aggregateId: this.id,
        correlationId,
        version: this.version,
      }),
    );
  }

  private bumpVersion(): void {
    this.incrementVersion();
    this.updatedAt = new Date();
  }
}
