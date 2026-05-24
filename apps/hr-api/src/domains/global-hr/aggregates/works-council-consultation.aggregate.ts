import { AggregateRoot, DomainEvent, Uuid, Guard, ValidationError } from '@hcm/shared-kernel';

/**
 * Status values for the {@link WorksCouncilConsultation} lifecycle.
 */
export type WorksCouncilConsultationStatus =
  | 'REQUIRED'
  | 'INITIATED'
  | 'IN_PROGRESS'
  | 'COMPLETED'
  | 'BLOCKED';

/**
 * Properties required to construct a {@link WorksCouncilConsultation}.
 */
export interface WorksCouncilConsultationProps {
  id: Uuid;
  tenantId: Uuid;
  countryCode: string;
  legalEntityId: Uuid;
  actionType: string;
  consultationType: string;
  initiatedAt?: Date;
  deadlineDate?: Date;
  completedAt?: Date;
  blockingUntil?: Date;
  status?: WorksCouncilConsultationStatus;
  aggregateVersion?: number;
  createdAt?: Date;
  updatedAt?: Date;
}

/* ------------------------------------------------------------------ */
/*  Domain Events                                                      */
/* ------------------------------------------------------------------ */

export class WorksCouncilConsultationRequired extends DomainEvent {
  readonly legalEntityId: string;
  readonly actionType: string;

  constructor(props: {
    tenantId: Uuid;
    aggregateId: Uuid;
    correlationId: Uuid;
    legalEntityId: Uuid;
    actionType: string;
  }) {
    super({
      eventName: 'WorksCouncilConsultationRequired',
      tenantId: props.tenantId,
      aggregateType: 'WorksCouncilConsultation',
      aggregateId: props.aggregateId,
      correlationId: props.correlationId,
    });
    this.legalEntityId = props.legalEntityId.value;
    this.actionType = props.actionType;
  }
}

export class WorksCouncilConsultationInitiated extends DomainEvent {
  readonly legalEntityId: string;

  constructor(props: {
    tenantId: Uuid;
    aggregateId: Uuid;
    correlationId: Uuid;
    legalEntityId: Uuid;
  }) {
    super({
      eventName: 'WorksCouncilConsultationInitiated',
      tenantId: props.tenantId,
      aggregateType: 'WorksCouncilConsultation',
      aggregateId: props.aggregateId,
      correlationId: props.correlationId,
    });
    this.legalEntityId = props.legalEntityId.value;
  }
}

export class WorksCouncilConsultationCompleted extends DomainEvent {
  readonly legalEntityId: string;

  constructor(props: {
    tenantId: Uuid;
    aggregateId: Uuid;
    correlationId: Uuid;
    legalEntityId: Uuid;
  }) {
    super({
      eventName: 'WorksCouncilConsultationCompleted',
      tenantId: props.tenantId,
      aggregateType: 'WorksCouncilConsultation',
      aggregateId: props.aggregateId,
      correlationId: props.correlationId,
    });
    this.legalEntityId = props.legalEntityId.value;
  }
}

export class WorksCouncilActionBlocked extends DomainEvent {
  readonly legalEntityId: string;
  readonly actionType: string;

  constructor(props: {
    tenantId: Uuid;
    aggregateId: Uuid;
    correlationId: Uuid;
    legalEntityId: Uuid;
    actionType: string;
  }) {
    super({
      eventName: 'WorksCouncilActionBlocked',
      tenantId: props.tenantId,
      aggregateType: 'WorksCouncilConsultation',
      aggregateId: props.aggregateId,
      correlationId: props.correlationId,
    });
    this.legalEntityId = props.legalEntityId.value;
    this.actionType = props.actionType;
  }
}

/* ------------------------------------------------------------------ */
/*  Aggregate                                                          */
/* ------------------------------------------------------------------ */

/**
 * Aggregate root representing a works council consultation.
 *
 * FSM lifecycle: REQUIRED → INITIATED → IN_PROGRESS → COMPLETED
 *                                    └→ BLOCKED (terminal)
 *
 * Blocking: certain actions (termination, restructuring) cannot proceed
 * until consultation is complete.
 */
export class WorksCouncilConsultation extends AggregateRoot {
  readonly tenantId: Uuid;
  countryCode: string;
  legalEntityId: Uuid;
  actionType: string;
  consultationType: string;
  initiatedAt?: Date;
  deadlineDate?: Date;
  completedAt?: Date;
  blockingUntil?: Date;
  status: WorksCouncilConsultationStatus;
  createdAt: Date;
  updatedAt: Date;

