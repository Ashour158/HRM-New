import { Injectable } from '@nestjs/common';
import { CommandHandler } from '../../../platform/command-bus/command-handler.decorator.js';
import type { HrCommandEnvelope, CommandResult } from '@hcm/command-contracts';
import { Uuid } from '@hcm/shared-kernel';
import { FsmFramework } from '../../../platform/workflow/fsm-framework.js';
import { WorksCouncilConsultationRepository } from '../repositories/works-council-consultation.repository.js';
import { GlobalHrEventsPublisher } from '../events/global-hr-events.publisher.js';

type WorksCouncilConsultationPayload = {
  consultationId: Uuid;
  deadlineDate?: Date;
  blockingUntil?: Date;
};

/**
 * Default consultation window used when neither the command payload nor the
 * consultation record already carries a deadline. Deliberately NOT derived
 * from the wall clock (`Date.now()`) — a command replay/retry must compute
 * the exact same deadline every time it runs, and the wall clock is
 * different on every invocation. The basis date is either
 * `command.effectiveDate` (fixed at command-creation time, part of the
 * envelope that is replayed byte-for-byte on retry) or, if that is absent
 * too, the consultation's own persisted `createdAt` — both are deterministic
 * given the same command/aggregate state, unlike `Date.now()`.
 */
const DEFAULT_CONSULTATION_WINDOW_MS = 30 * 24 * 60 * 60 * 1000;

function worksCouncilConsultationResult(
  command: HrCommandEnvelope<unknown>,
  fsm: FsmFramework,
  consultation: Awaited<ReturnType<WorksCouncilConsultationRepository['findById']>>,
): CommandResult<unknown> {
  if (!consultation) throw new Error('Works council consultation not found');
  return {
    success: true,
    data: { consultationId: consultation.id.value, status: consultation.status },
    commandId: command.commandId,
    correlationId: command.correlationId,
    aggregateId: consultation.id,
    newState: consultation.status,
    newVersion: consultation.aggregateVersion,
    allowedNextActions: fsm.getAllowedActionsFromState(consultation.status, 'WorksCouncilConsultation'),
    fieldAccessDecisions: {},
    eventsEmitted: consultation.domainEvents.map((event) => event.eventName),
    auditRecordId: command.commandId,
  };
}

/**
 * Initiates a required WorksCouncilConsultation (REQUIRED → INITIATED),
 * recording the deadline by which the consultation must conclude.
 */
@CommandHandler('InitiateWorksCouncilConsultation')
@Injectable()
export class InitiateWorksCouncilConsultationHandler {
  readonly commandName = 'InitiateWorksCouncilConsultation';

  constructor(
    private readonly repo: WorksCouncilConsultationRepository,
    private readonly fsm: FsmFramework,
    private readonly eventsPublisher: GlobalHrEventsPublisher,
  ) {}

  async handle(command: HrCommandEnvelope<unknown>): Promise<CommandResult<unknown>> {
    const payload = command.payload as WorksCouncilConsultationPayload;
    const consultation = await this.repo.findById(payload.consultationId);
    if (!consultation) throw new Error('Works council consultation not found');
    if (consultation.status === 'INITIATED') {
      // Idempotent retry: a prior attempt already completed this transition
      // (state persisted) but the caller never observed the success (e.g.
      // response lost in transit). Re-invoking `initiate()` would throw
      // (REQUIRED -> INITIATED is no longer a valid transition from
      // INITIATED), turning a successful retry into a spurious failure.
      // Return the current state as the result instead of re-transitioning.
      return worksCouncilConsultationResult(command, this.fsm, consultation);
    }
    const deadlineBasis = command.effectiveDate ?? consultation.createdAt;
    const deadline = payload.deadlineDate
      ?? consultation.deadlineDate
      ?? new Date(deadlineBasis.getTime() + DEFAULT_CONSULTATION_WINDOW_MS);
    consultation.initiate(command.correlationId, deadline);
    await this.repo.save(consultation);
    await this.eventsPublisher.publishUncommitted(consultation, command.tenantId, command.correlationId);
    return worksCouncilConsultationResult(command, this.fsm, consultation);
  }
}

/**
 * Moves an initiated WorksCouncilConsultation into active progress
 * (INITIATED → IN_PROGRESS).
 */
