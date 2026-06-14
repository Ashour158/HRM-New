/**
 * @hrDataClassification HIGH_SENSITIVITY - immigration, work authorization, statutory leave, international assignment, consultation, and country-rule fields.
 */
import { AggregateRoot, DomainEvent, Uuid, Guard, ValidationError } from '@hcm/shared-kernel';

export type InternationalAssignmentStatus = 'DRAFT' | 'APPROVED' | 'ACTIVE' | 'COMPLETED' | 'EXPIRED' | 'CANCELLED';

export interface InternationalAssignmentProps {
  id: Uuid;
  tenantId: Uuid;
  workerId: Uuid;
  homeCountry: string;
  hostCountry: string;
  legalEntityId?: Uuid;
  startDate: Date;
  endDate: Date;
  assignmentReason: string;
  status?: InternationalAssignmentStatus;
  aggregateVersion?: number;
  createdAt?: Date;
  updatedAt?: Date;
}

class InternationalAssignmentEvent extends DomainEvent {
  readonly workerId: string;
  readonly hostCountry: string;

  constructor(props: {
    eventName: string;
    tenantId: Uuid;
    aggregateId: Uuid;
    correlationId: Uuid;
    workerId: Uuid;
    hostCountry: string;
  }) {
    super({
      eventName: props.eventName,
      tenantId: props.tenantId,
      aggregateType: 'InternationalAssignment',
      aggregateId: props.aggregateId,
      correlationId: props.correlationId,
    });
    this.workerId = props.workerId.value;
    this.hostCountry = props.hostCountry;
  }
}

export class InternationalAssignmentCreated extends InternationalAssignmentEvent {
  constructor(props: Omit<ConstructorParameters<typeof InternationalAssignmentEvent>[0], 'eventName'>) {
    super({ ...props, eventName: 'InternationalAssignmentCreated' });
  }
}

export class InternationalAssignmentApproved extends InternationalAssignmentEvent {
  constructor(props: Omit<ConstructorParameters<typeof InternationalAssignmentEvent>[0], 'eventName'>) {
    super({ ...props, eventName: 'InternationalAssignmentApproved' });
  }
}

export class InternationalAssignmentActivated extends InternationalAssignmentEvent {
  constructor(props: Omit<ConstructorParameters<typeof InternationalAssignmentEvent>[0], 'eventName'>) {
    super({ ...props, eventName: 'InternationalAssignmentActivated' });
  }
}

export class InternationalAssignmentCompleted extends InternationalAssignmentEvent {
  constructor(props: Omit<ConstructorParameters<typeof InternationalAssignmentEvent>[0], 'eventName'>) {
    super({ ...props, eventName: 'InternationalAssignmentCompleted' });
  }
}

export class InternationalAssignmentExpired extends InternationalAssignmentEvent {
  constructor(props: Omit<ConstructorParameters<typeof InternationalAssignmentEvent>[0], 'eventName'>) {
    super({ ...props, eventName: 'InternationalAssignmentExpired' });
  }
}

export class InternationalAssignmentCancelled extends InternationalAssignmentEvent {
  constructor(props: Omit<ConstructorParameters<typeof InternationalAssignmentEvent>[0], 'eventName'>) {
    super({ ...props, eventName: 'InternationalAssignmentCancelled' });
  }
}

export class InternationalAssignment extends AggregateRoot {
  readonly tenantId: Uuid;
  workerId: Uuid;
  homeCountry: string;
  hostCountry: string;
  legalEntityId?: Uuid;
  startDate: Date;
  endDate: Date;
  assignmentReason: string;
  status: InternationalAssignmentStatus;
  createdAt: Date;
  updatedAt: Date;

  get aggregateVersion(): number {
    return this.version;
  }

  constructor(props: InternationalAssignmentProps) {
    super(props.id);
    this.tenantId = props.tenantId;
    this.workerId = props.workerId;
    this.homeCountry = props.homeCountry;
    this.hostCountry = props.hostCountry;
    this.legalEntityId = props.legalEntityId;
    this.startDate = props.startDate;
    this.endDate = props.endDate;
    this.assignmentReason = props.assignmentReason;
    this.status = props.status ?? 'DRAFT';
    this.createdAt = props.createdAt ?? new Date();
    this.updatedAt = props.updatedAt ?? new Date();
    if (props.aggregateVersion !== undefined) {
      this.restoreVersion(props.aggregateVersion);
    }
  }

  static create(props: InternationalAssignmentProps, correlationId: Uuid): InternationalAssignment {
    Guard.againstEmptyString(props.homeCountry, 'homeCountry');
    Guard.againstEmptyString(props.hostCountry, 'hostCountry');
    Guard.againstEmptyString(props.assignmentReason, 'assignmentReason');
    if (props.endDate < props.startDate) {
      throw new ValidationError('International assignment end date cannot be before start date');
    }

    const assignment = new InternationalAssignment({
      ...props,
      status: 'DRAFT',
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    assignment.addEvent('InternationalAssignmentCreated', correlationId);
    return assignment;
  }

  approve(correlationId: Uuid): void {
    if (this.status !== 'DRAFT') throw new ValidationError(`Cannot approve from state ${this.status}`);
    this.status = 'APPROVED';
    this.addEvent('InternationalAssignmentApproved', correlationId);
    this.incrementVersion();
    this.updatedAt = new Date();
  }

  activate(correlationId: Uuid): void {
    if (this.status !== 'APPROVED') throw new ValidationError(`Cannot activate from state ${this.status}`);
    this.status = 'ACTIVE';
    this.addEvent('InternationalAssignmentActivated', correlationId);
    this.incrementVersion();
    this.updatedAt = new Date();
  }

  complete(correlationId: Uuid): void {
    if (this.status !== 'ACTIVE') throw new ValidationError(`Cannot complete from state ${this.status}`);
    this.status = 'COMPLETED';
    this.addEvent('InternationalAssignmentCompleted', correlationId);
    this.incrementVersion();
    this.updatedAt = new Date();
  }

  expire(correlationId: Uuid): void {
    if (this.status !== 'APPROVED' && this.status !== 'ACTIVE') {
      throw new ValidationError(`Cannot expire from state ${this.status}`);
    }
    this.status = 'EXPIRED';
    this.addEvent('InternationalAssignmentExpired', correlationId);
    this.incrementVersion();
    this.updatedAt = new Date();
  }

  cancel(correlationId: Uuid): void {
    if (this.status !== 'DRAFT' && this.status !== 'APPROVED') {
      throw new ValidationError(`Cannot cancel from state ${this.status}`);
    }
    this.status = 'CANCELLED';
    this.addEvent('InternationalAssignmentCancelled', correlationId);
    this.incrementVersion();
    this.updatedAt = new Date();
  }

  private addEvent(eventName: string, correlationId: Uuid): void {
    this.addDomainEvent(
      new InternationalAssignmentEvent({
        eventName,
        tenantId: this.tenantId,
        aggregateId: this.id,
        correlationId,
        workerId: this.workerId,
        hostCountry: this.hostCountry,
      }),
    );
  }
}
