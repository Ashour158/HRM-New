import { AggregateRoot, DomainEvent, Uuid, Guard, ValidationError } from '@hcm/shared-kernel';

export type CareerPathStatus = 'DRAFT' | 'ACTIVE' | 'ARCHIVED';

export interface CareerMilestone {
  milestoneId: string;
  title: string;
  requiredSkills: string[];
  achievedAt?: Date;
}

export interface CareerPathProps {
  id: Uuid;
  tenantId: Uuid;
  title: string;
  currentRole: string;
  targetRole: string;
  requiredSkills?: string[];
  milestones?: CareerMilestone[];
  status?: CareerPathStatus;
  aggregateVersion?: number;
  createdAt?: Date;
  updatedAt?: Date;
}

export class CareerPathCreated extends DomainEvent {
  constructor(props: { tenantId: Uuid; aggregateId: Uuid; correlationId: Uuid }) {
    super({ eventName: 'CareerPathCreated', tenantId: props.tenantId, aggregateType: 'CareerPath', aggregateId: props.aggregateId, correlationId: props.correlationId });
  }
}

export class CareerPathActivated extends DomainEvent {
  constructor(props: { tenantId: Uuid; aggregateId: Uuid; correlationId: Uuid }) {
    super({ eventName: 'CareerPathActivated', tenantId: props.tenantId, aggregateType: 'CareerPath', aggregateId: props.aggregateId, correlationId: props.correlationId });
  }
}

export class CareerPathMilestoneAchieved extends DomainEvent {
  constructor(props: { tenantId: Uuid; aggregateId: Uuid; correlationId: Uuid }) {
    super({ eventName: 'CareerPathMilestoneAchieved', tenantId: props.tenantId, aggregateType: 'CareerPath', aggregateId: props.aggregateId, correlationId: props.correlationId });
  }
}

export class CareerPathArchived extends DomainEvent {
  constructor(props: { tenantId: Uuid; aggregateId: Uuid; correlationId: Uuid }) {
    super({ eventName: 'CareerPathArchived', tenantId: props.tenantId, aggregateType: 'CareerPath', aggregateId: props.aggregateId, correlationId: props.correlationId });
  }
}

/**
 * CareerPath aggregate manages career progression paths.
 */
export class CareerPath extends AggregateRoot {
  private _aggregateVersion = 0;
  readonly tenantId: Uuid;
  title: string;
  currentRole: string;
  targetRole: string;
  requiredSkills: string[];
  milestones: CareerMilestone[];
  status: CareerPathStatus;
  createdAt: Date;
  updatedAt: Date;

  get version(): number { return this._aggregateVersion; }
  get aggregateVersion(): number { return this._aggregateVersion; }
  incrementVersion(): void { this._aggregateVersion++; }

  constructor(props: CareerPathProps) {
    super(props.id);
    this.tenantId = props.tenantId;
    this.title = props.title;
    this.currentRole = props.currentRole;
    this.targetRole = props.targetRole;
    this.requiredSkills = props.requiredSkills ?? [];
    this.milestones = props.milestones ?? [];
    this.status = props.status ?? 'DRAFT';
    this.createdAt = props.createdAt ?? new Date();
    this.updatedAt = props.updatedAt ?? new Date();
    if (props.aggregateVersion !== undefined) this._aggregateVersion = props.aggregateVersion;
  }

  static create(props: CareerPathProps, correlationId: Uuid): CareerPath {
    Guard.againstEmptyString(props.title, 'title');
    Guard.againstEmptyString(props.currentRole, 'currentRole');
    Guard.againstEmptyString(props.targetRole, 'targetRole');
    const ar = new CareerPath({ ...props, status: 'DRAFT', createdAt: new Date(), updatedAt: new Date() });
    ar.addDomainEvent(new CareerPathCreated({ tenantId: ar.tenantId, aggregateId: ar.id, correlationId }));
    return ar;
  }

  activate(correlationId: Uuid): void {
    if (this.status !== 'DRAFT') throw new ValidationError(`Cannot activate from ${this.status}`);
    this.status = 'ACTIVE';
    this.addDomainEvent(new CareerPathActivated({ tenantId: this.tenantId, aggregateId: this.id, correlationId }));
    this.incrementVersion();
    this.updatedAt = new Date();
  }

  achieveMilestone(milestoneId: string, correlationId: Uuid): void {
    if (this.status !== 'ACTIVE') throw new ValidationError(`Cannot achieve milestone from ${this.status}`);
    const milestone = this.milestones.find((m) => m.milestoneId === milestoneId);
    if (!milestone) throw new ValidationError('Milestone not found');
    milestone.achievedAt = new Date();
    this.addDomainEvent(new CareerPathMilestoneAchieved({ tenantId: this.tenantId, aggregateId: this.id, correlationId }));
    this.incrementVersion();
    this.updatedAt = new Date();
  }

  archive(correlationId: Uuid): void {
    if (this.status === 'ARCHIVED') throw new ValidationError('Already archived');
    this.status = 'ARCHIVED';
    this.addDomainEvent(new CareerPathArchived({ tenantId: this.tenantId, aggregateId: this.id, correlationId }));
    this.incrementVersion();
    this.updatedAt = new Date();
  }
}
