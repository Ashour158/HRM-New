import { Injectable } from '@nestjs/common';
import { EventBus } from '../../../platform/event-bus/event-bus.js';
import { Uuid } from '@hcm/shared-kernel';
import type { HrCommandEnvelope } from '@hcm/command-contracts';
import type { HrEventEnvelope } from '@hcm/event-schemas';
import { createPrivacyForEvent } from '@hcm/event-schemas';
import {
  LEGAL_ENTITY_CREATED,
  LEGAL_ENTITY_ACTIVATED,
  LEGAL_ENTITY_DEACTIVATED,
  type LegalEntityCreatedPayload,
  type LegalEntityActivatedPayload,
  type LegalEntityDeactivatedPayload,
} from '@hcm/event-schemas';
import type { DomainEvent } from '@hcm/shared-kernel';
import {
  LegalEntityCreated,
  LegalEntityActivated,
  LegalEntityDeactivated,
  LegalEntityDissolved,
  LegalEntityUpdated,
} from '../aggregates/legal-entity.aggregate.js';
import type { LegalEntity } from '../aggregates/legal-entity.aggregate.js';

/**
 * Publishes canonical HrEventEnvelope events derived from
 * LegalEntity domain events.
 */
@Injectable()
export class LegalEntityEventsPublisher {
  constructor(private readonly eventBus: EventBus) {}

  /**
   * Maps and publishes all uncommitted domain events on the aggregate.
   */
  async publishAll(entity: LegalEntity, command: HrCommandEnvelope<unknown>): Promise<void> {
    const envelopes = entity.domainEvents.map((event) => this.map(event, command));
    if (envelopes.length > 0) {
      await this.eventBus.publishAll(envelopes);
    }
    entity.clearDomainEvents();
  }

  private map(event: DomainEvent, command: HrCommandEnvelope<unknown>): HrEventEnvelope<unknown> {
    const baseMetadata = {
      correlationId: command.correlationId,
      causationId: command.commandId,
      requestHash: command.metadata.requestHash,
      clientType: command.metadata.clientType,
    };

    if (event instanceof LegalEntityCreated) {
      const payload: LegalEntityCreatedPayload = {
        legalEntityId: event.aggregateId,
        countryCode: event.countryCode,
        createdBy: command.actor.actorId,
      };
      return {
        eventId: Uuid.generate(),
        eventName: LEGAL_ENTITY_CREATED,
        eventSchemaVersion: 1,
        tenantId: command.tenantId,
        aggregateType: 'LegalEntity',
        aggregateId: event.aggregateId,
        payload,
        metadata: baseMetadata,
        privacy: createPrivacyForEvent('NONE', undefined, 'PROFILE'),
        occurredAt: new Date(),
        version: 1,
      };
    }

    if (event instanceof LegalEntityActivated) {
      const payload: LegalEntityActivatedPayload = {
        legalEntityId: event.aggregateId,
        activatedBy: command.actor.actorId,
      };
      return {
        eventId: Uuid.generate(),
        eventName: LEGAL_ENTITY_ACTIVATED,
        eventSchemaVersion: 1,
        tenantId: command.tenantId,
        aggregateType: 'LegalEntity',
        aggregateId: event.aggregateId,
        payload,
        metadata: baseMetadata,
        privacy: createPrivacyForEvent('NONE', undefined, 'PROFILE'),
        occurredAt: new Date(),
        version: 1,
      };
    }

    if (event instanceof LegalEntityDeactivated) {
      const payload: LegalEntityDeactivatedPayload = {
        legalEntityId: event.aggregateId,
        deactivatedBy: command.actor.actorId,
      };
      return {
        eventId: Uuid.generate(),
        eventName: LEGAL_ENTITY_DEACTIVATED,
        eventSchemaVersion: 1,
        tenantId: command.tenantId,
        aggregateType: 'LegalEntity',
        aggregateId: event.aggregateId,
        payload,
        metadata: baseMetadata,
        privacy: createPrivacyForEvent('NONE', undefined, 'PROFILE'),
        occurredAt: new Date(),
        version: 1,
      };
    }

    if (event instanceof LegalEntityDissolved) {
      return {
        eventId: Uuid.generate(),
        eventName: 'LegalEntityDissolved',
        eventSchemaVersion: 1,
        tenantId: command.tenantId,
        aggregateType: 'LegalEntity',
        aggregateId: event.aggregateId,
        payload: {
          legalEntityId: event.aggregateId,
          dissolvedBy: command.actor.actorId,
        },
        metadata: baseMetadata,
        privacy: createPrivacyForEvent('NONE', undefined, 'PROFILE'),
        occurredAt: new Date(),
        version: 1,
      } as HrEventEnvelope<unknown>;
    }

    if (event instanceof LegalEntityUpdated) {
      return {
        eventId: Uuid.generate(),
        eventName: 'LegalEntityUpdated',
        eventSchemaVersion: 1,
        tenantId: command.tenantId,
        aggregateType: 'LegalEntity',
        aggregateId: event.aggregateId,
        payload: {
          legalEntityId: event.aggregateId,
          name: event.name,
          registrationNumber: event.registrationNumber,
        },
        metadata: baseMetadata,
        privacy: createPrivacyForEvent('NONE', undefined, 'PROFILE'),
        occurredAt: new Date(),
        version: 1,
      } as HrEventEnvelope<unknown>;
    }

    throw new Error(`Unknown LegalEntity event type: ${event.eventName}`);
  }
}
