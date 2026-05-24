import { Uuid } from '../value-objects/uuid.js';

/**
 * Base class for all domain events.
 */
export abstract class DomainEvent {
  /** The unique identifier of this event instance. */
  readonly eventId: Uuid;
  /** The name of the event type. */
  readonly eventName: string;
  /** The tenant that owns the aggregate where the event originated. */
  readonly tenantId: Uuid;
  /** The type name of the aggregate that emitted the event. */
  readonly aggregateType: string;
  /** The identifier of the aggregate that emitted the event. */
  readonly aggregateId: Uuid;
  /** The correlation id for distributed tracing. */
  readonly correlationId: Uuid;
  /** The causation id linking this event to its trigger. */
  readonly causationId?: Uuid;
  /** The timestamp when the event occurred. */
  readonly occurredAt: Date;
  /** The event schema version. */
  readonly version: number;

  /**
   * @param props Properties for constructing the domain event
   */
  constructor(props: {
    eventId?: Uuid;
    eventName: string;
    tenantId: Uuid;
    aggregateType: string;
    aggregateId: Uuid;
    correlationId: Uuid;
    causationId?: Uuid;
    occurredAt?: Date;
    version?: number;
  }) {
    this.eventId = props.eventId ?? Uuid.generate();
    this.eventName = props.eventName;
    this.tenantId = props.tenantId;
    this.aggregateType = props.aggregateType;
    this.aggregateId = props.aggregateId;
    this.correlationId = props.correlationId;
    this.causationId = props.causationId;
    this.occurredAt = props.occurredAt ?? new Date();
    this.version = props.version ?? 1;
  }
}
