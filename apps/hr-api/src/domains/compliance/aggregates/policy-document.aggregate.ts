import { AggregateRoot, DomainEvent, Uuid, ValidationError } from '@hcm/shared-kernel';

/**
 * Status values for the {@link PolicyDocument} lifecycle.
 */
export type PolicyDocumentStatus =
  | 'DRAFT'
  | 'PENDING_APPROVAL'
  | 'APPROVED'
  | 'PUBLISHED'
  | 'ARCHIVED'
  | 'REJECTED';

/**
 * Properties required to construct a {@link PolicyDocument}.
 */
export interface PolicyDocumentProps {
  id: Uuid;
  tenantId: Uuid;
  title: string;
  documentType: string;
  documentVersion: string;
  content: Record<string, unknown>;
  effectiveFrom?: Date;
  effectiveUntil?: Date;
  status?: PolicyDocumentStatus;
  aggregateVersion?: number;
  createdAt?: Date;
  updatedAt?: Date;
}

/* ------------------------------------------------------------------ */
/*  Domain Events                                                      */
/* ------------------------------------------------------------------ */

export class PolicyDocumentCreated extends DomainEvent {
  readonly title: string;
  readonly documentType: string;

  constructor(props: {
    tenantId: Uuid;
    aggregateId: Uuid;
    correlationId: Uuid;
    title: string;
    documentType: string;
  }) {
    super({
      eventName: 'PolicyDocumentCreated',
      tenantId: props.tenantId,
      aggregateType: 'PolicyDocument',
      aggregateId: props.aggregateId,
      correlationId: props.correlationId,
    });
    this.title = props.title;
    this.documentType = props.documentType;
  }
}

export class PolicyDocumentSubmitted extends DomainEvent {
  constructor(props: { tenantId: Uuid; aggregateId: Uuid; correlationId: Uuid }) {
    super({
      eventName: 'PolicyDocumentSubmitted',
      tenantId: props.tenantId,
      aggregateType: 'PolicyDocument',
      aggregateId: props.aggregateId,
      correlationId: props.correlationId,
    });
  }
}

export class PolicyDocumentRejected extends DomainEvent {
  constructor(props: { tenantId: Uuid; aggregateId: Uuid; correlationId: Uuid }) {
    super({
      eventName: 'PolicyDocumentRejected',
      tenantId: props.tenantId,
      aggregateType: 'PolicyDocument',
      aggregateId: props.aggregateId,
      correlationId: props.correlationId,
    });
  }
}

export class PolicyDocumentApproved extends DomainEvent {
  constructor(props: { tenantId: Uuid; aggregateId: Uuid; correlationId: Uuid }) {
    super({
      eventName: 'PolicyDocumentApproved',
      tenantId: props.tenantId,
      aggregateType: 'PolicyDocument',
      aggregateId: props.aggregateId,
      correlationId: props.correlationId,
    });
  }
}

export class PolicyDocumentPublished extends DomainEvent {
  constructor(props: { tenantId: Uuid; aggregateId: Uuid; correlationId: Uuid }) {
    super({
      eventName: 'PolicyDocumentPublished',
      tenantId: props.tenantId,
      aggregateType: 'PolicyDocument',
      aggregateId: props.aggregateId,
      correlationId: props.correlationId,
    });
  }
}

export class PolicyDocumentArchived extends DomainEvent {
  constructor(props: { tenantId: Uuid; aggregateId: Uuid; correlationId: Uuid }) {
    super({
      eventName: 'PolicyDocumentArchived',
      tenantId: props.tenantId,
      aggregateType: 'PolicyDocument',
      aggregateId: props.aggregateId,
      correlationId: props.correlationId,
    });
  }
}

/* ------------------------------------------------------------------ */
/*  Aggregate                                                          */
/* ------------------------------------------------------------------ */

/**
 * Aggregate root representing a policy document.
 *
 * FSM lifecycle: DRAFT → PENDING_APPROVAL → APPROVED → PUBLISHED → ARCHIVED (terminal)
 *                                    └→ REJECTED (terminal)
 */
