import { Injectable } from '@nestjs/common';
import { ConflictError, NotFoundError, Uuid } from '@hcm/shared-kernel';
import { HrAiUseCaseRepository } from '../repositories/hr-ai-use-case.repository.js';
import { HrAiKillSwitchRepository } from '../repositories/hr-ai-kill-switch.repository.js';
import type { HrAiUseCase } from '../aggregates/hr-ai-use-case.aggregate.js';
import type { HrAiKillSwitchStatus } from '../aggregates/hr-ai-kill-switch.aggregate.js';

/**
 * Kill-switch statuses that represent an active, unresolved trigger. ARMED
 * and REARMED are "ready to trigger" (not blocking); RESOLVED means the
 * incident is closed (not blocking). TRIGGERED and INVESTIGATING mean the
 * safety-stop has fired and has not yet been cleared - those must block.
 */
const BLOCKING_KILL_SWITCH_STATUSES: ReadonlySet<HrAiKillSwitchStatus> = new Set(['TRIGGERED', 'INVESTIGATING']);

/**
 * Enforces the HR-AI governance safety-stop mechanism ahead of any command
 * that creates or advances model-run activity for a use case.
 *
 * Without this guard, `TriggerHrAiKillSwitch` only flips the HrAiKillSwitch
 * aggregate's own status and publishes an event nothing subscribes to -
 * CreateHrAiModelRun/StartHrAiModelRun have no other way to learn a use case
 * has been suspended or its kill switch pulled, and would otherwise proceed
 * as if nothing had happened. This guard is the load-bearing check that
 * closes that gap: it must be called by both handlers before they mutate a
 * model run, using the tenant-scoped `findById`/`findByUseCaseId` lookups so
 * the check itself cannot be bypassed cross-tenant.
 */
@Injectable()
export class HrAiUseCaseGuard {
  constructor(
    private readonly useCaseRepo: HrAiUseCaseRepository,
    private readonly killSwitchRepo: HrAiKillSwitchRepository,
  ) {}

  /**
   * Loads the use case and asserts it is safe to run model activity against:
   * it must exist, must not be SUSPENDED, and must have no kill switch
   * currently TRIGGERED or INVESTIGATING. Returns the loaded use case so
   * callers that need it anyway (e.g. CreateHrAiModelRun) don't have to
   * fetch it twice.
   *
   * @param operation Human-readable description used in the thrown error
   *   message (e.g. "create HR AI model run").
   */
  async assertRunnable(useCaseId: Uuid, tenantId: Uuid, operation: string): Promise<HrAiUseCase> {
    const useCase = await this.useCaseRepo.findById(useCaseId, tenantId);
    if (!useCase) {
      throw new NotFoundError(`Cannot ${operation}: HR AI use case ${useCaseId.value} not found`, {
        useCaseId: useCaseId.value,
        operation,
      });
    }
    if (useCase.status === 'SUSPENDED') {
      throw new ConflictError(`Cannot ${operation}: use case ${useCaseId.value} is SUSPENDED`, {
        useCaseId: useCaseId.value,
        operation,
        useCaseStatus: useCase.status,
      });
    }

    const killSwitches = await this.killSwitchRepo.findByUseCaseId(useCaseId, tenantId);
    const activeKillSwitch = killSwitches.find((ks) => BLOCKING_KILL_SWITCH_STATUSES.has(ks.status));
    if (activeKillSwitch) {
      throw new ConflictError(
        `Cannot ${operation}: use case ${useCaseId.value} has an active kill switch (${activeKillSwitch.status})`,
        {
          useCaseId: useCaseId.value,
          operation,
          killSwitchId: activeKillSwitch.id.value,
          killSwitchStatus: activeKillSwitch.status,
        },
      );
    }

    return useCase;
  }
}