@CommandHandler('StartWorksCouncilProgress')
@Injectable()
export class StartWorksCouncilProgressHandler {
  readonly commandName = 'StartWorksCouncilProgress';

  constructor(
    private readonly repo: WorksCouncilConsultationRepository,
    private readonly fsm: FsmFramework,
    private readonly eventsPublisher: GlobalHrEventsPublisher,
  ) {}

  async handle(command: HrCommandEnvelope<unknown>): Promise<CommandResult<unknown>> {
    const payload = command.payload as WorksCouncilConsultationPayload;
    const consultation = await this.repo.findById(payload.consultationId);
    if (!consultation) throw new Error('Works council consultation not found');
    if (consultation.status === 'IN_PROGRESS') {
      // Idempotent retry — see InitiateWorksCouncilConsultationHandler for rationale.
      return worksCouncilConsultationResult(command, this.fsm, consultation);
    }
    consultation.startProgress(command.correlationId);
    await this.repo.save(consultation);
    await this.eventsPublisher.publishUncommitted(consultation, command.tenantId, command.correlationId);
    return worksCouncilConsultationResult(command, this.fsm, consultation);
  }
}

/**
 * Completes a WorksCouncilConsultation (IN_PROGRESS → COMPLETED). Once
 * completed, the consultation no longer blocks the employer action it was
 * required for (see {@link WorksCouncilConsultationGuard}).
 */
@CommandHandler('CompleteWorksCouncilConsultation')
@Injectable()
export class CompleteWorksCouncilConsultationHandler {
  readonly commandName = 'CompleteWorksCouncilConsultation';

  constructor(
    private readonly repo: WorksCouncilConsultationRepository,
    private readonly fsm: FsmFramework,
    private readonly eventsPublisher: GlobalHrEventsPublisher,
  ) {}

  async handle(command: HrCommandEnvelope<unknown>): Promise<CommandResult<unknown>> {
    const payload = command.payload as WorksCouncilConsultationPayload;
    const consultation = await this.repo.findById(payload.consultationId);
    if (!consultation) throw new Error('Works council consultation not found');
    if (consultation.status === 'COMPLETED') {
      // Idempotent retry — see InitiateWorksCouncilConsultationHandler for rationale.
      return worksCouncilConsultationResult(command, this.fsm, consultation);
    }
    consultation.complete(command.correlationId);
    await this.repo.save(consultation);
    await this.eventsPublisher.publishUncommitted(consultation, command.tenantId, command.correlationId);
    return worksCouncilConsultationResult(command, this.fsm, consultation);
  }
}

/**
 * Marks a WorksCouncilConsultation as BLOCKED (INITIATED | IN_PROGRESS →
 * BLOCKED) — for example when the works council itself has objected or
 * escalated, preventing the underlying employer action from proceeding.
 *
 * BLOCKED is a terminal state in this aggregate's FSM (see
 * {@link WorksCouncilConsultationFsmRegistrar}): there is no aggregate method
 * or transition to move a consultation back out of BLOCKED. A blocked action
 * must be re-initiated as a new consultation once resolved.
 */
@CommandHandler('BlockWorksCouncilAction')
@Injectable()
export class BlockWorksCouncilActionHandler {
  readonly commandName = 'BlockWorksCouncilAction';

  constructor(
    private readonly repo: WorksCouncilConsultationRepository,
    private readonly fsm: FsmFramework,
    private readonly eventsPublisher: GlobalHrEventsPublisher,
  ) {}

  async handle(command: HrCommandEnvelope<unknown>): Promise<CommandResult<unknown>> {
    const payload = command.payload as WorksCouncilConsultationPayload;
    const consultation = await this.repo.findById(payload.consultationId);
    if (!consultation) throw new Error('Works council consultation not found');
    if (consultation.status === 'BLOCKED') {
      // Idempotent retry — see InitiateWorksCouncilConsultationHandler for rationale.
      return worksCouncilConsultationResult(command, this.fsm, consultation);
    }
    consultation.block(command.correlationId, payload.blockingUntil);
    await this.repo.save(consultation);
    await this.eventsPublisher.publishUncommitted(consultation, command.tenantId, command.correlationId);
    return worksCouncilConsultationResult(command, this.fsm, consultation);
  }
}
