import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Uuid } from '@hcm/shared-kernel';
import { isOfferAcceptedEvent, isJobRequisitionFilledEvent } from '@hcm/event-schemas';
import type { HrEventEnvelope } from '@hcm/event-schemas';
import { createCommand } from '@hcm/command-contracts';
import { CommandBus } from '../../../platform/command-bus/command-bus.js';
import { EventBus } from '../../../platform/event-bus/event-bus.js';
import { OfferRepository } from '../repositories/offer.repository.js';
import { CandidateRepository } from '../repositories/candidate.repository.js';
import { JobRequisitionRepository } from '../repositories/job-requisition.repository.js';
import type { CandidateStatus } from '../aggregates/candidate.aggregate.js';

interface SagaState {
  sagaId: string;
  offerId: string;
  tenantId: string;
  correlationId: string;
  startedAt: Date;
  stepsCompleted: string[];
  status: 'RUNNING' | 'COMPLETED' | 'MANUAL_REVIEW' | 'FAILED';
}

/**
 * OfferToHireSaga coordinates the post-offer-acceptance hiring workflow.
 *
 * Trigger: OfferAccepted event
 * Steps:
 *   1. Create WorkerProfile in HR Core
 *   2. Create EmploymentRelationship
 *   3. Create JobAssignment
 *   4. Fill Position in Position Control
 *   5. Create OnboardingPlan
 *   6. Create I-9 Case (future)
 *   7. Create Work Authorization Case (future)
 *   8. IAM Provisioning (future)
 *
 * Max duration: 7 days
 * Timeout: moves to MANUAL_REVIEW
 * DLQ: hr.saga.dlq.offer-to-hire
 *
 * Secondary trigger: JobRequisitionFilled event
 *   Bulk-rejects every other still-active candidate in the filled
 *   requisition's pipeline via RejectCandidate, so applicants don't sit
 *   stuck once the position is no longer open (see onJobRequisitionFilled).
 */
@Injectable()
export class OfferToHireSaga implements OnModuleInit {
  private readonly logger = new Logger(OfferToHireSaga.name);
  private readonly sagaStates = new Map<string, SagaState>();
  private readonly maxDurationMs = 7 * 24 * 60 * 60 * 1000;

  constructor(
    private readonly eventBus: EventBus,
    private readonly commandBus: CommandBus,
    private readonly offerRepo: OfferRepository,
    private readonly candidateRepo: CandidateRepository,
    private readonly requisitionRepo: JobRequisitionRepository,
  ) {}

  onModuleInit(): void {
    this.eventBus.subscribe('hr.recruiting.v1', 'offer-to-hire-saga', {
      consumerGroup: 'offer-to-hire-saga',
      handle: async (event: HrEventEnvelope<unknown>) => {
        if (isOfferAcceptedEvent(event)) {
          await this.onOfferAccepted(event);
        } else if (isJobRequisitionFilledEvent(event)) {
          await this.onJobRequisitionFilled(event);
        }
      },
    });

    // Periodic timeout check
    setInterval(() => this.checkTimeouts(), 60 * 60 * 1000);
  }

  private async onOfferAccepted(event: HrEventEnvelope<{ offerId: string; acceptedBy: string }>): Promise<void> {
    // `event.payload.offerId` is a plain UUID string (see the note on
    // OfferAcceptedPayload in @hcm/event-schemas) -- normalize once here so
    // every use below is a real `Uuid` instance, not a string wrongly typed
    // as `Uuid` (which would silently no-op `.value` and break
    // `offerRepo.findById`).
    const offerId = new Uuid(event.payload.offerId);
    const sagaId = `saga-${offerId.value}-${Date.now()}`;
    const tenantId = event.tenantId.value;
    const correlationId = event.metadata.correlationId.value;

    this.logger.log({
      type: 'SAGA_STARTED',
      sagaId,
      offerId: offerId.value,
      tenantId,
    });

    const state: SagaState = {
      sagaId,
      offerId: offerId.value,
      tenantId,
      correlationId,
      startedAt: new Date(),
      stepsCompleted: [],
      status: 'RUNNING',
    };
    this.sagaStates.set(sagaId, state);

    try {
      const offer = await this.offerRepo.findById(offerId);
      if (!offer) {
        throw new Error('Offer not found');
      }

      const candidate = await this.candidateRepo.findById(offer.candidateId);
      if (!candidate) {
        throw new Error('Candidate not found');
      }

      const requisition = await this.requisitionRepo.findById(offer.requisitionId);

      // 1. Create WorkerProfile
      const workerId = Uuid.generate();
      await this.dispatchCommand(
        tenantId,
        correlationId,
        'CreateWorker',
        'WorkerProfile',
        {
          workerId,
          firstName: candidate.firstName,
          lastName: candidate.lastName,
          email: candidate.email,
        },
      );
      state.stepsCompleted.push('CreateWorkerProfile');

      // 2. Create EmploymentRelationship
      await this.dispatchCommand(
        tenantId,
        correlationId,
        'CreateEmploymentRelationship',
        'EmploymentRelationship',
        {
          workerId,
          relationshipType: 'EMPLOYEE',
          startDate: offer.startDate,
        },
      );
      state.stepsCompleted.push('CreateEmploymentRelationship');

      // 3. Create JobAssignment
      const assignmentId = Uuid.generate();
      await this.dispatchCommand(
        tenantId,
        correlationId,
        'CreateJobAssignment',
        'JobAssignment',
        {
          assignmentId,
          workerId,
          positionId: requisition?.positionId.value ?? '',
          startDate: offer.startDate,
        },
      );
      state.stepsCompleted.push('CreateJobAssignment');

      // 4. Fill Position
      if (requisition) {
        await this.dispatchCommand(
          tenantId,
          correlationId,
          'FillPosition',
          'position',
          {
            positionId: requisition.positionId.value,
            workerId: workerId.value,
          },
        );
        state.stepsCompleted.push('FillPosition');
      }

      // 5. Create OnboardingPlan
      const planId = Uuid.generate();
      await this.dispatchCommand(
        tenantId,
        correlationId,
        'CreateOnboardingPlan',
        'OnboardingPlan',
        {
          planId,
          workerId,
          startDate: offer.startDate,
        },
      );
      state.stepsCompleted.push('CreateOnboardingPlan');

      // 6-8. Future steps
      state.stepsCompleted.push('I9Case_PENDING');
      state.stepsCompleted.push('WorkAuthorization_PENDING');
      state.stepsCompleted.push('IAMProvisioning_PENDING');

      state.status = 'COMPLETED';
      this.logger.log({
        type: 'SAGA_COMPLETED',
        sagaId,
        offerId: state.offerId,
        workerId: workerId.value,
      });
    } catch (err) {
      this.logger.error({
        type: 'SAGA_STEP_FAILED',
        sagaId,
        offerId: state.offerId,
        error: err instanceof Error ? err.message : String(err),
        dlq: 'hr.saga.dlq.offer-to-hire',
      });
      state.status = 'FAILED';
      this.moveToManualReview(state, err instanceof Error ? err.message : String(err));
    }
  }

