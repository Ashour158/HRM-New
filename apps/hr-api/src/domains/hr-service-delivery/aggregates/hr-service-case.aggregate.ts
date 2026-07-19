import { AggregateRoot, DomainEvent, Uuid, Guard, ValidationError } from '@hcm/shared-kernel';

export type HrServiceCaseStatus = 'OPEN' | 'IN_PROGRESS' | 'PENDING_CUSTOMER' | 'RESOLVED' | 'CLOSED' | 'ESCALATED';

/** States from which a case is still actively being worked and can be escalated or reassigned. */
const ACTIVE_STATUSES: HrServiceCaseStatus[] = ['OPEN', 'IN_PROGRESS', 'PENDING_CUSTOMER'];

export interface HrServiceCaseProps {
  id: Uuid;
  tenantId: Uuid;
  caseNumber: string;
  requesterWorkerId: Uuid;
  caseType: string;
  priority: string;
  description: string;
  assignedTo?: Uuid;
  slaDeadline?: Date;
  resolvedAt?: Date;
  catalogItemId?: Uuid;
  ownerGroup?: string;
  escalationReason?: string;
  escalatedAt?: Date;
  escalatedBy?: Uuid;
  status?: HrServiceCaseStatus;
  aggregateVersion?: number;
  createdAt?: Date;
  updatedAt?: Date;
}

export class HrServiceCaseOpened extends DomainEvent {
  constructor(props: { tenantId: Uuid; aggregateId: Uuid; correlationId: Uuid }) {
    super({ eventName: 'HrServiceCaseOpened', tenantId: props.tenantId, aggregateType: 'HrServiceCase', aggregateId: props.aggregateId, correlationId: props.correlationId });
  }
}

export class HrServiceCaseInProgress extends DomainEvent {
  constructor(props: { tenantId: Uuid; aggregateId: Uuid; correlationId: Uuid }) {
    super({ eventName: 'HrServiceCaseInProgress', tenantId: props.tenantId, aggregateType: 'HrServiceCase', aggregateId: props.aggregateId, correlationId: props.correlationId });
  }
}

export class HrServiceCasePendingCustomer extends DomainEvent {
  constructor(props: { tenantId: Uuid; aggregateId: Uuid; correlationId: Uuid }) {
    super({ eventName: 'HrServiceCasePendingCustomer', tenantId: props.tenantId, aggregateType: 'HrServiceCase', aggregateId: props.aggregateId, correlationId: props.correlationId });
  }
}

export class HrServiceCaseResolved extends DomainEvent {
  constructor(props: { tenantId: Uuid; aggregateId: Uuid; correlationId: Uuid }) {
    super({ eventName: 'HrServiceCaseResolved', tenantId: props.tenantId, aggregateType: 'HrServiceCase', aggregateId: props.aggregateId, correlationId: props.correlationId });
  }
}

export class HrServiceCaseClosed extends DomainEvent {
  constructor(props: { tenantId: Uuid; aggregateId: Uuid; correlationId: Uuid }) {
    super({ eventName: 'HrServiceCaseClosed', tenantId: props.tenantId, aggregateType: 'HrServiceCase', aggregateId: props.aggregateId, correlationId: props.correlationId });
  }
}

export class HrServiceCaseEscalated extends DomainEvent {
  constructor(props: { tenantId: Uuid; aggregateId: Uuid; correlationId: Uuid }) {
    super({ eventName: 'HrServiceCaseEscalated', tenantId: props.tenantId, aggregateType: 'HrServiceCase', aggregateId: props.aggregateId, correlationId: props.correlationId });
  }
}

export class HrServiceCaseReassigned extends DomainEvent {
  constructor(props: { tenantId: Uuid; aggregateId: Uuid; correlationId: Uuid }) {
    super({ eventName: 'HrServiceCaseReassigned', tenantId: props.tenantId, aggregateType: 'HrServiceCase', aggregateId: props.aggregateId, correlationId: props.correlationId });
  }
}

export class HrServiceCase extends AggregateRoot {
  private _aggregateVersion = 0;
  readonly tenantId: Uuid;
  caseNumber: string;
  requesterWorkerId: Uuid;
  caseType: string;
  priority: string;
  description: string;
  assignedTo?: Uuid;
  slaDeadline?: Date;
  resolvedAt?: Date;
  catalogItemId?: Uuid;
  ownerGroup?: string;
  escalationReason?: string;
  escalatedAt?: Date;
  escalatedBy?: Uuid;
  status: HrServiceCaseStatus;
  createdAt: Date;
  updatedAt: Date;

  get version(): number { return this._aggregateVersion; }
  get aggregateVersion(): number { return this._aggregateVersion; }
  incrementVersion(): void { this._aggregateVersion++; }

