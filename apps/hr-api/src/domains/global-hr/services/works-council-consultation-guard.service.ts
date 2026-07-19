import { Injectable } from '@nestjs/common';
import { Uuid, ConflictError } from '@hcm/shared-kernel';
import { WorksCouncilConsultationRepository } from '../repositories/works-council-consultation.repository.js';
import type { WorksCouncilConsultation } from '../aggregates/works-council-consultation.aggregate.js';

/**
 * Enforces works-council consultation gating across employer actions that are
 * legally conditioned on completing a required works-council consultation
 * (restructuring, layoffs / reduction-in-force, and certain terminations) in
 * jurisdictions where such consultation is mandated.
 *
 * Scoping decision (documented here because it is load-bearing for callers):
 * a {@link WorksCouncilConsultation} record is keyed to a `legalEntityId`, not
 * to a specific worker, org unit, or action. This guard therefore blocks a
 * command only when it can cleanly resolve the **legal entity** the command
 * acts on, and only against consultations for that exact legal entity — it
 * never widens the check to a country, tenant, or org-unit subtree, because
 * the data model does not give us a reliable way to prove those relationships
 * without risking false positives (blocking an unrelated legal entity's
 * action). Callers that cannot resolve a legalEntityId for the aggregate they
 * are mutating (e.g. a worker record with no legal entity on file) should
 * skip the guard rather than guess — an unenforced gap is the pre-existing
 * behavior, whereas an incorrectly-scoped block would be a new regression.
 *
 * A consultation is considered blocking while it is in REQUIRED, INITIATED,
 * or IN_PROGRESS — the same set the aggregate's own `isBlocking()` uses, and
 * exactly what {@link WorksCouncilConsultationRepository.findBlockingByLegalEntity}
 * queries for. COMPLETED consultations never block. BLOCKED consultations are
 * a terminal record of an action that was already stopped by the works
 * council (not an open-ended future block on other actions), so they are
 * intentionally excluded here too — they do not gate this guard.
 *
 * This guard deliberately does NOT filter by the consultation's free-text
 * `actionType` field: `actionType` is operator-supplied text with no
 * canonical vocabulary, so matching on it risks silently missing a real block
 * (a false negative) far more than it risks being overly conservative. Any
 * open, required consultation for the legal entity blocks any guarded action
 * against that legal entity until it is completed.
 */
@Injectable()
export class WorksCouncilConsultationGuard {
  constructor(private readonly repo: WorksCouncilConsultationRepository) {}

  /**
   * Returns the works-council consultations currently blocking actions
   * against the given legal entity, scoped to the given tenant.
   */
  async blockingConsultationsForLegalEntity(
    legalEntityId: Uuid,
    tenantId: Uuid,
  ): Promise<WorksCouncilConsultation[]> {
    const consultations = await this.repo.findBlockingByLegalEntity(legalEntityId);
    return consultations.filter((consultation) => consultation.tenantId.value === tenantId.value);
  }

  async isBlocked(legalEntityId: Uuid, tenantId: Uuid): Promise<boolean> {
    const blocking = await this.blockingConsultationsForLegalEntity(legalEntityId, tenantId);
    return blocking.length > 0;
  }

  /**
   * Throws {@link ConflictError} if the legal entity has a required
   * works-council consultation that has not yet completed.
   */
  async assertNotBlocked(legalEntityId: Uuid, tenantId: Uuid, operation: string): Promise<void> {
    const blocking = await this.blockingConsultationsForLegalEntity(legalEntityId, tenantId);
    if (blocking.length > 0) {
      throw new ConflictError(
        `Cannot ${operation}: legal entity ${legalEntityId.value} has a required works-council consultation that has not been completed`,
        {
          legalEntityId: legalEntityId.value,
          operation,
          consultationIds: blocking.map((consultation) => consultation.id.value),
        },
      );
    }
  }
}
