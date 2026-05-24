import { AggregateRoot, DomainEvent, Uuid, Guard, ValidationError, ConflictError } from '@hcm/shared-kernel';

/**
 * Canonical offer status values.
 */
export type OfferStatus =
  | 'DRAFT'
  | 'PENDING_APPROVAL'
  | 'APPROVED'
  | 'SENT'
  | 'ACCEPTED'
  | 'DECLINED'
  | 'EXPIRED'
  | 'WITHDRAWN';

/**
 * Properties required to construct or rehydrate an {@link Offer} aggregate.
 */
export interface OfferProps {
  id: Uuid;
  tenantId: Uuid;
  candidateId: Uuid;
  requisitionId: Uuid;
  proposedSalary: number;
  currency: string;
  startDate: Date;
  benefitsPackage?: Record<string, unknown>;
  status?: OfferStatus;
  sentAt?: Date;
  acceptedAt?: Date;
  declinedAt?: Date;
  proposedBy?: Uuid;
  approvedBy?: Uuid;
  aggregateVersion?: number;
  createdAt?: Date;
  updatedAt?: Date;
}

/* ------------------------------------------------------------------ */
/*  Domain Events                                                      */
/* ------------------------------------------------------------------ */

export class OfferCreated extends DomainEvent {
  readonly candidateId: string;
  readonly requisitionId: string;

  constructor(props: {
    tenantId: Uuid;
    aggregateId: Uuid;
    correlationId: Uuid;
    candidateId: Uuid;
    requisitionId: Uuid;
  }) {
    super({
      eventName: 'OfferCreated',
      tenantId: props.tenantId,
      aggregateType: 'Offer',
      aggregateId: props.aggregateId,
      correlationId: props.correlationId,
    });
    this.candidateId = props.candidateId.value;
    this.requisitionId = props.requisitionId.value;
  }
}

export class OfferSubmitted extends DomainEvent {
  constructor(props: { tenantId: Uuid; aggregateId: Uuid; correlationId: Uuid }) {
    super({
      eventName: 'OfferSubmitted',
      tenantId: props.tenantId,
      aggregateType: 'Offer',
      aggregateId: props.aggregateId,
      correlationId: props.correlationId,
    });
  }
}

export class OfferApproved extends DomainEvent {
  constructor(props: { tenantId: Uuid; aggregateId: Uuid; correlationId: Uuid }) {
    super({
      eventName: 'OfferApproved',
      tenantId: props.tenantId,
      aggregateType: 'Offer',
      aggregateId: props.aggregateId,
      correlationId: props.correlationId,
    });
  }
}

export class OfferSent extends DomainEvent {
  constructor(props: { tenantId: Uuid; aggregateId: Uuid; correlationId: Uuid }) {
    super({
      eventName: 'OfferSent',
      tenantId: props.tenantId,
      aggregateType: 'Offer',
      aggregateId: props.aggregateId,
      correlationId: props.correlationId,
    });
  }
}

export class OfferAccepted extends DomainEvent {
  constructor(props: { tenantId: Uuid; aggregateId: Uuid; correlationId: Uuid }) {
    super({
      eventName: 'OfferAccepted',
      tenantId: props.tenantId,
      aggregateType: 'Offer',
      aggregateId: props.aggregateId,
      correlationId: props.correlationId,
    });
  }
}

export class OfferDeclined extends DomainEvent {
  constructor(props: { tenantId: Uuid; aggregateId: Uuid; correlationId: Uuid }) {
    super({
      eventName: 'OfferDeclined',
      tenantId: props.tenantId,
      aggregateType: 'Offer',
      aggregateId: props.aggregateId,
      correlationId: props.correlationId,
    });
  }
}

export class OfferExpired extends DomainEvent {
  constructor(props: { tenantId: Uuid; aggregateId: Uuid; correlationId: Uuid }) {
    super({
      eventName: 'OfferExpired',
      tenantId: props.tenantId,
      aggregateType: 'Offer',
      aggregateId: props.aggregateId,
      correlationId: props.correlationId,
    });
  }
}

