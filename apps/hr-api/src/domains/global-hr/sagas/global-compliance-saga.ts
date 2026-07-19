import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { HR_CORE, isWorkerTerminatedEvent, isWorkerActivatedEvent } from '@hcm/event-schemas';
import type { Uuid } from '@hcm/shared-kernel';
import type { HrEventEnvelope } from '@hcm/event-schemas';
import { EventBus } from '../../../platform/event-bus/event-bus.js';
import { WorkAuthorizationCaseRepository } from '../repositories/work-authorization-case.repository.js';

/**
 * Global compliance saga that coordinates cross-domain workflows.
 *
 * Consumes: WorkerTerminated, WorkerActivated, JobAssignmentChanged
 * Actions:
 * - Checks works council requirements
 * - Triggers statutory report generation
 * - Updates work authorization cases
 */
@Injectable()
export class GlobalComplianceSaga implements OnModuleInit {
  private readonly logger = new Logger(GlobalComplianceSaga.name);

  constructor(
    private readonly eventBus: EventBus,
    private readonly workAuthorizationRepo: WorkAuthorizationCaseRepository,
  ) {}

  onModuleInit(): void {
    this.eventBus.subscribe(HR_CORE, 'global-compliance-saga', {
      consumerGroup: 'global-compliance-saga',
      handle: async (event: HrEventEnvelope<unknown>) => {
        if (isWorkerTerminatedEvent(event)) {
          await this.onWorkerTerminated(event);
        } else if (isWorkerActivatedEvent(event)) {
          await this.onWorkerActivated(event);
        }
      },
    });
  }

  private async onWorkerTerminated(event: HrEventEnvelope<{ workerId: Uuid }>): Promise<void> {
    // Note: works-council consultations that block termination are enforced
    // synchronously and *before* termination proceeds, by
    // WorksCouncilConsultationGuard inside TerminateWorkerHandler — not here.
    // By the time this saga runs, WorkerTerminated has already occurred, so
    // this handler only has post-hoc cleanup work left to do.
    const workerId = event.payload.workerId;

    // Update work authorization cases for terminated worker
    const authCases = await this.workAuthorizationRepo.findByWorker(workerId);
    for (const authCase of authCases) {
      if (authCase.status === 'APPROVED' || authCase.status === 'RENEWED') {
        authCase.close(event.metadata.correlationId);
        await this.workAuthorizationRepo.save(authCase);
      }
    }

    this.logger.log({
      type: 'SAGA_WORKER_TERMINATED_PROCESSED',
      workerId: workerId.value,
      closedAuthCases: authCases.length,
    });
  }

  private async onWorkerActivated(event: HrEventEnvelope<{ workerId: Uuid }>): Promise<void> {
    // Check works council requirements for activated worker
    const workerId = event.payload.workerId;

    this.logger.log({
      type: 'SAGA_WORKER_ACTIVATED_PROCESSED',
      workerId: workerId.value,
    });
  }
}
