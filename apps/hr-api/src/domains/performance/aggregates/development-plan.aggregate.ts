import { AggregateRoot, DomainEvent, Uuid, Guard, ValidationError } from '@hcm/shared-kernel';

export type DevelopmentPlanStatus = 'DRAFT' | 'ACTIVE' | 'IN_PROGRESS' | 'COMPLETED' | 'CLOSED' | 'CANCELLED';

export interface DevelopmentPlanProps {
  id: Uuid;
  tenantId: Uuid;
  workerId: Uuid;
  managerId?: Uuid;
  title: string;
  description?: string;
  objectives?: unknown;
  startDate?: Date;
  targetCompletionDate?: Date;
  actualCompletionDate?: Date;
  status?: DevelopmentPlanStatus;
  outcome?: string;
  aggregateVersion?: number;
  createdAt?: Date;
  updatedAt?: Date;
}

export class DevelopmentPlanCreated extends DomainEvent {
  constructor(props: { tenantId: Uuid; aggregateId: Uuid; correlationId: Uuid }) {
    super({ eventName: 'DevelopmentPlanCreated', tenantId: props.tenantId, aggregateType: 'DevelopmentPlan', aggregateId: props.aggregateId, correlationId: props.correlationId });
  }
}

export class DevelopmentPlanActivated extends DomainEvent {
  constructor(props: { tenantId: Uuid; aggregateId: Uuid; correlationId: Uuid }) {
    super({ eventName: 'DevelopmentPlanActivated', tenantId: props.tenantId, aggregateType: 'DevelopmentPlan', aggregateId: props.aggregateId, correlationId: props.correlationId });
  }
}

export class DevelopmentPlanMilestoneRecorded extends DomainEvent {
  constructor(props: { tenantId: Uuid; aggregateId: Uuid; correlationId: Uuid }) {
    super({ eventName: 'DevelopmentPlanMilestoneRecorded', tenantId: props.tenantId, aggregateType: 'DevelopmentPlan', aggregateId: props.aggregateId, correlationId: props.correlationId });
  }
}

export class DevelopmentPlanCompleted extends DomainEvent {
  constructor(props: { tenantId: Uuid; aggregateId: Uuid; correlationId: Uuid }) {
    super({ eventName: 'DevelopmentPlanCompleted', tenantId: props.tenantId, aggregateType: 'DevelopmentPlan', aggregateId: props.aggregateId, correlationId: props.correlationId });
  }
}

export class DevelopmentPlanClosed extends DomainEvent {
  constructor(props: { tenantId: Uuid; aggregateId: Uuid; correlationId: Uuid }) {
    super({ eventName: 'DevelopmentPlanClosed', tenantId: props.tenantId, aggregateType: 'DevelopmentPlan', aggregateId: props.aggregateId, correlationId: props.correlationId });
  }
}

export class DevelopmentPlan extends AggregateRoot {
  private _aggregateVersion = 0;
  readonly tenantId: Uuid;
  workerId: Uuid;
  managerId?: Uuid;
  title: string;
  description?: string;
  objectives: unknown;
  startDate?: Date;
  targetCompletionDate?: Date;
  actualCompletionDate?: Date;
  status: DevelopmentPlanStatus;
  outcome?: string;
  createdAt: Date;
  updatedAt: Date;

  get version(): number { return this._aggregateVersion; }
  get aggregateVersion(): number { return this._aggregateVersion; }
  incrementVersion(): void { this._aggregateVersion++; }

  constructor(props: DevelopmentPlanProps) {
    super(props.id);
    this.tenantId = props.tenantId;
    this.workerId = props.workerId;
    this.managerId = props.managerId;
    this.title = props.title;
    this.description = props.description;
    this.objectives = props.objectives ?? [];
    this.startDate = props.startDate;
    this.targetCompletionDate = props.targetCompletionDate;
    this.actualCompletionDate = props.actualCompletionDate;
    this.status = props.status ?? 'DRAFT';
    this.outcome = props.outcome;
    this.createdAt = props.createdAt ?? new Date();
    this.updatedAt = props.updatedAt ?? new Date();
    if (props.aggregateVersion !== undefined) this._aggregateVersion = props.aggregateVersion;
  }

  static create(props: DevelopmentPlanProps, correlationId: Uuid): DevelopmentPlan {
    Guard.againstEmptyString(props.title, 'title');
    const ar = new DevelopmentPlan({ ...props, status: 'DRAFT', createdAt: new Date(), updatedAt: new Date() });
    ar.addDomainEvent(new DevelopmentPlanCreated({ tenantId: ar.tenantId, aggregateId: ar.id, correlationId }));
    return ar;
  }

  activate(correlationId: Uuid): void {
    if (this.status !== 'DRAFT') throw new ValidationError(`Cannot activate from ${this.status}`);
    this.status = 'ACTIVE';
    this.addDomainEvent(new DevelopmentPlanActivated({ tenantId: this.tenantId, aggregateId: this.id, correlationId }));
    this.incrementVersion();
    this.updatedAt = new Date();
  }

  recordMilestone(milestone: unknown, correlationId: Uuid): void {
    if (this.status !== 'ACTIVE' && this.status !== 'IN_PROGRESS') throw new ValidationError(`Cannot record milestone from ${this.status}`);
    this.objectives = Array.isArray(this.objectives) ? [...this.objectives, milestone] : [milestone];
    this.status = 'IN_PROGRESS';
    this.addDomainEvent(new DevelopmentPlanMilestoneRecorded({ tenantId: this.tenantId, aggregateId: this.id, correlationId }));
    this.incrementVersion();
    this.updatedAt = new Date();
  }

  complete(outcome: string, correlationId: Uuid): void {
    if (this.status !== 'ACTIVE' && this.status !== 'IN_PROGRESS') throw new ValidationError(`Cannot complete from ${this.status}`);
    this.status = 'COMPLETED';
    this.outcome = outcome;
    this.actualCompletionDate = new Date();
    this.addDomainEvent(new DevelopmentPlanCompleted({ tenantId: this.tenantId, aggregateId: this.id, correlationId }));
    this.incrementVersion();
    this.updatedAt = new Date();
  }

  close(correlationId: Uuid): void {
    if (this.status !== 'COMPLETED') throw new ValidationError(`Cannot close from ${this.status}`);
    this.status = 'CLOSED';
    this.addDomainEvent(new DevelopmentPlanClosed({ tenantId: this.tenantId, aggregateId: this.id, correlationId }));
    this.incrementVersion();
    this.updatedAt = new Date();
  }
}