  /**
   * Reacts to JobRequisitionFilled by bulk-rejecting every other candidate
   * still active in that requisition's pipeline, so they don't sit stuck
   * indefinitely once the position has been filled by someone else.
   *
   * Each candidate is rejected independently via the RejectCandidate
   * command (which calls the existing `candidate.reject()` aggregate
   * method) so this gets normal audit/outbox treatment. Failures are
   * isolated per-candidate — one candidate failing to transition (e.g.
   * because it was concurrently moved to a terminal state) must not stop
   * the rest of the pipeline from being cleaned up.
   */
  private async onJobRequisitionFilled(
    event: HrEventEnvelope<{ requisitionId: string; offerId?: string }>,
  ): Promise<void> {
    const tenantId = event.tenantId.value;
    const correlationId = event.metadata.correlationId.value;
    // `event.payload.requisitionId` is a plain UUID string -- see the note
    // on JobRequisitionFilledPayload in @hcm/event-schemas.
    const requisitionId = new Uuid(event.payload.requisitionId);

    const terminalStatuses: CandidateStatus[] = ['HIRED', 'REJECTED', 'WITHDRAWN'];
    const candidates = await this.candidateRepo.findByRequisition(requisitionId);
    const stillActive = candidates.filter((candidate) => !terminalStatuses.includes(candidate.status));

    if (stillActive.length === 0) {
      return;
    }

    this.logger.log({
      type: 'REQUISITION_FILLED_BULK_REJECT_STARTED',
      requisitionId: requisitionId.value,
      candidateCount: stillActive.length,
    });

    for (const candidate of stillActive) {
      try {
        await this.dispatchCommand(
          tenantId,
          correlationId,
          'RejectCandidate',
          'Candidate',
          { applicationId: candidate.id, reason: 'Requisition filled by another candidate' },
          candidate.id,
        );
      } catch (err) {
        this.logger.error({
          type: 'REQUISITION_FILLED_BULK_REJECT_STEP_FAILED',
          requisitionId: requisitionId.value,
          candidateId: candidate.id.value,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }
  }

  private async dispatchCommand(
    tenantId: string,
    correlationId: string,
    commandName: string,
    aggregateType: string,
    payload: unknown,
    aggregateId?: Uuid,
  ): Promise<void> {
    const command = createCommand(
      commandName,
      new Uuid(tenantId),
      {
        actorType: 'SYSTEM',
        actorId: Uuid.generate(),
        roles: ['SYSTEM'],
        permissions: ['*'],
        mfaAuthenticated: true,
      },
      payload,
      {
        aggregateType,
        aggregateId,
        idempotencyKey: crypto.randomUUID(),
        correlationId: new Uuid(correlationId),
        reason: `OfferToHireSaga: ${commandName}`,
      },
    );

    const outcome = await this.commandBus.execute(command);
    if (!outcome.success) {
      throw new Error(`Command ${commandName} failed: ${(outcome as { errorMessage: string }).errorMessage}`);
    }
  }

  private checkTimeouts(): void {
    const now = Date.now();
    for (const state of this.sagaStates.values()) {
      if (state.status !== 'RUNNING') continue;
      if (now - state.startedAt.getTime() > this.maxDurationMs) {
        state.status = 'MANUAL_REVIEW';
        this.moveToManualReview(state, 'Saga timed out after 7 days');
      }
    }
  }

  private moveToManualReview(state: SagaState, reason: string): void {
    this.logger.warn({
      type: 'SAGA_MANUAL_REVIEW',
      sagaId: state.sagaId,
      offerId: state.offerId,
      reason,
      completedSteps: state.stepsCompleted,
      dlq: 'hr.saga.dlq.offer-to-hire',
    });
  }
}