  constructor(props: HrServiceCaseProps) {
    super(props.id);
    this.tenantId = props.tenantId;
    this.caseNumber = props.caseNumber;
    this.requesterWorkerId = props.requesterWorkerId;
    this.caseType = props.caseType;
    this.priority = props.priority;
    this.description = props.description;
    this.assignedTo = props.assignedTo;
    this.slaDeadline = props.slaDeadline;
    this.resolvedAt = props.resolvedAt;
    this.catalogItemId = props.catalogItemId;
    this.ownerGroup = props.ownerGroup;
    this.escalationReason = props.escalationReason;
    this.escalatedAt = props.escalatedAt;
    this.escalatedBy = props.escalatedBy;
    this.status = props.status ?? 'OPEN';
    this.createdAt = props.createdAt ?? new Date();
    this.updatedAt = props.updatedAt ?? new Date();
    if (props.aggregateVersion !== undefined) this._aggregateVersion = props.aggregateVersion;
  }

  static open(props: HrServiceCaseProps, correlationId: Uuid): HrServiceCase {
    Guard.againstEmptyString(props.caseNumber, 'caseNumber');
    const sc = new HrServiceCase({ ...props, status: 'OPEN', createdAt: new Date(), updatedAt: new Date() });
    sc.addDomainEvent(new HrServiceCaseOpened({ tenantId: sc.tenantId, aggregateId: sc.id, correlationId }));
    return sc;
  }

  markInProgress(correlationId: Uuid): void {
    if (this.status !== 'OPEN') throw new ValidationError(`Cannot mark in progress from ${this.status}`);
    this.status = 'IN_PROGRESS';
    this.addDomainEvent(new HrServiceCaseInProgress({ tenantId: this.tenantId, aggregateId: this.id, correlationId }));
    this.incrementVersion();
    this.updatedAt = new Date();
  }

  markPendingCustomer(correlationId: Uuid): void {
    if (this.status !== 'IN_PROGRESS') throw new ValidationError(`Cannot mark pending customer from ${this.status}`);
    this.status = 'PENDING_CUSTOMER';
    this.addDomainEvent(new HrServiceCasePendingCustomer({ tenantId: this.tenantId, aggregateId: this.id, correlationId }));
    this.incrementVersion();
    this.updatedAt = new Date();
  }

  resolve(correlationId: Uuid): void {
    if (this.status !== 'IN_PROGRESS' && this.status !== 'PENDING_CUSTOMER') throw new ValidationError(`Cannot resolve from ${this.status}`);
    this.status = 'RESOLVED';
    this.resolvedAt = new Date();
    this.addDomainEvent(new HrServiceCaseResolved({ tenantId: this.tenantId, aggregateId: this.id, correlationId }));
    this.incrementVersion();
    this.updatedAt = new Date();
  }

  close(correlationId: Uuid): void {
    if (this.status !== 'RESOLVED') throw new ValidationError(`Cannot close from ${this.status}`);
    this.status = 'CLOSED';
    this.addDomainEvent(new HrServiceCaseClosed({ tenantId: this.tenantId, aggregateId: this.id, correlationId }));
    this.incrementVersion();
    this.updatedAt = new Date();
  }

  /**
   * Escalates the case out of normal handling. Callable by the currently
   * assigned agent or an HR service delivery administrator (enforced by the
   * API layer) while the case is still actively being worked. ESCALATED is a
   * terminal FSM state: escalated cases are handled outside the normal
   * queue and require a new case or manual intervention to re-open.
   */
  escalate(escalationReason: string, escalatedBy: Uuid, correlationId: Uuid): void {
    if (!ACTIVE_STATUSES.includes(this.status)) throw new ValidationError(`Cannot escalate from ${this.status}`);
    Guard.againstEmptyString(escalationReason, 'escalationReason');
    this.status = 'ESCALATED';
    this.escalationReason = escalationReason;
    this.escalatedAt = new Date();
    this.escalatedBy = escalatedBy;
    this.addDomainEvent(new HrServiceCaseEscalated({ tenantId: this.tenantId, aggregateId: this.id, correlationId }));
    this.incrementVersion();
    this.updatedAt = new Date();
  }

  /**
   * Reassigns the case to a different agent (and optionally a different
   * owner group) after it has already been opened. Only valid while the
   * case is still actively being worked; a resolved, closed, or escalated
   * case must go through its own workflow instead.
   */
  reassign(assignedTo: Uuid, correlationId: Uuid, ownerGroup?: string): void {
    if (!ACTIVE_STATUSES.includes(this.status)) throw new ValidationError(`Cannot reassign a case from ${this.status}`);
    this.assignedTo = assignedTo;
    if (ownerGroup !== undefined) this.ownerGroup = ownerGroup;
    this.addDomainEvent(new HrServiceCaseReassigned({ tenantId: this.tenantId, aggregateId: this.id, correlationId }));
    this.incrementVersion();
    this.updatedAt = new Date();
  }
}
