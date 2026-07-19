/**
 * @hrDataClassification SPECIAL_CATEGORY - ER allegations, investigation evidence, disciplinary outcomes, accommodation, and worker-linked case fields.
 */
import { AggregateRoot, DomainEvent, Uuid, Guard, ValidationError } from '@hcm/shared-kernel';
import { CASE_SEVERITIES, type CaseSeverity } from '@hcm/policy-engines';

export type EmployeeRelationsCaseStatus = 'OPEN' | 'UNDER_REVIEW' | 'INVESTIGATION' | 'DISCIPLINARY' | 'RESOLVED' | 'CLOSED' | 'ESCALATED';

export interface EmployeeRelationsCaseProps {
  id: Uuid;
  tenantId: Uuid;
  caseNumber: string;
  subjectWorkerId: Uuid;
  caseType: string;
  /**
   * NOTE: not currently persisted — the repository hardcodes 'LOW' on read and
   * `toRow()` drops it on write (pre-existing gap, same class of bug the
   * 20260620000001000_er_description_columns migration fixed for
   * DisciplinaryAction/AccommodationCase). Typed here for consistency with the
   * shared CaseSeverity taxonomy; wiring persistence + a case-level escalation
   * gate is a documented follow-up (see PR description), not done in this change.
   */
  severity: CaseSeverity;
  description: string;
  openedBy: Uuid;
  assignedTo?: Uuid;
  status?: EmployeeRelationsCaseStatus;
  aggregateVersion?: number;
  createdAt?: Date;
  updatedAt?: Date;
}

export class EmployeeRelationsCaseOpened extends DomainEvent {
  constructor(props: { tenantId: Uuid; aggregateId: Uuid; correlationId: Uuid }) {
    super({ eventName: 'EmployeeRelationsCaseOpened', tenantId: props.tenantId, aggregateType: 'EmployeeRelationsCase', aggregateId: props.aggregateId, correlationId: props.correlationId });
  }
}

export class EmployeeRelationsCaseReviewed extends DomainEvent {
  constructor(props: { tenantId: Uuid; aggregateId: Uuid; correlationId: Uuid }) {
    super({ eventName: 'EmployeeRelationsCaseReviewed', tenantId: props.tenantId, aggregateType: 'EmployeeRelationsCase', aggregateId: props.aggregateId, correlationId: props.correlationId });
  }
}

export class EmployeeRelationsCaseInvestigation extends DomainEvent {
  constructor(props: { tenantId: Uuid; aggregateId: Uuid; correlationId: Uuid }) {
    super({ eventName: 'EmployeeRelationsCaseInvestigation', tenantId: props.tenantId, aggregateType: 'EmployeeRelationsCase', aggregateId: props.aggregateId, correlationId: props.correlationId });
  }
}

export class EmployeeRelationsCaseDisciplinary extends DomainEvent {
  constructor(props: { tenantId: Uuid; aggregateId: Uuid; correlationId: Uuid }) {
    super({ eventName: 'EmployeeRelationsCaseDisciplinary', tenantId: props.tenantId, aggregateType: 'EmployeeRelationsCase', aggregateId: props.aggregateId, correlationId: props.correlationId });
  }
}

export class EmployeeRelationsCaseResolved extends DomainEvent {
  constructor(props: { tenantId: Uuid; aggregateId: Uuid; correlationId: Uuid }) {
    super({ eventName: 'EmployeeRelationsCaseResolved', tenantId: props.tenantId, aggregateType: 'EmployeeRelationsCase', aggregateId: props.aggregateId, correlationId: props.correlationId });
  }
}

export class EmployeeRelationsCaseClosed extends DomainEvent {
  constructor(props: { tenantId: Uuid; aggregateId: Uuid; correlationId: Uuid }) {
    super({ eventName: 'EmployeeRelationsCaseClosed', tenantId: props.tenantId, aggregateType: 'EmployeeRelationsCase', aggregateId: props.aggregateId, correlationId: props.correlationId });
  }
}

