/**
 * Benefits Carrier Consumer
 *
 * Subscribes to hr.benefits.v1 and pushes enrollment / life-event data to the
 * external carrier via the BenefitsCarrierAdapter.
 *
 * Consumer group: carrier-integration-saga
 */

import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import type { HrEventEnvelope } from '@hcm/event-schemas';
import { Uuid } from '@hcm/shared-kernel';
import { createCommand } from '@hcm/command-contracts';
import { runWithTenant } from '@hcm/platform-core';
import { EventBus } from '../../platform/event-bus/event-bus.js';
import { InboxConsumer } from '../../platform/outbox-inbox/inbox-consumer.js';
import { CommandBus } from '../../platform/command-bus/command-bus.js';
import { ReminderEmitter } from '../../platform/scheduler/reminder-emitter.js';
import { SystemActorFactory } from '../../platform/scheduler/system-actor.factory.js';
import { BenefitsEnrollmentRepository } from '../../domains/benefits/repositories/benefits-enrollment.repository.js';
import { BenefitsCarrierAdapter } from '../adapters/benefits-carrier.adapter.js';

const BENEFITS_ENROLLMENT_EFFECTIVE = 'BenefitsEnrollmentEffective';
const BENEFITS_ENROLLMENT_FINALIZED = BENEFITS_ENROLLMENT_EFFECTIVE;
const LIFE_EVENT_PROCESSED = 'LifeEventProcessed';
const BENEFITS_ENROLLMENT_TERMINATED = 'BenefitsEnrollmentTerminated';
const SPENDING_ACCOUNT_CLOSED = 'SpendingAccountClosed';
const BENEFITS_PROGRAM_CLOSED = 'BenefitsProgramClosed';
const CARRIER_RECONCILIATION_VARIANCE_DETECTED = 'CarrierReconciliationVarianceDetected';

/** Enrollment states from which BenefitsEnrollment.terminate() is a legal transition. */
const TERMINABLE_ENROLLMENT_STATES = new Set(['APPROVED', 'EFFECTIVE']);

@Injectable()
export class BenefitsCarrierConsumer implements OnModuleInit {
  private readonly logger = new Logger(BenefitsCarrierConsumer.name);
  private readonly consumerName = 'carrier-integration-saga';
  private readonly consumerVersion = '1';

  constructor(
    private readonly eventBus: EventBus,
    private readonly inboxConsumer: InboxConsumer,
    private readonly carrierAdapter: BenefitsCarrierAdapter,
    private readonly commandBus: CommandBus,
    private readonly reminderEmitter: ReminderEmitter,
    private readonly systemActorFactory: SystemActorFactory,
    private readonly enrollmentRepo: BenefitsEnrollmentRepository,
  ) {}

  onModuleInit(): void {
    this.inboxConsumer.registerReplayHandler(this.consumerName, this.consumerVersion, {
      handle: async (event) => this.handle(event),
    });
    this.eventBus.subscribe('hr.benefits.v1', this.consumerName, {
      consumerGroup: this.consumerName,
      handle: async (event: HrEventEnvelope<unknown>) => {
        await this.inboxConsumer.consume(event, this.consumerName, this.consumerVersion, {
          handle: async () => this.handle(event),
        });
      },
    });
  }

  private async handle(event: HrEventEnvelope<unknown>): Promise<void> {
    const payload = isRecord(event.payload) ? event.payload : {};

    if (event.eventName === BENEFITS_ENROLLMENT_EFFECTIVE || event.eventName === BENEFITS_ENROLLMENT_FINALIZED) {
      const enrollmentId = requiredUuid(payload.enrollmentId, 'enrollmentId');
      const workerId = requiredUuid(payload.workerId, 'workerId');
      const programId = requiredUuid(payload.programId, 'programId');
      this.logger.log({
        type: 'CONSUMER_BENEFITS_ENROLLMENT_FINALIZED',
        enrollmentId: enrollmentId.value,
        workerId: workerId.value,
      });

      await this.carrierAdapter.sendEnrollment({
        enrollmentId,
        workerId,
        programId,
        coverageStartDate: requiredString(payload.coverageStartDate, 'coverageStartDate'),
      });
      return;
    }

    if (event.eventName === LIFE_EVENT_PROCESSED) {
      const lifeEventId = requiredUuid(payload.lifeEventId, 'lifeEventId');
      const workerId = requiredUuid(payload.workerId, 'workerId');
      this.logger.log({
        type: 'CONSUMER_LIFE_EVENT_PROCESSED',
        lifeEventId: lifeEventId.value,
        workerId: workerId.value,
      });

      await this.carrierAdapter.sendLifeEventUpdate({
        lifeEventId,
        workerId,
        eventType: stringValue(payload.eventType) ?? stringValue(payload.lifeEventType) ?? missingString('eventType'),
        effectiveDate: requiredString(payload.effectiveDate, 'effectiveDate'),
      });
      return;
    }

    if (event.eventName === BENEFITS_ENROLLMENT_TERMINATED) {
      const enrollmentId = requiredUuid(payload.enrollmentId, 'enrollmentId');
      this.logger.log({ type: 'CONSUMER_BENEFITS_ENROLLMENT_TERMINATED', enrollmentId: enrollmentId.value });

      await this.carrierAdapter.sendTermination(enrollmentId);
      return;
    }

    if (event.eventName === SPENDING_ACCOUNT_CLOSED) {
      const accountId = requiredUuid(payload.accountId, 'accountId');
      const workerId = requiredUuid(payload.workerId, 'workerId');
      const accountType = requiredString(payload.accountType, 'accountType');
      this.logger.log({ type: 'CONSUMER_SPENDING_ACCOUNT_CLOSED', accountId: accountId.value, workerId: workerId.value });

      // Carrier-side stop. The recurring FSA/HSA payroll deduction is a
      // separate, payroll-saga-owned concern that does not exist yet in this
      // codebase and is intentionally not built here (tracked as a follow-up).
      await this.carrierAdapter.sendSpendingAccountClosure({ accountId, workerId, accountType });
      return;
    }

    if (event.eventName === BENEFITS_PROGRAM_CLOSED) {
      const programId = requiredUuid(payload.programId, 'programId');
      this.logger.log({ type: 'CONSUMER_BENEFITS_PROGRAM_CLOSED', programId: programId.value });

      await this.terminateEnrollmentsForClosedProgram(event, programId);
      return;
    }

    if (event.eventName === CARRIER_RECONCILIATION_VARIANCE_DETECTED) {
      const runId = requiredUuid(payload.runId, 'runId');
      const varianceAmount = requiredNumber(payload.varianceAmount, 'varianceAmount');
      this.logger.log({ type: 'CONSUMER_CARRIER_RECONCILIATION_VARIANCE_DETECTED', runId: runId.value, varianceAmount });

      await this.escalateReconciliationVariance(event, runId, varianceAmount);
      return;
    }

    this.logger.debug({ type: 'CONSUMER_EVENT_IGNORED', eventName: event.eventName });
  }

