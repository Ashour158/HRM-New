import { Injectable } from '@nestjs/common';
import { Uuid, ConflictError } from '@hcm/shared-kernel';
import { LegalHoldRepository } from '../repositories/legal-hold.repository.js';

/**
 * Enforces legal-hold blocking across destructive operations.
 *
 * Any command that would delete, anonymize, or otherwise destroy personal data
 * for a worker must call {@link assertNotUnderHold} first. If an active legal
 * hold covers the worker, the operation is rejected with a {@link ConflictError}
 * (HTTP 409) — the hold must be released before the data can be erased.
 */
@Injectable()
export class LegalHoldGuard {
  constructor(private readonly legalHoldRepo: LegalHoldRepository) {}

  /**
   * Returns the active holds blocking destructive operations on the worker.
   */
  async activeHoldsForWorker(workerId: Uuid, tenantId: Uuid) {
    return this.legalHoldRepo.findActiveByWorkerForTenant(workerId, tenantId);
  }

  async isUnderHold(workerId: Uuid, tenantId: Uuid): Promise<boolean> {
    const holds = await this.activeHoldsForWorker(workerId, tenantId);
    return holds.length > 0;
  }

  /**
   * Throws {@link ConflictError} if an active legal hold covers the worker.
   */
  async assertNotUnderHold(workerId: Uuid, tenantId: Uuid, operation: string): Promise<void> {
    const holds = await this.activeHoldsForWorker(workerId, tenantId);
    if (holds.length > 0) {
      throw new ConflictError(
        `Cannot ${operation}: worker ${workerId.value} is under an active legal hold`,
        {
          workerId: workerId.value,
          operation,
          holdIds: holds.map((h) => h.id.value),
        },
      );
    }
  }
}
