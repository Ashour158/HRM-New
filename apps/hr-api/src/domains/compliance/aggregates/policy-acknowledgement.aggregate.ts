import { AggregateRoot, DomainEvent, Uuid, ValidationError } from '@hcm/shared-kernel';

/**
 * Status values for the {@link PolicyAcknowledgement} lifecycle.
 */
export type PolicyAcknowledgementStatus = 'REQUIRED' | 'ACKNOWLEDGED' | 'OVERDUE' | 'ESCALATED';

/**
 * Properties required to construct a {@link PolicyAcknowledgement}.
 */
export interface PolicyAcknowledgementProps {
  id: Uuid;
  tenantId: Uuid;
  workerId: Uuid;
  policyDocumentId: Uuid;
  acknowledgedAt?: Date;
  dueDate: Date;
  status?: PolicyAcknowledgementStatus;
  aggregateVersion?: number;
  createdAt?: Date;
  updatedAt?: Date;
}

/* ------------------------------------------------------------------ */
/*  Domain Events                                                      */
/* ------------------------------------------------------------------ */

export class PolicyAcknowledgementRequired extends DomainEvent {
  readonly workerId: string;
  readonly policyDocumentId: string;

  constructor(props: {
    tenantId: Uuid;
    aggregateId: Uuid;
    correlationId: Uuid;
    workerId: Uuid;
    policyDocumentId: Uuid;
  }) {
    super({
      eventName: 'PolicyAcknowledgementRequired',
      tenantId: props.tenantId,
      aggregateType: 'PolicyAcknowledgement',
      aggregateId: props.aggregateId,
      correlationId: props.correlationId,
    });
    this.workerId = props.workerId.value;
    this.policyDocumentId = props.policyDocumentId.value;
  }
}

export class PolicyAcknowledged extends DomainEvent {
  readonly workerId: string;
  readonly policyDocumentId: string;

  constructor(props: {
    tenantId: Uuid;
    aggregateId: Uuid;
    correlationId: Uuid;
    workerId: Uuid;
    policyDocumentId: Uuid;
  }) {
    super({
      eventName: 'PolicyAcknowledged',
      tenantId: props.tenantId,
      aggregateType: 'PolicyAcknowledgement',
      aggregateId: props.aggregateId,
      correlationId: props.correlationId,
    });
    this.workerId = props.workerId.value;
    this.policyDocumentId = props.policyDocumentId.value;
  }
}

export class PolicyAcknowledgementOverdue extends DomainEvent {
  readonly workerId: string;
  readonly policyDocumentId: string;

  constructor(props: {
    tenantId: Uuid;
    aggregateId: Uuid;
    correlationId: Uuid;
    workerId: Uuid;
    policyDocumentId: Uuid;
  }) {
    super({
      eventName: 'PolicyAcknowledgementOverdue',
      tenantId: props.tenantId,
      aggregateType: 'PolicyAcknowledgement',
      aggregateId: props.aggregateId,
      correlationId: props.correlationId,
    });
    this.workerId = props.workerId.value;
    this.policyDocumentId = props.policyDocumentId.value;
  }
}

export class PolicyAcknowledgementEscalated extends DomainEvent {
  readonly workerId: string;
  readonly policyDocumentId: string;

  constructor(props: {
    tenantId: Uuid;
    aggregateId: Uuid;
    correlationId: Uuid;
    workerId: Uuid;
    policyDocumentId: Uuid;
  }) {
    super({
      eventName: 'PolicyAcknowledgementEscalated',
      tenantId: props.tenantId,
      aggregateType: 'PolicyAcknowledgement',
      aggregateId: props.aggregateId,
      correlationId: props.correlationId,
    });
    this.workerId = props.workerId.value;
    this.policyDocumentId = props.policyDocumentId.value;
  }
}

/* ------------------------------------------------------------------ */
/*  Aggregate                                                          */
/* ------------------------------------------------------------------ */

/**
 * Aggregate root representing a worker's acknowledgement of a policy document.
 *
 * FSM lifecycle: REQUIRED → ACKNOWLEDGED | OVERDUE → ESCALATED (terminal)
 */
export class PolicyAcknowledgement extends AggregateRoot {
  readonly tenantId: Uuid;
  workerId: Uuid;
  policyDocumentId: Uuid;
  acknowledgedAt?: Date;
  dueDate: Date;
  status: PolicyAcknowledgementStatus;
  createdAt: Date;
  updatedAt: Date;

  get aggregateVersion(): number {
    return this.version;
  }

  constructor(props: PolicyAcknowledgementProps) {
    super(props.id);
    this.tenantId = props.tenantId;
    this.workerId = props.workerId;
    this.policyDocumentId = props.policyDocumentId;
    this.acknowledgedAt = props.acknowledgedAt;
    this.dueDate = props.dueDate;
    this.status = props.status ?? 'REQUIRED';
    this.createdAt = props.createdAt ?? new Date();
    this.updatedAt = props.updatedAt ?? new Date();
    if (props.aggregateVersion !== undefined) {
      this.restoreVersion(props.aggregateVersion);
    }
  }

  /**
   * Factory method to create a new PolicyAcknowledgement in REQUIRED state.
   */
  static create(props: PolicyAcknowledgementProps, correlationId: Uuid): PolicyAcknowledgement {
    const ack = new PolicyAcknowledgement({
      ...props,
      status: 'REQUIRED',
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    ack.addDomainEvent(
      new PolicyAcknowledgementRequired({
        tenantId: ack.tenantId,
        aggregateId: ack.id,
        correlationId,
        workerId: ack.workerId,
        policyDocumentId: ack.policyDocumentId,
      }),
    );

    return ack;
  }

  /**
   * Record acknowledgement (REQUIRED → ACKNOWLEDGED).
   */
  recordAcknowledgement(correlationId: Uuid): void {
    if (this.status !== 'REQUIRED' && this.status !== 'OVERDUE') {
      throw new ValidationError(`Cannot acknowledge from state ${this.status}`);
    }
    this.status = 'ACKNOWLEDGED';
    this.acknowledgedAt = new Date();
    this.addDomainEvent(
      new PolicyAcknowledged({
        tenantId: this.tenantId,
        aggregateId: this.id,
        correlationId,
        workerId: this.workerId,
        policyDocumentId: this.policyDocumentId,
      }),
    );
    this.incrementVersion();
    this.updatedAt = new Date();
  }

  /**
   * Mark as overdue (REQUIRED → OVERDUE).
   */
  markOverdue(correlationId: Uuid): void {
    if (this.status !== 'REQUIRED') {
      throw new ValidationError(`Cannot mark overdue from state ${this.status}`);
    }
    this.status = 'OVERDUE';
    this.addDomainEvent(
      new PolicyAcknowledgementOverdue({
        tenantId: this.tenantId,
        aggregateId: this.id,
        correlationId,
        workerId: this.workerId,
        policyDocumentId: this.policyDocumentId,
      }),
    );
    this.incrementVersion();
    this.updatedAt = new Date();
  }

  /**
   * Escalate the overdue acknowledgement (OVERDUE → ESCALATED).
   */
  escalate(correlationId: Uuid): void {
    if (this.status !== 'OVERDUE') {
      throw new ValidationError(`Cannot escalate from state ${this.status}`);
    }
    this.status = 'ESCALATED';
    this.addDomainEvent(
      new PolicyAcknowledgementEscalated({
        tenantId: this.tenantId,
        aggregateId: this.id,
        correlationId,
        workerId: this.workerId,
        policyDocumentId: this.policyDocumentId,
      }),
    );
    this.incrementVersion();
    this.updatedAt = new Date();
  }
}
