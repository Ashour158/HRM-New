import { Injectable } from '@nestjs/common';
import { DomainEvent } from '@hcm/shared-kernel';
import { LegalEntity } from '../aggregates/legal-entity.aggregate.js';
import {
  LegalEntityCreated,
  LegalEntityActivated,
  LegalEntityDeactivated,
  LegalEntityDissolved,
  LegalEntityUpdated,
} from '../aggregates/legal-entity.aggregate.js';

/**
 * Flat read-model view of a LegalEntity for API responses.
 */
export interface LegalEntityView {
  id: string;
  tenantId: string;
  name: string;
  code: string;
  countryCode: string;
  registrationNumber: string | null;
  status: string;
  version: number;
  createdAt: string;
  updatedAt: string;
}

/**
 * Projection service that can rebuild a {@link LegalEntityView} from
 * domain events or map a live aggregate directly.
 */
@Injectable()
export class LegalEntityProjection {
  /**
   * Rebuilds a view by folding a stream of LegalEntity domain events.
   */
  buildFromEvents(events: DomainEvent[]): LegalEntityView {
    let view: Partial<LegalEntityView> = {};

    for (const event of events) {
      if (event instanceof LegalEntityCreated) {
        view = {
          id: event.aggregateId.value,
          tenantId: event.tenantId.value,
          name: event.name,
          code: event.code,
          countryCode: event.countryCode,
          registrationNumber: null,
          status: 'DRAFT',
          version: 1,
          createdAt: event.occurredAt.toISOString(),
          updatedAt: event.occurredAt.toISOString(),
        };
      } else if (event instanceof LegalEntityActivated) {
        view.status = 'ACTIVE';
        view.version = (view.version ?? 0) + 1;
        view.updatedAt = event.occurredAt.toISOString();
      } else if (event instanceof LegalEntityDeactivated) {
        view.status = 'INACTIVE';
        view.version = (view.version ?? 0) + 1;
        view.updatedAt = event.occurredAt.toISOString();
      } else if (event instanceof LegalEntityDissolved) {
        view.status = 'DISSOLVED';
        view.version = (view.version ?? 0) + 1;
        view.updatedAt = event.occurredAt.toISOString();
      } else if (event instanceof LegalEntityUpdated) {
        if (event.name !== undefined) view.name = event.name;
        if (event.registrationNumber !== undefined) view.registrationNumber = event.registrationNumber;
        view.version = (view.version ?? 0) + 1;
        view.updatedAt = event.occurredAt.toISOString();
      }
    }

    return view as LegalEntityView;
  }

  /**
   * Maps a live aggregate to its read-model view.
   */
  toView(entity: LegalEntity): LegalEntityView {
    return {
      id: entity.id.value,
      tenantId: entity.tenantId.value,
      name: entity.name,
      code: entity.code,
      countryCode: entity.countryCode,
      registrationNumber: entity.registrationNumber,
      status: entity.status,
      version: entity.version,
      createdAt: entity.createdAt.toISOString(),
      updatedAt: entity.updatedAt.toISOString(),
    };
  }
}
