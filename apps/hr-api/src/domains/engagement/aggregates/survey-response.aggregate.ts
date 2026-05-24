import { AggregateRoot, DomainEvent, Uuid, ValidationError } from '@hcm/shared-kernel';
import { createHash } from 'crypto';

export type SurveyResponseStatus = 'STARTED' | 'COMPLETED' | 'SUBMITTED';

export interface SurveyResponseProps {
  id: Uuid;
  tenantId: Uuid;
  surveyId: Uuid;
  workerId: Uuid;
  responses?: Record<string, unknown>;
  submittedAt?: Date;
  isAnonymous?: boolean;
  status?: SurveyResponseStatus;
  aggregateVersion?: number;
  createdAt?: Date;
  updatedAt?: Date;
}

export class SurveyResponseStarted extends DomainEvent {
  constructor(props: { tenantId: Uuid; aggregateId: Uuid; correlationId: Uuid }) {
    super({ eventName: 'SurveyResponseStarted', tenantId: props.tenantId, aggregateType: 'SurveyResponse', aggregateId: props.aggregateId, correlationId: props.correlationId });
  }
}

export class SurveyResponseCompleted extends DomainEvent {
  constructor(props: { tenantId: Uuid; aggregateId: Uuid; correlationId: Uuid }) {
    super({ eventName: 'SurveyResponseCompleted', tenantId: props.tenantId, aggregateType: 'SurveyResponse', aggregateId: props.aggregateId, correlationId: props.correlationId });
  }
}

export class SurveyResponseSubmitted extends DomainEvent {
  constructor(props: { tenantId: Uuid; aggregateId: Uuid; correlationId: Uuid }) {
    super({ eventName: 'SurveyResponseSubmitted', tenantId: props.tenantId, aggregateType: 'SurveyResponse', aggregateId: props.aggregateId, correlationId: props.correlationId });
  }
}

/**
 * SurveyResponse aggregate tracks individual survey responses.
 * For anonymous surveys, workerId is hashed.
 */
export class SurveyResponse extends AggregateRoot {
  private _aggregateVersion = 0;
  readonly tenantId: Uuid;
  surveyId: Uuid;
  workerId: Uuid;
  responses: Record<string, unknown>;
  submittedAt?: Date;
  isAnonymous: boolean;
  status: SurveyResponseStatus;
  createdAt: Date;
  updatedAt: Date;

  get version(): number { return this._aggregateVersion; }
  get aggregateVersion(): number { return this._aggregateVersion; }
  incrementVersion(): void { this._aggregateVersion++; }

  constructor(props: SurveyResponseProps) {
    super(props.id);
    this.tenantId = props.tenantId;
    this.surveyId = props.surveyId;
    this.workerId = props.workerId;
    this.responses = props.responses ?? {};
    this.submittedAt = props.submittedAt;
    this.isAnonymous = props.isAnonymous ?? false;
    this.status = props.status ?? 'STARTED';
    this.createdAt = props.createdAt ?? new Date();
    this.updatedAt = props.updatedAt ?? new Date();
    if (props.aggregateVersion !== undefined) this._aggregateVersion = props.aggregateVersion;
  }

  static create(props: SurveyResponseProps, correlationId: Uuid): SurveyResponse {
    const workerId = props.isAnonymous
      ? new Uuid(createHash('sha256').update(props.workerId.value).digest('hex').substring(0, 32))
      : props.workerId;
    const ar = new SurveyResponse({ ...props, workerId, status: 'STARTED', createdAt: new Date(), updatedAt: new Date() });
    ar.addDomainEvent(new SurveyResponseStarted({ tenantId: ar.tenantId, aggregateId: ar.id, correlationId }));
    return ar;
  }

  complete(responses: Record<string, unknown>, correlationId: Uuid): void {
    if (this.status !== 'STARTED') throw new ValidationError(`Cannot complete from ${this.status}`);
    this.responses = responses;
    this.status = 'COMPLETED';
    this.addDomainEvent(new SurveyResponseCompleted({ tenantId: this.tenantId, aggregateId: this.id, correlationId }));
    this.incrementVersion();
    this.updatedAt = new Date();
  }

  submit(correlationId: Uuid): void {
    if (this.status !== 'COMPLETED') throw new ValidationError(`Cannot submit from ${this.status}`);
    this.submittedAt = new Date();
    this.status = 'SUBMITTED';
    this.addDomainEvent(new SurveyResponseSubmitted({ tenantId: this.tenantId, aggregateId: this.id, correlationId }));
    this.incrementVersion();
    this.updatedAt = new Date();
  }
}
