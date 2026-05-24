import { AggregateRoot, DomainEvent, Uuid, Guard } from '@hcm/shared-kernel';

/**
 * Benefits life event lifecycle states.
 */
export type BenefitsLifeEventStatus = 'RECORDED' | 'PENDING_PROCESSING' | 'PROCESSED' | 'REJECTED';

/**
 * Properties required to construct a {@link BenefitsLifeEvent}.
 */
export interface BenefitsLifeEventProps {
  id: Uuid;
  tenantId: Uuid;
  workerId: Uuid;
  eventType: string;
  eventDate: Date;
  description?: string;
  status: BenefitsLifeEventStatus;
  aggregateVersion?: number;
  createdAt?: Date;
  updatedAt?: Date;
}

/* ------------------------------------------------------------------ */
/*  Domain Events                                                      */
/* ------------------------------------------------------------------ */

export class LifeEventRecorded extends DomainEvent {
  readonly workerId: string;
  readonly eventType: string;

  constructor(props: { tenantId: Uuid; aggregateId: Uuid; correlationId: Uuid; workerId: Uuid; eventType: string }) {
    super({ eventName: 'LifeEventRecorded', tenantId: props.tenantId, aggregateType: 'BenefitsLifeEvent', aggregateId: props.aggregateId, correlationId: props.correlationId });
    this.workerId = props.workerId.value;
    this.eventType = props.eventType;
  }
}

export class LifeEventProcessed extends DomainEvent {
  constructor(props: { tenantId: Uuid; aggregateId: Uuid; correlationId: Uuid }) {
    super({ eventName: 'LifeEventProcessed', tenantId: props.tenantId, aggregateType: 'BenefitsLifeEvent', aggregateId: props.aggregateId, correlationId: props.correlationId });
  }
}

export class LifeEventRejected extends DomainEvent {
  constructor(props: { tenantId: Uuid; aggregateId: Uuid; correlationId: Uuid }) {
    super({ eventName: 'LifeEventRejected', tenantId: props.tenantId, aggregateType: 'BenefitsLifeEvent', aggregateId: props.aggregateId, correlationId: props.correlationId });
  }
}

/* ------------------------------------------------------------------ */
/*  Aggregate                                                          */
/* ------------------------------------------------------------------ */

/**
 * Aggregate root representing a benefits life event.
 *
 * FSM lifecycle: RECORDED → PENDING_PROCESSING → PROCESSED
 *                                          ↘ REJECTED (terminal)
 */
export class BenefitsLifeEvent extends AggregateRoot {
  readonly tenantId: Uuid;
  workerId: Uuid;
  eventType: string;
  eventDate: Date;
  description?: string;
  status: BenefitsLifeEventStatus;
  readonly createdAt: Date;
  updatedAt: Date;

  get aggregateVersion(): number {
    return this.version;
  }

  constructor(props: BenefitsLifeEventProps) {
    super(props.id);
    this.tenantId = props.tenantId;
    this.workerId = props.workerId;
    this.eventType = props.eventType;
    this.eventDate = props.eventDate;
    this.description = props.description;
    this.status = props.status;
    this.createdAt = props.createdAt ?? new Date();
    this.updatedAt = props.updatedAt ?? new Date();
    if (props.aggregateVersion !== undefined) {
      this.restoreVersion(props.aggregateVersion);
    }
  }

  static create(props: Omit<BenefitsLifeEventProps, 'status' | 'createdAt' | 'updatedAt' | 'aggregateVersion'> & { correlationId: Uuid }): BenefitsLifeEvent {
    Guard.againstEmptyString(props.eventType, 'eventType');

    const event = new BenefitsLifeEvent({
      ...props,
      status: 'RECORDED',
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    event.addDomainEvent(new LifeEventRecorded({ tenantId: event.tenantId, aggregateId: event.id, correlationId: props.correlationId, workerId: event.workerId, eventType: event.eventType }));
    return event;
  }

  sendForProcessing(_correlationId: Uuid): void {
    if (this.status !== 'RECORDED') {
      throw new Error(`Cannot send BenefitsLifeEvent for processing from state ${this.status}`);
    }
    this.status = 'PENDING_PROCESSING';
    this.updatedAt = new Date();
    this.incrementVersion();
  }

  process(correlationId: Uuid): void {
    if (this.status !== 'PENDING_PROCESSING' && this.status !== 'RECORDED') {
      throw new Error(`Cannot process BenefitsLifeEvent from state ${this.status}`);
    }
    this.status = 'PROCESSED';
    this.updatedAt = new Date();
    this.incrementVersion();
    this.addDomainEvent(new LifeEventProcessed({ tenantId: this.tenantId, aggregateId: this.id, correlationId }));
  }

  reject(correlationId: Uuid): void {
    if (this.status !== 'PENDING_PROCESSING' && this.status !== 'RECORDED') {
      throw new Error(`Cannot reject BenefitsLifeEvent from state ${this.status}`);
    }
    this.status = 'REJECTED';
    this.updatedAt = new Date();
    this.incrementVersion();
    this.addDomainEvent(new LifeEventRejected({ tenantId: this.tenantId, aggregateId: this.id, correlationId }));
  }
}