  get aggregateVersion(): number {
    return this.version;
  }

  constructor(props: WorksCouncilConsultationProps) {
    super(props.id);
    this.tenantId = props.tenantId;
    this.countryCode = props.countryCode;
    this.legalEntityId = props.legalEntityId;
    this.actionType = props.actionType;
    this.consultationType = props.consultationType;
    this.initiatedAt = props.initiatedAt;
    this.deadlineDate = props.deadlineDate;
    this.completedAt = props.completedAt;
    this.blockingUntil = props.blockingUntil;
    this.status = props.status ?? 'REQUIRED';
    this.createdAt = props.createdAt ?? new Date();
    this.updatedAt = props.updatedAt ?? new Date();
    if (props.aggregateVersion !== undefined) {
      this.restoreVersion(props.aggregateVersion);
    }
  }

  /**
   * Factory method to create a new WorksCouncilConsultation in REQUIRED state.
   */
  static create(props: WorksCouncilConsultationProps, correlationId: Uuid): WorksCouncilConsultation {
    Guard.againstEmptyString(props.countryCode, 'countryCode');
    Guard.againstEmptyString(props.actionType, 'actionType');

    const consultation = new WorksCouncilConsultation({
      ...props,
      status: 'REQUIRED',
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    consultation.addDomainEvent(
      new WorksCouncilConsultationRequired({
        tenantId: consultation.tenantId,
        aggregateId: consultation.id,
        correlationId,
        legalEntityId: consultation.legalEntityId,
        actionType: consultation.actionType,
      }),
    );

    return consultation;
  }

  /**
   * Initiate the consultation (REQUIRED → INITIATED).
   */
  initiate(correlationId: Uuid, deadlineDate: Date): void {
    if (this.status !== 'REQUIRED') {
      throw new ValidationError(`Cannot initiate from state ${this.status}`);
    }
    this.status = 'INITIATED';
    this.initiatedAt = new Date();
    this.deadlineDate = deadlineDate;
    this.addDomainEvent(
      new WorksCouncilConsultationInitiated({
        tenantId: this.tenantId,
        aggregateId: this.id,
        correlationId,
        legalEntityId: this.legalEntityId,
      }),
    );
    this.incrementVersion();
    this.updatedAt = new Date();
  }

  /**
   * Move to in-progress (INITIATED → IN_PROGRESS).
   */
  startProgress(_correlationId: Uuid): void {
    if (this.status !== 'INITIATED') {
      throw new ValidationError(`Cannot start progress from state ${this.status}`);
    }
    this.status = 'IN_PROGRESS';
    this.incrementVersion();
    this.updatedAt = new Date();
  }

  /**
   * Complete the consultation (IN_PROGRESS → COMPLETED).
   */
  complete(correlationId: Uuid): void {
    if (this.status !== 'IN_PROGRESS') {
      throw new ValidationError(`Cannot complete from state ${this.status}`);
    }
    this.status = 'COMPLETED';
    this.completedAt = new Date();
    this.blockingUntil = undefined;
    this.addDomainEvent(
      new WorksCouncilConsultationCompleted({
        tenantId: this.tenantId,
        aggregateId: this.id,
        correlationId,
        legalEntityId: this.legalEntityId,
      }),
    );
    this.incrementVersion();
    this.updatedAt = new Date();
  }

  /**
   * Block the action (INITIATED | IN_PROGRESS → BLOCKED).
   */
  block(correlationId: Uuid, blockingUntil?: Date): void {
    if (this.status !== 'INITIATED' && this.status !== 'IN_PROGRESS') {
      throw new ValidationError(`Cannot block from state ${this.status}`);
    }
    this.status = 'BLOCKED';
    this.blockingUntil = blockingUntil;
    this.addDomainEvent(
      new WorksCouncilActionBlocked({
        tenantId: this.tenantId,
        aggregateId: this.id,
        correlationId,
        legalEntityId: this.legalEntityId,
        actionType: this.actionType,
      }),
    );
    this.incrementVersion();
    this.updatedAt = new Date();
  }

  /**
   * Check whether this consultation currently blocks an action.
   */
  isBlocking(): boolean {
    return this.status === 'REQUIRED' || this.status === 'INITIATED' || this.status === 'IN_PROGRESS';
  }
}
