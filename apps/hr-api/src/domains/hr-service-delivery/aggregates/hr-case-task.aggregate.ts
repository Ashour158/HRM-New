import { AggregateRoot, DomainEvent, Uuid, Guard, ValidationError } from '@hcm/shared-kernel';

export type HrCaseTaskStatus = 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'OVERDUE' | 'CANCELLED';

export interface HrCaseTaskProps {
  id: Uuid;
  tenantId: Uuid;
  caseId: Uuid;
  title: string;
  assignedTo?: Uuid;
  dueDate?: Date;
  completedAt?: Date;
  status?: HrCaseTaskStatus;
  aggregateVersion?: number;
  createdAt?: Date;
  updatedAt?: Date;
}

export class HrCaseTaskCreated extends DomainEvent {
  constructor(props: { tenantId: Uuid; aggregateId: Uuid; correlationId: Uuid }) {
    super({ eventName: 'HrCaseTaskCreated', tenantId: props.tenantId, aggregateType: 'HrCaseTask', aggregateId: props.aggregateId, correlationId: props.correlationId });
  }
}

export class HrCaseTaskStarted extends DomainEvent {
  constructor(props: { tenantId: Uuid; aggregateId: Uuid; correlationId: Uuid }) {
    super({ eventName: 'HrCaseTaskStarted', tenantId: props.tenantId, aggregateType: 'HrCaseTask', aggregateId: props.aggregateId, correlationId: props.correlationId });
  }
}

export class HrCaseTaskCompleted extends DomainEvent {
  constructor(props: { tenantId: Uuid; aggregateId: Uuid; correlationId: Uuid }) {
    super({ eventName: 'HrCaseTaskCompleted', tenantId: props.tenantId, aggregateType: 'HrCaseTask', aggregateId: props.aggregateId, correlationId: props.correlationId });
  }
}

export class HrCaseTaskOverdue extends DomainEvent {
  constructor(props: { tenantId: Uuid; aggregateId: Uuid; correlationId: Uuid }) {
    super({ eventName: 'HrCaseTaskOverdue', tenantId: props.tenantId, aggregateType: 'HrCaseTask', aggregateId: props.aggregateId, correlationId: props.correlationId });
  }
}

export class HrCaseTaskCancelled extends DomainEvent {
  constructor(props: { tenantId: Uuid; aggregateId: Uuid; correlationId: Uuid }) {
    super({ eventName: 'HrCaseTaskCancelled', tenantId: props.tenantId, aggregateType: 'HrCaseTask', aggregateId: props.aggregateId, correlationId: props.correlationId });
  }
}

export class HrCaseTask extends AggregateRoot {
  private _aggregateVersion = 0;
  readonly tenantId: Uuid;
  caseId: Uuid;
  title: string;
  assignedTo?: Uuid;
  dueDate?: Date;
  completedAt?: Date;
  status: HrCaseTaskStatus;
  createdAt: Date;
  updatedAt: Date;

  get version(): number { return this._aggregateVersion; }
  get aggregateVersion(): number { return this._aggregateVersion; }
  incrementVersion(): void { this._aggregateVersion++; }

  constructor(props: HrCaseTaskProps) {
    super(props.id);
    this.tenantId = props.tenantId;
    this.caseId = props.caseId;
    this.title = props.title;
    this.assignedTo = props.assignedTo;
    this.dueDate = props.dueDate;
    this.completedAt = props.completedAt;
    this.status = props.status ?? 'PENDING';
    this.createdAt = props.createdAt ?? new Date();
    this.updatedAt = props.updatedAt ?? new Date();
    if (props.aggregateVersion !== undefined) this._aggregateVersion = props.aggregateVersion;
  }

  static create(props: HrCaseTaskProps, correlationId: Uuid): HrCaseTask {
    Guard.againstEmptyString(props.title, 'title');
    const ct = new HrCaseTask({ ...props, status: 'PENDING', createdAt: new Date(), updatedAt: new Date() });
    ct.addDomainEvent(new HrCaseTaskCreated({ tenantId: ct.tenantId, aggregateId: ct.id, correlationId }));
    return ct;
  }

  start(correlationId: Uuid): void {
    if (this.status !== 'PENDING') throw new ValidationError(`Cannot start from ${this.status}`);
    this.status = 'IN_PROGRESS';
    this.addDomainEvent(new HrCaseTaskStarted({ tenantId: this.tenantId, aggregateId: this.id, correlationId }));
    this.incrementVersion();
    this.updatedAt = new Date();
  }

  complete(correlationId: Uuid): void {
    if (this.status !== 'IN_PROGRESS' && this.status !== 'PENDING') throw new ValidationError(`Cannot complete from ${this.status}`);
    this.status = 'COMPLETED';
    this.completedAt = new Date();
    this.addDomainEvent(new HrCaseTaskCompleted({ tenantId: this.tenantId, aggregateId: this.id, correlationId }));
    this.incrementVersion();
    this.updatedAt = new Date();
  }

  markOverdue(correlationId: Uuid): void {
    if (this.status !== 'PENDING' && this.status !== 'IN_PROGRESS') throw new ValidationError(`Cannot mark overdue from ${this.status}`);
    this.status = 'OVERDUE';
    this.addDomainEvent(new HrCaseTaskOverdue({ tenantId: this.tenantId, aggregateId: this.id, correlationId }));
    this.incrementVersion();
    this.updatedAt = new Date();
  }

  cancel(correlationId: Uuid): void {
    if (this.status === 'COMPLETED' || this.status === 'CANCELLED') throw new ValidationError(`Cannot cancel from ${this.status}`);
    this.status = 'CANCELLED';
    this.addDomainEvent(new HrCaseTaskCancelled({ tenantId: this.tenantId, aggregateId: this.id, correlationId }));
    this.incrementVersion();
    this.updatedAt = new Date();
  }
}
