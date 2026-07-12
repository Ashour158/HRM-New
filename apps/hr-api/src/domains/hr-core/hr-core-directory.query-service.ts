import { Injectable } from '@nestjs/common';
import type { Uuid } from '@hcm/shared-kernel';
import { WorkerRepository } from './repositories/worker.repository.js';
import { PersonalDataRecordRepository } from './repositories/personal-data-record.repository.js';
import type { WorkerProfile, WorkerStatus } from './aggregates/worker-profile.aggregate.js';
import type { PersonalDataRecord } from './aggregates/personal-data-record.aggregate.js';

// Re-exported so cross-domain consumers can type their variables without importing
// directly from hr-core's internal aggregates/ folder.
export type { WorkerProfile, WorkerStatus, PersonalDataRecord };

/**
 * Public, read-only query surface for the hr-core domain.
 *
 * Other domains that need worker or personal-data information should depend on this
 * service instead of importing hr-core's WorkerRepository / PersonalDataRecordRepository
 * (or its aggregates) directly. Only the read operations that cross-domain consumers
 * actually need are exposed here; write access must go through hr-core's CommandBus
 * command handlers.
 */
@Injectable()
export class HrCoreDirectoryQueryService {
  constructor(
    private readonly workerRepo: WorkerRepository,
    private readonly personalDataRepo: PersonalDataRecordRepository,
  ) {}

  findWorkerById(id: Uuid): Promise<WorkerProfile | undefined> {
    return this.workerRepo.findById(id);
  }

  findWorkersByStatusForTenant(
    status: WorkerStatus,
    tenantId: Uuid,
    options?: { limit?: number; offset?: number },
  ): Promise<WorkerProfile[]> {
    return this.workerRepo.findByStatusForTenant(status, tenantId, options);
  }

  searchWorkersForTenant(
    query: string,
    tenantId: Uuid,
    options?: {
      limit?: number;
      offset?: number;
      status?: WorkerStatus;
      departmentId?: Uuid;
      managerId?: Uuid;
      legalEntityId?: Uuid;
    },
  ): Promise<WorkerProfile[]> {
    return this.workerRepo.searchForTenant(query, tenantId, options);
  }

  findPersonalDataRecordsForWorker(workerId: Uuid): Promise<PersonalDataRecord[]> {
    return this.personalDataRepo.findByWorker(workerId);
  }

  findPersonalDataRecordsForWorkerForTenant(workerId: Uuid, tenantId: Uuid): Promise<PersonalDataRecord[]> {
    return this.personalDataRepo.findByWorkerForTenant(workerId, tenantId);
  }
}