export class PolicyDocument extends AggregateRoot {
  readonly tenantId: Uuid;
  title: string;
  documentType: string;
  documentVersion: string;
  content: Record<string, unknown>;
  effectiveFrom?: Date;
  effectiveUntil?: Date;
  status: PolicyDocumentStatus;
  createdAt: Date;
  updatedAt: Date;

  get aggregateVersion(): number {
    return this.version;
  }

  constructor(props: PolicyDocumentProps) {
    super(props.id);
    this.tenantId = props.tenantId;
    this.title = props.title;
    this.documentType = props.documentType;
    this.documentVersion = props.documentVersion;
    this.content = props.content;
    this.effectiveFrom = props.effectiveFrom;
    this.effectiveUntil = props.effectiveUntil;
    this.status = props.status ?? 'DRAFT';
    this.createdAt = props.createdAt ?? new Date();
    this.updatedAt = props.updatedAt ?? new Date();
    if (props.aggregateVersion !== undefined) {
      this.restoreVersion(props.aggregateVersion);
    }
  }

  /**
   * Factory method to create a new PolicyDocument in DRAFT state.
   */
  static create(props: PolicyDocumentProps, correlationId: Uuid): PolicyDocument {
    const doc = new PolicyDocument({
      ...props,
      status: 'DRAFT',
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    doc.addDomainEvent(
      new PolicyDocumentCreated({
        tenantId: doc.tenantId,
        aggregateId: doc.id,
        correlationId,
        title: doc.title,
        documentType: doc.documentType,
      }),
    );

    return doc;
  }

  /**
   * Submit for approval (DRAFT → PENDING_APPROVAL).
   */
  submitForApproval(correlationId: Uuid): void {
    if (this.status !== 'DRAFT') {
      throw new ValidationError(`Cannot submit for approval from state ${this.status}`);
    }
    this.status = 'PENDING_APPROVAL';
    this.addDomainEvent(
      new PolicyDocumentSubmitted({
        tenantId: this.tenantId,
        aggregateId: this.id,
        correlationId,
      }),
    );
    this.incrementVersion();
    this.updatedAt = new Date();
  }

  /**
   * Approve the policy document (PENDING_APPROVAL → APPROVED).
   */
  approve(correlationId: Uuid): void {
    if (this.status !== 'PENDING_APPROVAL') {
      throw new ValidationError(`Cannot approve from state ${this.status}`);
    }
    this.status = 'APPROVED';
    this.addDomainEvent(
      new PolicyDocumentApproved({
        tenantId: this.tenantId,
        aggregateId: this.id,
        correlationId,
      }),
    );
    this.incrementVersion();
    this.updatedAt = new Date();
  }

  /**
   * Reject the policy document (PENDING_APPROVAL → REJECTED).
   */
  reject(correlationId: Uuid): void {
    if (this.status !== 'PENDING_APPROVAL') {
      throw new ValidationError(`Cannot reject from state ${this.status}`);
    }
    this.status = 'REJECTED';
    this.addDomainEvent(
      new PolicyDocumentRejected({
        tenantId: this.tenantId,
        aggregateId: this.id,
        correlationId,
      }),
    );
    this.incrementVersion();
    this.updatedAt = new Date();
  }

  /**
   * Publish the policy document (APPROVED → PUBLISHED).
   */
  publish(correlationId: Uuid): void {
    if (this.status !== 'APPROVED') {
      throw new ValidationError(`Cannot publish from state ${this.status}`);
    }
    this.status = 'PUBLISHED';
    this.addDomainEvent(
      new PolicyDocumentPublished({
        tenantId: this.tenantId,
        aggregateId: this.id,
        correlationId,
      }),
    );
    this.incrementVersion();
    this.updatedAt = new Date();
  }

  /**
   * Archive the policy document (PUBLISHED → ARCHIVED).
   */
  archive(correlationId: Uuid): void {
    if (this.status !== 'PUBLISHED') {
      throw new ValidationError(`Cannot archive from state ${this.status}`);
    }
    this.status = 'ARCHIVED';
    this.addDomainEvent(
      new PolicyDocumentArchived({
        tenantId: this.tenantId,
        aggregateId: this.id,
        correlationId,
      }),
    );
    this.incrementVersion();
    this.updatedAt = new Date();
  }
}