export class OfferWithdrawn extends DomainEvent {
  constructor(props: { tenantId: Uuid; aggregateId: Uuid; correlationId: Uuid }) {
    super({
      eventName: 'OfferWithdrawn',
      tenantId: props.tenantId,
      aggregateType: 'Offer',
      aggregateId: props.aggregateId,
      correlationId: props.correlationId,
    });
  }
}

/* ------------------------------------------------------------------ */
/*  Aggregate                                                          */
/* ------------------------------------------------------------------ */

/**
 * Offer aggregate root.
 *
 * Represents a compensation offer extended to a candidate.
 * Lifecycle: DRAFT → PENDING_APPROVAL → APPROVED → SENT → ACCEPTED
 * Terminal states: DECLINED, EXPIRED, WITHDRAWN
 *
 * SoD: compensation proposer ≠ approver, interviewer ≠ final offer approver
 */
export class Offer extends AggregateRoot {
  private _aggregateVersion = 0;

  readonly tenantId: Uuid;
  candidateId: Uuid;
  requisitionId: Uuid;
  proposedSalary: number;
  currency: string;
  startDate: Date;
  benefitsPackage?: Record<string, unknown>;
  status: OfferStatus;
  sentAt?: Date;
  acceptedAt?: Date;
  declinedAt?: Date;
  proposedBy?: Uuid;
  approvedBy?: Uuid;
  createdAt: Date;
  updatedAt: Date;

  /** Optimistic lock version. */
  get version(): number {
    return this._aggregateVersion;
  }

  /** Alias for version used by repositories. */
  get aggregateVersion(): number {
    return this._aggregateVersion;
  }

  /** Increment the optimistic lock version. */
  incrementVersion(): void {
    this._aggregateVersion++;
  }

  private constructor(props: OfferProps) {
    super(props.id);
    this.tenantId = props.tenantId;
    this.candidateId = props.candidateId;
    this.requisitionId = props.requisitionId;
    this.proposedSalary = props.proposedSalary;
    this.currency = props.currency;
    this.startDate = props.startDate;
    this.benefitsPackage = props.benefitsPackage;
    this.status = props.status ?? 'DRAFT';
    this.sentAt = props.sentAt;
    this.acceptedAt = props.acceptedAt;
    this.declinedAt = props.declinedAt;
    this.proposedBy = props.proposedBy;
    this.approvedBy = props.approvedBy;
    this.createdAt = props.createdAt ?? new Date();
    this.updatedAt = props.updatedAt ?? new Date();
    if (props.aggregateVersion !== undefined) {
      this._aggregateVersion = props.aggregateVersion;
    }
  }

