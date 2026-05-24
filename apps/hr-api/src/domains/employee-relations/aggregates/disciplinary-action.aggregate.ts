import { AggregateRoot, DomainEvent, Uuid, Guard, ValidationError } from '@hcm/shared-kernel';

export type DisciplinaryActionStatus = 'DRAFT' | 'PENDING_APPROVAL' | 'APPROVED' | 'EXECUTED' | 'APPEALED' | 'UPHELD' | 'REVOKED' | 'CANCELLED';

export interface DisciplinaryActionProps {
  id: Uuid;
  tenantId: Uuid;
  workerId: Uuid;
  erCaseId: Uuid;
  actionType: string;
  severity: string;
  description: string;
  effectiveDate: Date;
  approvedBy?: Uuid;
  executedAt?: Date;
  appealDeadline?: Date;
  status?: DisciplinaryActionStatus;
  aggregateVersion?: number;
  createdAt?: Date;
  updatedAt?: Date;
}

export class DisciplinaryActionDrafted extends DomainEvent {
  constructor(props: { tenantId: Uuid; aggregateId: Uuid; correlationId: Uuid }) {
    super({ eventName: 'DisciplinaryActionDrafted', tenantId: props.tenantId, aggregateType: 'DisciplinaryAction', aggregateId: props.aggregateId, correlationId: props.correlationId });
  }
}

export class DisciplinaryActionApproved extends DomainEvent {
  readonly approvedBy: string;
  constructor(props: { tenantId: Uuid; aggregateId: Uuid; correlationId: Uuid; approvedBy: Uuid }) {
    super({ eventName: 'DisciplinaryActionApproved', tenantId: props.tenantId, aggregateType: 'DisciplinaryAction', aggregateId: props.aggregateId, correlationId: props.correlationId });
    this.approvedBy = props.approvedBy.value;
  }
}

export class DisciplinaryActionExecuted extends DomainEvent {
  constructor(props: { tenantId: Uuid; aggregateId: Uuid; correlationId: Uuid }) {
    super({ eventName: 'DisciplinaryActionExecuted', tenantId: props.tenantId, aggregateType: 'DisciplinaryAction', aggregateId: props.aggregateId, correlationId: props.correlationId });
  }
}

export class DisciplinaryActionAppealed extends DomainEvent {
  constructor(props: { tenantId: Uuid; aggregateId: Uuid; correlationId: Uuid }) {
    super({ eventName: 'DisciplinaryActionAppealed', tenantId: props.tenantId, aggregateType: 'DisciplinaryAction', aggregateId: props.aggregateId, correlationId: props.correlationId });
  }
}

export class DisciplinaryActionUpheld extends DomainEvent {
  constructor(props: { tenantId: Uuid; aggregateId: Uuid; correlationId: Uuid }) {
    super({ eventName: 'DisciplinaryActionUpheld', tenantId: props.tenantId, aggregateType: 'DisciplinaryAction', aggregateId: props.aggregateId, correlationId: props.correlationId });
  }
}

export class DisciplinaryActionRevoked extends DomainEvent {
  constructor(props: { tenantId: Uuid; aggregateId: Uuid; correlationId: Uuid }) {
    super({ eventName: 'DisciplinaryActionRevoked', tenantId: props.tenantId, aggregateType: 'DisciplinaryAction', aggregateId: props.aggregateId, correlationId: props.correlationId });
  }
}

/** DisciplinaryAction aggregate. States: DRAFT → PENDING_APPROVAL → APPROVED → EXECUTED → APPEALED → UPHELD | REVOKED | CANCELLED. */
export class DisciplinaryAction extends AggregateRoot {
  private _aggregateVersion = 0;
  readonly tenantId: Uuid;
  workerId: Uuid;
  erCaseId: Uuid;
  actionType: string;
  severity: string;
  description: string;
  effectiveDate: Date;
  approvedBy?: Uuid;
  executedAt?: Date;
  appealDeadline?: Date;
  status: DisciplinaryActionStatus;
  createdAt: Date;
  updatedAt: Date;

  get version(): number { return this._aggregateVersion; }
  get aggregateVersion(): number { return this._aggregateVersion; }
  incrementVersion(): void { this._aggregateVersion++; }

  constructor(props: DisciplinaryActionProps) {
    super(props.id);
    this.tenantId = props.tenantId;
    this.workerId = props.workerId;
    this.erCaseId = props.erCaseId;
    this.actionType = props.actionType;
    this.severity = props.severity;
    this.description = props.description;
    this.effectiveDate = props.effectiveDate;
    this.approvedBy = props.approvedBy;
    this.executedAt = props.executedAt;
    this.appealDeadline = props.appealDeadline;
    this.status = props.status ?? 'DRAFT';
    this.createdAt = props.createdAt ?? new Date();
    this.updatedAt = props.updatedAt ?? new Date();
    if (props.aggregateVersion !== undefined) this._aggregateVersion = props.aggregateVersion;
  }

  static draft(props: DisciplinaryActionProps, correlationId: Uuid): DisciplinaryAction {
    Guard.againstEmptyString(props.actionType, 'actionType');
    const da = new DisciplinaryAction({ ...props, status: 'DRAFT', createdAt: new Date(), updatedAt: new Date() });
    da.addDomainEvent(new DisciplinaryActionDrafted({ tenantId: da.tenantId, aggregateId: da.id, correlationId }));
    return da;
  }

  approve(approvedBy: Uuid, correlationId: Uuid): void {
    if (this.status !== 'DRAFT' && this.status !== 'PENDING_APPROVAL') throw new ValidationError(`Cannot approve from ${this.status}`);
    this.status = 'APPROVED';
    this.approvedBy = approvedBy;
    this.addDomainEvent(new DisciplinaryActionApproved({ tenantId: this.tenantId, aggregateId: this.id, correlationId, approvedBy }));
    this.incrementVersion();
    this.updatedAt = new Date();
  }

  execute(correlationId: Uuid): void {
    if (this.status !== 'APPROVED') throw new ValidationError(`Cannot execute from ${this.status}`);
    this.status = 'EXECUTED';
    this.executedAt = new Date();
    this.addDomainEvent(new DisciplinaryActionExecuted({ tenantId: this.tenantId, aggregateId: this.id, correlationId }));
    this.incrementVersion();
    this.updatedAt = new Date();
  }

  appeal(correlationId: Uuid): void {
    if (this.status !== 'EXECUTED') throw new ValidationError(`Cannot appeal from ${this.status}`);
    this.status = 'APPEALED';
    this.addDomainEvent(new DisciplinaryActionAppealed({ tenantId: this.tenantId, aggregateId: this.id, correlationId }));
    this.incrementVersion();
    this.updatedAt = new Date();
  }

  uphold(correlationId: Uuid): void {
    if (this.status !== 'APPEALED') throw new ValidationError(`Cannot uphold from ${this.status}`);
    this.status = 'UPHELD';
    this.addDomainEvent(new DisciplinaryActionUpheld({ tenantId: this.tenantId, aggregateId: this.id, correlationId }));
    this.incrementVersion();
    this.updatedAt = new Date();
  }

  revoke(correlationId: Uuid): void {
    if (this.status !== 'APPEALED' && this.status !== 'EXECUTED' && this.status !== 'APPROVED') throw new ValidationError(`Cannot revoke from ${this.status}`);
    this.status = 'REVOKED';
    this.addDomainEvent(new DisciplinaryActionRevoked({ tenantId: this.tenantId, aggregateId: this.id, correlationId }));
    this.incrementVersion();
    this.updatedAt = new Date();
  }
}
