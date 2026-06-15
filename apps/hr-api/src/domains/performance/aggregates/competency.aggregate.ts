/**
 * @hrDataClassification CONFIDENTIAL - review, rating, goal, competency, calibration, 360 feedback, PIP, and development-plan fields.
 */
import { AggregateRoot, DomainEvent, Uuid, Guard, ValidationError } from '@hcm/shared-kernel';

export type CompetencyStatus = 'DRAFT' | 'ACTIVE' | 'INACTIVE';

export interface CompetencyProps {
  id: Uuid;
  tenantId: Uuid;
  name: string;
  description?: string;
  category: string;
  behavioralIndicators?: unknown;
  proficiencyLevels?: unknown;
  applicableDepartment?: string;
  status?: CompetencyStatus;
  aggregateVersion?: number;
  createdAt?: Date;
  updatedAt?: Date;
}

export class CompetencyCreated extends DomainEvent {
  constructor(props: { tenantId: Uuid; aggregateId: Uuid; correlationId: Uuid }) {
    super({ eventName: 'CompetencyCreated', tenantId: props.tenantId, aggregateType: 'Competency', aggregateId: props.aggregateId, correlationId: props.correlationId });
  }
}

export class CompetencyActivated extends DomainEvent {
  constructor(props: { tenantId: Uuid; aggregateId: Uuid; correlationId: Uuid }) {
    super({ eventName: 'CompetencyActivated', tenantId: props.tenantId, aggregateType: 'Competency', aggregateId: props.aggregateId, correlationId: props.correlationId });
  }
}

export class CompetencyDeactivated extends DomainEvent {
  constructor(props: { tenantId: Uuid; aggregateId: Uuid; correlationId: Uuid }) {
    super({ eventName: 'CompetencyDeactivated', tenantId: props.tenantId, aggregateType: 'Competency', aggregateId: props.aggregateId, correlationId: props.correlationId });
  }
}

export class Competency extends AggregateRoot {
  private _aggregateVersion = 0;
  readonly tenantId: Uuid;
  name: string;
  description?: string;
  category: string;
  behavioralIndicators: unknown;
  proficiencyLevels: unknown;
  applicableDepartment?: string;
  status: CompetencyStatus;
  createdAt: Date;
  updatedAt: Date;

  get version(): number { return this._aggregateVersion; }
  get aggregateVersion(): number { return this._aggregateVersion; }
  incrementVersion(): void { this._aggregateVersion++; }

  constructor(props: CompetencyProps) {
    super(props.id);
    this.tenantId = props.tenantId;
    this.name = props.name;
    this.description = props.description;
    this.category = props.category;
    this.behavioralIndicators = props.behavioralIndicators ?? [];
    this.proficiencyLevels = props.proficiencyLevels ?? [];
    this.applicableDepartment = props.applicableDepartment;
    this.status = props.status ?? 'DRAFT';
    this.createdAt = props.createdAt ?? new Date();
    this.updatedAt = props.updatedAt ?? new Date();
    if (props.aggregateVersion !== undefined) this._aggregateVersion = props.aggregateVersion;
  }

  static create(props: CompetencyProps, correlationId: Uuid): Competency {
    Guard.againstEmptyString(props.name, 'name');
    Guard.againstEmptyString(props.category, 'category');
    const ar = new Competency({ ...props, status: 'DRAFT', createdAt: new Date(), updatedAt: new Date() });
    ar.addDomainEvent(new CompetencyCreated({ tenantId: ar.tenantId, aggregateId: ar.id, correlationId }));
    return ar;
  }

  activate(correlationId: Uuid): void {
    if (this.status !== 'DRAFT' && this.status !== 'INACTIVE') throw new ValidationError(`Cannot activate from ${this.status}`);
    this.status = 'ACTIVE';
    this.addDomainEvent(new CompetencyActivated({ tenantId: this.tenantId, aggregateId: this.id, correlationId }));
    this.incrementVersion();
    this.updatedAt = new Date();
  }

  deactivate(correlationId: Uuid): void {
    if (this.status !== 'ACTIVE') throw new ValidationError(`Cannot deactivate from ${this.status}`);
    this.status = 'INACTIVE';
    this.addDomainEvent(new CompetencyDeactivated({ tenantId: this.tenantId, aggregateId: this.id, correlationId }));
    this.incrementVersion();
    this.updatedAt = new Date();
  }
}