  /**
   * Factory method to create a new Offer in DRAFT state.
   */
  static create(props: OfferProps, correlationId: Uuid): Offer {
    Guard.againstNegativeNumber(props.proposedSalary, 'proposedSalary');
    Guard.againstEmptyString(props.currency, 'currency');

    const offer = new Offer({
      ...props,
      status: 'DRAFT',
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    offer.addDomainEvent(
      new OfferCreated({
        tenantId: offer.tenantId,
        aggregateId: offer.id,
        correlationId,
        candidateId: offer.candidateId,
        requisitionId: offer.requisitionId,
      }),
    );

    return offer;
  }

  /**
   * Submit the offer for approval.
   * DRAFT → PENDING_APPROVAL
   */
  submitForApproval(proposedBy: Uuid, correlationId: Uuid): void {
    if (this.status !== 'DRAFT') {
      throw new ConflictError('Offer can only be submitted from DRAFT state');
    }
    this.status = 'PENDING_APPROVAL';
    this.proposedBy = proposedBy;
    this.bumpVersion();
    this.addDomainEvent(
      new OfferSubmitted({
        tenantId: this.tenantId,
        aggregateId: this.id,
        correlationId,
      }),
    );
  }

  /**
   * Approve the offer.
   * PENDING_APPROVAL → APPROVED
   * SoD: approver must not be the proposer.
   */
  approve(approvedBy: Uuid, correlationId: Uuid): void {
    if (this.status !== 'PENDING_APPROVAL') {
      throw new ConflictError('Offer can only be approved from PENDING_APPROVAL state');
    }
    if (this.proposedBy && this.proposedBy.value === approvedBy.value) {
      throw new ValidationError('Segregation of duties violation: offer approver cannot be the proposer');
    }
    this.status = 'APPROVED';
    this.approvedBy = approvedBy;
    this.bumpVersion();
    this.addDomainEvent(
      new OfferApproved({
        tenantId: this.tenantId,
        aggregateId: this.id,
        correlationId,
      }),
    );
  }

  /**
   * Send the offer to the candidate.
   * APPROVED → SENT
   */
  send(correlationId: Uuid): void {
    if (this.status !== 'APPROVED') {
      throw new ConflictError('Offer can only be sent from APPROVED state');
    }
    this.status = 'SENT';
    this.sentAt = new Date();
    this.bumpVersion();
    this.addDomainEvent(
      new OfferSent({
        tenantId: this.tenantId,
        aggregateId: this.id,
        correlationId,
      }),
    );
  }

  /**
   * Accept the offer.
   * SENT → ACCEPTED
   */
  accept(correlationId: Uuid): void {
    if (this.status !== 'SENT') {
      throw new ConflictError('Offer can only be accepted from SENT state');
    }
    this.status = 'ACCEPTED';
    this.acceptedAt = new Date();
    this.bumpVersion();
    this.addDomainEvent(
      new OfferAccepted({
        tenantId: this.tenantId,
        aggregateId: this.id,
        correlationId,
      }),
    );
  }

  /**
   * Decline the offer.
   * SENT → DECLINED (terminal)
   */
  decline(correlationId: Uuid): void {
    if (this.status !== 'SENT') {
      throw new ConflictError('Offer can only be declined from SENT state');
    }
    this.status = 'DECLINED';
    this.declinedAt = new Date();
    this.bumpVersion();
    this.addDomainEvent(
      new OfferDeclined({
        tenantId: this.tenantId,
        aggregateId: this.id,
        correlationId,
      }),
    );
  }

  /**
   * Expire the offer.
   * SENT → EXPIRED (terminal)
   */
  expire(correlationId: Uuid): void {
    if (this.status !== 'SENT') {
      throw new ConflictError('Offer can only expire from SENT state');
    }
    this.status = 'EXPIRED';
    this.bumpVersion();
    this.addDomainEvent(
      new OfferExpired({
        tenantId: this.tenantId,
        aggregateId: this.id,
        correlationId,
      }),
    );
  }

  /**
   * Withdraw the offer.
   * DRAFT → WITHDRAWN, PENDING_APPROVAL → WITHDRAWN, APPROVED → WITHDRAWN, SENT → WITHDRAWN
   */
  withdraw(correlationId: Uuid): void {
    if (
      this.status === 'ACCEPTED' ||
      this.status === 'DECLINED' ||
      this.status === 'EXPIRED' ||
      this.status === 'WITHDRAWN'
    ) {
      throw new ConflictError('Cannot withdraw offer in terminal state');
    }
    this.status = 'WITHDRAWN';
    this.bumpVersion();
    this.addDomainEvent(
      new OfferWithdrawn({
        tenantId: this.tenantId,
        aggregateId: this.id,
        correlationId,
      }),
    );
  }

  /**
   * Update mutable offer attributes.
   */
  update(
    props: Partial<Pick<OfferProps, 'proposedSalary' | 'currency' | 'startDate' | 'benefitsPackage'>>,
    _correlationId: Uuid,
  ): void {
    if (
      this.status === 'ACCEPTED' ||
      this.status === 'DECLINED' ||
      this.status === 'EXPIRED' ||
      this.status === 'WITHDRAWN'
    ) {
      throw new ConflictError('Cannot update offer in terminal state');
    }
    if (props.proposedSalary !== undefined) this.proposedSalary = props.proposedSalary;
    if (props.currency !== undefined) this.currency = props.currency;
    if (props.startDate !== undefined) this.startDate = props.startDate;
    if (props.benefitsPackage !== undefined) this.benefitsPackage = props.benefitsPackage;
    this.bumpVersion();
    this.updatedAt = new Date();
  }

  private bumpVersion(): void {
    this.incrementVersion();
    this.updatedAt = new Date();
  }
}
