import { Injectable } from '@nestjs/common';
import type { Uuid } from '@hcm/shared-kernel';
import { LegalEntityRepository } from './repositories/legal-entity.repository.js';
import type { LegalEntity } from './aggregates/legal-entity.aggregate.js';

// Re-exported so cross-domain consumers can type their variables without importing
// directly from organization's internal aggregates/ folder.
export type { LegalEntity };

/**
 * Public, read-only query surface for the organization domain.
 *
 * Other domains that need legal-entity information should depend on this service
 * instead of importing organization's LegalEntityRepository (or its aggregates)
 * directly. Only the read operations that cross-domain consumers actually need are
 * exposed here; write access must go through organization's CommandBus command
 * handlers.
 */
@Injectable()
export class OrganizationDirectoryQueryService {
  constructor(private readonly legalEntityRepo: LegalEntityRepository) {}

  findLegalEntitiesForTenant(tenantId: Uuid): Promise<LegalEntity[]> {
    return this.legalEntityRepo.findByTenant(tenantId);
  }
}
