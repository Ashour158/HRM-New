/**
 * @hrDataClassification CONFIDENTIAL - review, rating, goal, competency, calibration, 360 feedback, PIP, and development-plan fields.
 */
import { AggregateRoot, DomainEvent, Uuid, Guard, ValidationError } from '@hcm/shared-kernel';

export type ReviewTemplateStatus = 'DRAFT' | 'ACTIVE' | 'ARCHIVED';

export interface ReviewTemplateProps {
  id: Uuid;
  tenantId: Uuid;
  name: string;
  description?: string;
  templateType: string;
  sections?: unknown;
  ratingScale?: unknown;
  competencies?: unknown;
  applicableRoles?: unknown;
  status?: ReviewTemplateStatus;
  aggregateVersion?: number;
  createdAt?: Date;
  updatedAt?: Date;
}

export class ReviewTemplateCreated extends DomainEvent {
  constructor(props: { tenantId: Uuid; aggregateId: Uuid; correlationId: Uuid }) {
    super({ eventName: 'ReviewTemplateCreated', tenantId: props.tenantId, aggregateType: 'ReviewTemplate', aggregateId: props.aggregateId, correlationId: props.correlationId });
  }
}

export class ReviewTemplatePublished extends DomainEvent {
  constructor(props: { tenantId: Uuid; aggregateId: Uuid; correlationId: Uuid }) {
    super({ eventName: 'ReviewTemplatePublished', tenantId: props.tenantId, aggregateType: 'ReviewTemplate', aggregateId: props.aggregateId, correlationId: props.correlationId });
  }
}

export class ReviewTemplateArchived extends DomainEvent {
  constructor(props: { tenantId: Uuid; aggregateId: Uuid; correlationId: Uuid }) {
    super({ eventName: 'ReviewTemplateArchived', tenantId: props.tenantId, aggregateType: 'ReviewTemplate', aggregateId: props.aggregateId, correlationId: props.correlationId });
  }
}

export class ReviewTemplate extends AggregateRoot {
  private _aggregateVersion = 0;
  readonly tenantId: Uuid;
  name: string;
  description?: string;
  templateType: string;
  sections: unknown;
  ratingScale?: unknown;
  competencies?: unknown;
  applicableRoles?: unknown;
  status: ReviewTemplateStatus;
  createdAt: Date;
  updatedAt: Date;

  get version(): number { return this._aggregateVersion; }
  get aggregateVersion(): number { return this._aggregateVersion; }
  incrementVersion(): void { this._aggregateVersion++; }

  constructor(props: ReviewTemplateProps) {
    super(props.id);
    this.tenantId = props.tenantId;
    this.name = props.name;
    this.description = props.description;
    this.templateType = props.templateType;
    this.sections = props.sections ?? [];
    this.ratingScale = props.ratingScale;
    this.competencies = props.competencies;
    this.applicableRoles = props.applicableRoles;
    this.status = props.status ?? 'DRAFT';
    this.createdAt = props.createdAt ?? new Date();
    this.updatedAt = props.updatedAt ?? new Date();
    if (props.aggregateVersion !== undefined) this._aggregateVersion = props.aggregateVersion;
  }

  static create(props: ReviewTemplateProps, correlationId: Uuid): ReviewTemplate {
    Guard.againstEmptyString(props.name, 'name');
    Guard.againstEmptyString(props.templateType, 'templateType');
    const ar = new ReviewTemplate({ ...props, status: 'DRAFT', createdAt: new Date(), updatedAt: new Date() });
    ar.addDomainEvent(new ReviewTemplateCreated({ tenantId: ar.tenantId, aggregateId: ar.id, correlationId }));
    return ar;
  }

  publish(correlationId: Uuid): void {
    if (this.status !== 'DRAFT') throw new ValidationError(`Cannot publish from ${this.status}`);
    this.status = 'ACTIVE';
    this.addDomainEvent(new ReviewTemplatePublished({ tenantId: this.tenantId, aggregateId: this.id, correlationId }));
    this.incrementVersion();
    this.updatedAt = new Date();
  }

  archive(correlationId: Uuid): void {
    if (this.status !== 'ACTIVE') throw new ValidationError(`Cannot archive from ${this.status}`);
    this.status = 'ARCHIVED';
    this.addDomainEvent(new ReviewTemplateArchived({ tenantId: this.tenantId, aggregateId: this.id, correlationId }));
    this.incrementVersion();
    this.updatedAt = new Date();
  }
}
