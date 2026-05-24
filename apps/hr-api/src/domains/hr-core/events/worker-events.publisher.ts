import { Injectable } from '@nestjs/common';
import { EventBus } from '../../../platform/event-bus/event-bus.js';
import type { HrEventEnvelope, HrEventPrivacy } from '@hcm/event-schemas';
import { createPrivacyForEvent } from '@hcm/event-schemas';
import type { DomainEvent, Uuid } from '@hcm/shared-kernel';
import {
  WorkerProfileCreated,
  WorkerActivated,
  WorkerTerminated,
  WorkerSuspended,
  WorkerReinstated,
  WorkerRehired,
  PersonalDataUpdated,
  JobInfoUpdated,
  ManagerAssigned,
} from '../aggregates/worker-profile.aggregate.js';

/**
 * Publishes canonical {@link HrEventEnvelope} events derived from
 * {@link WorkerProfile} domain events.
 */
@Injectable()
export class WorkerEventsPublisher {
  constructor(private readonly eventBus: EventBus) {}

  /**
   * Maps all uncommitted domain events on the aggregate to canonical envelopes
   * and publishes them to the {@link EventBus}.
   */
  async publishFromAggregate(aggregate: {
    id: Uuid;
    tenantId: Uuid;
    status: string;
    domainEvents: DomainEvent[];
  }): Promise<void> {
    const events = aggregate.domainEvents
      .map((e) => this.toEnvelope(e, aggregate.id, aggregate.tenantId))
      .filter((e): e is HrEventEnvelope<unknown> => !!e);

    await Promise.all(events.map((e) => this.eventBus.publish(e)));
  }

  private toEnvelope(
    event: DomainEvent,
    aggregateId: Uuid,
    tenantId: Uuid,
  ): HrEventEnvelope<unknown> | undefined {
    const base = {
      eventId: event.eventId,
      eventName: event.eventName,
      eventSchemaVersion: 1,
      tenantId,
      aggregateType: 'WorkerProfile',
      aggregateId,
      metadata: {
        correlationId: event.correlationId,
        causationId: event.causationId,
        requestHash: '',
        clientType: 'HR_ADMIN' as const,
      },
      privacy: this.buildPrivacy(event, aggregateId),
      occurredAt: event.occurredAt,
      version: event.version,
    };

    switch (true) {
      case event instanceof WorkerProfileCreated:
        return {
          ...base,
          payload: {
            workerId: aggregateId.value,
            employeeNumber: event.employeeNumber,
            email: event.email,
          },
        };
      case event instanceof WorkerActivated:
        return {
          ...base,
          payload: { workerId: aggregateId.value, activatedAt: event.occurredAt.toISOString() },
        };
      case event instanceof WorkerTerminated:
        return {
          ...base,
          payload: {
            workerId: aggregateId.value,
            terminationDate: event.terminationDate.toISOString(),
            reason: event.reason,
          },
        };
      case event instanceof WorkerSuspended:
        return {
          ...base,
          payload: { workerId: aggregateId.value, reason: event.reason },
        };
      case event instanceof WorkerReinstated:
        return {
          ...base,
          payload: { workerId: aggregateId.value, reinstatedAt: event.occurredAt.toISOString() },
        };
      case event instanceof WorkerRehired:
        return {
          ...base,
          payload: { workerId: aggregateId.value, rehiredAt: event.occurredAt.toISOString() },
        };
      case event instanceof PersonalDataUpdated:
        return {
          ...base,
          payload: { workerId: aggregateId.value, fields: event.fields },
        };
      case event instanceof JobInfoUpdated:
        return {
          ...base,
          payload: {
            workerId: aggregateId.value,
            jobTitle: event.jobTitle,
            departmentId: event.departmentId,
            legalEntityId: event.legalEntityId,
            managerId: event.managerId,
          },
        };
      case event instanceof ManagerAssigned:
        return {
          ...base,
          payload: { workerId: aggregateId.value, managerId: event.managerId },
        };
      default:
        return undefined;
    }
  }

  private buildPrivacy(event: DomainEvent, aggregateId: Uuid): HrEventPrivacy {
    if (event.eventName === 'WorkerTerminated') {
      return {
        piiClassification: 'HIGH',
        employeeDataCategory: 'PROFILE',
        subjectWorkerId: aggregateId.value,
        managerVisible: true,
        employeeVisible: false,
        hrRestricted: true,
        redactionApplied: false,
        dataResidencyRegion: undefined,
      };
    }
    return createPrivacyForEvent('NONE', aggregateId.value, 'PROFILE');
  }
}