  /**
   * BenefitsProgramClosed: auto-terminate any enrollment still tied to the
   * closed program via the canonical TerminateBenefitsEnrollment command
   * (never mutate the enrollment directly).
   */
  private async terminateEnrollmentsForClosedProgram(event: HrEventEnvelope<unknown>, programId: Uuid): Promise<void> {
    await runWithTenant(event.tenantId, async () => {
      const enrollments = await this.enrollmentRepo.findByProgram(programId);
      const actor = this.systemActorFactory.createForJob('benefits-carrier-consumer', ['benefits:write']);

      for (const enrollment of enrollments) {
        if (!TERMINABLE_ENROLLMENT_STATES.has(enrollment.status)) continue;

        const command = createCommand(
          'TerminateBenefitsEnrollment',
          event.tenantId,
          actor,
          {
            enrollmentId: enrollment.id,
            reason: `BenefitsProgram ${programId.value} closed`,
          },
          {
            subjectWorkerId: enrollment.workerId,
            aggregateType: 'BenefitsEnrollment',
            aggregateId: enrollment.id,
            idempotencyKey: `benefits-program-closed:${programId.value}:${enrollment.id.value}`,
            correlationId: event.metadata.correlationId,
            reason: `BenefitsCarrierConsumer: auto-terminate on BenefitsProgramClosed (${programId.value})`,
            metadata: { clientType: 'SYSTEM' },
          },
        );

        const outcome = await this.commandBus.execute(command);
        if (!outcome.success) {
          this.logger.error({
            type: 'CONSUMER_PROGRAM_CLOSED_TERMINATION_FAILED',
            programId: programId.value,
            enrollmentId: enrollment.id.value,
            errorMessage: (outcome as { errorMessage: string }).errorMessage,
          });
        }
      }
    });
  }

  /**
   * CarrierReconciliationVarianceDetected: route to the existing reminder /
   * escalation mechanism rather than inventing a new notification channel.
   */
  private async escalateReconciliationVariance(event: HrEventEnvelope<unknown>, runId: Uuid, varianceAmount: number): Promise<void> {
    await this.reminderEmitter.emit({
      tenantId: event.tenantId,
      audienceWorkerIds: [],
      reminderType: 'CARRIER_RECONCILIATION_VARIANCE',
      subject: { aggregateType: 'CarrierReconciliationRun', subjectId: runId },
      dueDate: event.occurredAt ?? new Date(),
      payload: { runId: runId.value, varianceAmount },
      escalationTier: { code: 'CARRIER_VARIANCE', label: 'Carrier reconciliation variance detected', level: 1 },
    });
  }
}

function requiredUuid(value: unknown, field: string): Uuid {
  const uuid = uuidValue(value);
  if (!uuid) throw new Error(`Benefits carrier event payload is missing ${field}`);
  return uuid;
}

function requiredString(value: unknown, field: string): string {
  return stringValue(value) ?? missingString(field);
}

function requiredNumber(value: unknown, field: string): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  throw new Error(`Benefits carrier event payload is missing ${field}`);
}

function missingString(field: string): never {
  throw new Error(`Benefits carrier event payload is missing ${field}`);
}

function uuidValue(value: unknown): Uuid | undefined {
  if (value instanceof Uuid) return value;
  if (typeof value === 'string' && Uuid.isValid(value)) return new Uuid(value);
  if (isRecord(value) && typeof value.value === 'string' && Uuid.isValid(value.value)) {
    return new Uuid(value.value);
  }
  return undefined;
}

function stringValue(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
