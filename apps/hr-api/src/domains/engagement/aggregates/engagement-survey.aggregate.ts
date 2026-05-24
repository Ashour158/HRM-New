import { AggregateRoot, DomainEvent, Uuid, Guard, ValidationError } from '@hcm/shared-kernel';

export type EngagementSurveyStatus = 'DRAFT' | 'PUBLISHED' | 'ACTIVE' | 'CLOSED' | 'ANALYZED' | 'CANCELLED';

export interface EngagementSurveyProps {
  id: Uuid;
  tenantId: Uuid;
  title: string;
  surveyType: string;
  questions?: Record<string, unknown>[];
  anonymous?: boolean;
  startDate?: Date;
  endDate?: Date;
  status?: EngagementSurveyStatus;
  aggregateVersion?: number;
  createdAt?: Date;
  updatedAt?: Date;
}

export class EngagementSurveyCreated extends DomainEvent {
  constructor(props: { tenantId: Uuid; aggregateId: Uuid; correlationId: Uuid }) {
    super({ eventName: 'EngagementSurveyCreated', tenantId: props.tenantId, aggregateType: 'EngagementSurvey', aggregateId: props.aggregateId, correlationId: props.correlationId });
  }
}

export class EngagementSurveyPublished extends DomainEvent {
  constructor(props: { tenantId: Uuid; aggregateId: Uuid; correlationId: Uuid }) {
    super({ eventName: 'EngagementSurveyPublished', tenantId: props.tenantId, aggregateType: 'EngagementSurvey', aggregateId: props.aggregateId, correlationId: props.correlationId });
  }
}

export class EngagementSurveyActivated extends DomainEvent {
  constructor(props: { tenantId: Uuid; aggregateId: Uuid; correlationId: Uuid }) {
    super({ eventName: 'EngagementSurveyActivated', tenantId: props.tenantId, aggregateType: 'EngagementSurvey', aggregateId: props.aggregateId, correlationId: props.correlationId });
  }
}

export class EngagementSurveyClosed extends DomainEvent {
  constructor(props: { tenantId: Uuid; aggregateId: Uuid; correlationId: Uuid }) {
    super({ eventName: 'EngagementSurveyClosed', tenantId: props.tenantId, aggregateType: 'EngagementSurvey', aggregateId: props.aggregateId, correlationId: props.correlationId });
  }
}

export class EngagementSurveyAnalyzed extends DomainEvent {
  constructor(props: { tenantId: Uuid; aggregateId: Uuid; correlationId: Uuid }) {
    super({ eventName: 'EngagementSurveyAnalyzed', tenantId: props.tenantId, aggregateType: 'EngagementSurvey', aggregateId: props.aggregateId, correlationId: props.correlationId });
  }
}

/**
 * EngagementSurvey aggregate manages employee engagement surveys.
 */
export class EngagementSurvey extends AggregateRoot {
  private _aggregateVersion = 0;
  readonly tenantId: Uuid;
  title: string;
  surveyType: string;
  questions: Record<string, unknown>[];
  anonymous: boolean;
  startDate?: Date;
  endDate?: Date;
  status: EngagementSurveyStatus;
  createdAt: Date;
  updatedAt: Date;

  get version(): number { return this._aggregateVersion; }
  get aggregateVersion(): number { return this._aggregateVersion; }
  incrementVersion(): void { this._aggregateVersion++; }

  constructor(props: EngagementSurveyProps) {
    super(props.id);
    this.tenantId = props.tenantId;
    this.title = props.title;
    this.surveyType = props.surveyType;
    this.questions = props.questions ?? [];
    this.anonymous = props.anonymous ?? false;
    this.startDate = props.startDate;
    this.endDate = props.endDate;
    this.status = props.status ?? 'DRAFT';
    this.createdAt = props.createdAt ?? new Date();
    this.updatedAt = props.updatedAt ?? new Date();
    if (props.aggregateVersion !== undefined) this._aggregateVersion = props.aggregateVersion;
  }

  static create(props: EngagementSurveyProps, correlationId: Uuid): EngagementSurvey {
    Guard.againstEmptyString(props.title, 'title');
    Guard.againstEmptyString(props.surveyType, 'surveyType');
    const ar = new EngagementSurvey({ ...props, status: 'DRAFT', createdAt: new Date(), updatedAt: new Date() });
    ar.addDomainEvent(new EngagementSurveyCreated({ tenantId: ar.tenantId, aggregateId: ar.id, correlationId }));
    return ar;
  }

  publish(correlationId: Uuid): void {
    if (this.status !== 'DRAFT') throw new ValidationError(`Cannot publish from ${this.status}`);
    this.status = 'PUBLISHED';
    this.addDomainEvent(new EngagementSurveyPublished({ tenantId: this.tenantId, aggregateId: this.id, correlationId }));
    this.incrementVersion();
    this.updatedAt = new Date();
  }

  activate(correlationId: Uuid): void {
    if (this.status !== 'PUBLISHED') throw new ValidationError(`Cannot activate from ${this.status}`);
    this.status = 'ACTIVE';
    this.addDomainEvent(new EngagementSurveyActivated({ tenantId: this.tenantId, aggregateId: this.id, correlationId }));
    this.incrementVersion();
    this.updatedAt = new Date();
  }

  close(correlationId: Uuid): void {
    if (this.status !== 'ACTIVE') throw new ValidationError(`Cannot close from ${this.status}`);
    this.status = 'CLOSED';
    this.addDomainEvent(new EngagementSurveyClosed({ tenantId: this.tenantId, aggregateId: this.id, correlationId }));
    this.incrementVersion();
    this.updatedAt = new Date();
  }

  analyze(correlationId: Uuid): void {
    if (this.status !== 'CLOSED') throw new ValidationError(`Cannot analyze from ${this.status}`);
    this.status = 'ANALYZED';
    this.addDomainEvent(new EngagementSurveyAnalyzed({ tenantId: this.tenantId, aggregateId: this.id, correlationId }));
    this.incrementVersion();
    this.updatedAt = new Date();
  }
}