/** EmployeeRelationsCase aggregate. Restricted access - case subject/manager cannot be investigation owner (SoD). */
export class EmployeeRelationsCase extends AggregateRoot {
  private _aggregateVersion = 0;
  readonly tenantId: Uuid;
  caseNumber: string;
  subjectWorkerId: Uuid;
  caseType: string;
  severity: CaseSeverity;
  description: string;
  openedBy: Uuid;
  assignedTo?: Uuid;
  status: EmployeeRelationsCaseStatus;
  createdAt: Date;
  updatedAt: Date;

  get version(): number { return this._aggregateVersion; }
  get aggregateVersion(): number { return this._aggregateVersion; }
  incrementVersion(): void { this._aggregateVersion++; }

  constructor(props: EmployeeRelationsCaseProps) {
    super(props.id);
    this.tenantId = props.tenantId;
    this.caseNumber = props.caseNumber;
    this.subjectWorkerId = props.subjectWorkerId;
    this.caseType = props.caseType;
    this.severity = props.severity;
    this.description = props.description;
    this.openedBy = props.openedBy;
    this.assignedTo = props.assignedTo;
    this.status = props.status ?? 'OPEN';
    this.createdAt = props.createdAt ?? new Date();
    this.updatedAt = props.updatedAt ?? new Date();
    if (props.aggregateVersion !== undefined) this._aggregateVersion = props.aggregateVersion;
  }

  static open(props: EmployeeRelationsCaseProps, correlationId: Uuid): EmployeeRelationsCase {
    Guard.againstEmptyString(props.caseNumber, 'caseNumber');
    Guard.againstEmptyString(props.caseType, 'caseType');
    Guard.againstInvalidEnum(props.severity, CASE_SEVERITIES, 'severity');
    const erc = new EmployeeRelationsCase({ ...props, status: 'OPEN', createdAt: new Date(), updatedAt: new Date() });
    erc.addDomainEvent(new EmployeeRelationsCaseOpened({ tenantId: erc.tenantId, aggregateId: erc.id, correlationId }));
    return erc;
  }

  review(correlationId: Uuid): void {
    if (this.status !== 'OPEN') throw new ValidationError(`Cannot review from ${this.status}`);
    this.status = 'UNDER_REVIEW';
    this.addDomainEvent(new EmployeeRelationsCaseReviewed({ tenantId: this.tenantId, aggregateId: this.id, correlationId }));
    this.incrementVersion();
    this.updatedAt = new Date();
  }

  startInvestigation(correlationId: Uuid): void {
    if (this.status !== 'OPEN' && this.status !== 'UNDER_REVIEW') throw new ValidationError(`Cannot start investigation from ${this.status}`);
    this.status = 'INVESTIGATION';
    this.addDomainEvent(new EmployeeRelationsCaseInvestigation({ tenantId: this.tenantId, aggregateId: this.id, correlationId }));
    this.incrementVersion();
    this.updatedAt = new Date();
  }

  moveToDisciplinary(correlationId: Uuid): void {
    if (this.status !== 'INVESTIGATION') throw new ValidationError(`Cannot move to disciplinary from ${this.status}`);
    this.status = 'DISCIPLINARY';
    this.addDomainEvent(new EmployeeRelationsCaseDisciplinary({ tenantId: this.tenantId, aggregateId: this.id, correlationId }));
    this.incrementVersion();
    this.updatedAt = new Date();
  }

  resolve(correlationId: Uuid): void {
    if (this.status !== 'DISCIPLINARY' && this.status !== 'INVESTIGATION' && this.status !== 'UNDER_REVIEW') throw new ValidationError(`Cannot resolve from ${this.status}`);
    this.status = 'RESOLVED';
    this.addDomainEvent(new EmployeeRelationsCaseResolved({ tenantId: this.tenantId, aggregateId: this.id, correlationId }));
    this.incrementVersion();
    this.updatedAt = new Date();
  }

  close(correlationId: Uuid): void {
    if (this.status !== 'RESOLVED') throw new ValidationError(`Cannot close from ${this.status}`);
    this.status = 'CLOSED';
    this.addDomainEvent(new EmployeeRelationsCaseClosed({ tenantId: this.tenantId, aggregateId: this.id, correlationId }));
    this.incrementVersion();
    this.updatedAt = new Date();
  }
}
