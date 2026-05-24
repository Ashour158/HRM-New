import { AggregateRoot, DomainEvent, Uuid, Guard, ValidationError } from '@hcm/shared-kernel';

export type LearningCourseStatus = 'DRAFT' | 'PUBLISHED' | 'ARCHIVED' | 'RETIRED';

export interface LearningCourseProps {
  id: Uuid;
  tenantId: Uuid;
  title: string;
  description?: string;
  contentType: string;
  durationMinutes?: number;
  credits?: number;
  certificationEligible?: boolean;
  status?: LearningCourseStatus;
  aggregateVersion?: number;
  createdAt?: Date;
  updatedAt?: Date;
}

export class LearningCourseCreated extends DomainEvent {
  constructor(props: { tenantId: Uuid; aggregateId: Uuid; correlationId: Uuid }) {
    super({ eventName: 'LearningCourseCreated', tenantId: props.tenantId, aggregateType: 'LearningCourse', aggregateId: props.aggregateId, correlationId: props.correlationId });
  }
}

export class LearningCoursePublished extends DomainEvent {
  constructor(props: { tenantId: Uuid; aggregateId: Uuid; correlationId: Uuid }) {
    super({ eventName: 'LearningCoursePublished', tenantId: props.tenantId, aggregateType: 'LearningCourse', aggregateId: props.aggregateId, correlationId: props.correlationId });
  }
}

export class LearningCourseArchived extends DomainEvent {
  constructor(props: { tenantId: Uuid; aggregateId: Uuid; correlationId: Uuid }) {
    super({ eventName: 'LearningCourseArchived', tenantId: props.tenantId, aggregateType: 'LearningCourse', aggregateId: props.aggregateId, correlationId: props.correlationId });
  }
}

export class LearningCourseRetired extends DomainEvent {
  constructor(props: { tenantId: Uuid; aggregateId: Uuid; correlationId: Uuid }) {
    super({ eventName: 'LearningCourseRetired', tenantId: props.tenantId, aggregateType: 'LearningCourse', aggregateId: props.aggregateId, correlationId: props.correlationId });
  }
}

/**
 * LearningCourse aggregate manages learning courses.
 */
export class LearningCourse extends AggregateRoot {
  private _aggregateVersion = 0;
  readonly tenantId: Uuid;
  title: string;
  description?: string;
  contentType: string;
  durationMinutes?: number;
  credits?: number;
  certificationEligible: boolean;
  status: LearningCourseStatus;
  createdAt: Date;
  updatedAt: Date;

  get version(): number { return this._aggregateVersion; }
  get aggregateVersion(): number { return this._aggregateVersion; }
  incrementVersion(): void { this._aggregateVersion++; }

  constructor(props: LearningCourseProps) {
    super(props.id);
    this.tenantId = props.tenantId;
    this.title = props.title;
    this.description = props.description;
    this.contentType = props.contentType;
    this.durationMinutes = props.durationMinutes;
    this.credits = props.credits;
    this.certificationEligible = props.certificationEligible ?? false;
    this.status = props.status ?? 'DRAFT';
    this.createdAt = props.createdAt ?? new Date();
    this.updatedAt = props.updatedAt ?? new Date();
    if (props.aggregateVersion !== undefined) this._aggregateVersion = props.aggregateVersion;
  }

  static create(props: LearningCourseProps, correlationId: Uuid): LearningCourse {
    Guard.againstEmptyString(props.title, 'title');
    Guard.againstEmptyString(props.contentType, 'contentType');
    const ar = new LearningCourse({ ...props, status: 'DRAFT', createdAt: new Date(), updatedAt: new Date() });
    ar.addDomainEvent(new LearningCourseCreated({ tenantId: ar.tenantId, aggregateId: ar.id, correlationId }));
    return ar;
  }

  publish(correlationId: Uuid): void {
    if (this.status !== 'DRAFT') throw new ValidationError(`Cannot publish from ${this.status}`);
    this.status = 'PUBLISHED';
    this.addDomainEvent(new LearningCoursePublished({ tenantId: this.tenantId, aggregateId: this.id, correlationId }));
    this.incrementVersion();
    this.updatedAt = new Date();
  }

  archive(correlationId: Uuid): void {
    if (this.status !== 'PUBLISHED') throw new ValidationError(`Cannot archive from ${this.status}`);
    this.status = 'ARCHIVED';
    this.addDomainEvent(new LearningCourseArchived({ tenantId: this.tenantId, aggregateId: this.id, correlationId }));
    this.incrementVersion();
    this.updatedAt = new Date();
  }

  retire(correlationId: Uuid): void {
    if (this.status !== 'PUBLISHED' && this.status !== 'ARCHIVED') throw new ValidationError(`Cannot retire from ${this.status}`);
    this.status = 'RETIRED';
    this.addDomainEvent(new LearningCourseRetired({ tenantId: this.tenantId, aggregateId: this.id, correlationId }));
    this.incrementVersion();
    this.updatedAt = new Date();
  }
}
