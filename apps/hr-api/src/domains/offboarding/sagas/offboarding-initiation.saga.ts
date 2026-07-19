/**
 * Offboarding Initiation Saga
 *
 * Subscribes to hr.core.v1 (HR_CORE) exactly like the IAM deprovisioning
 * listener (see apps/hr-api/src/integrations/consumers/iam-event.consumer.ts)
 * so that offboarding plan creation and IAM deprovisioning are both visible,
 * independently tracked side effects of the same WorkerTerminated event
 * rather than duplicated termination logic bolted onto TerminateWorkerHandler.
 *
 * Trigger events:
 * - WorkerTerminated -> auto-create an OffboardingPlan (DRAFT) with a
 *   reason-appropriate starter task template, then start it.
 *
 * Consumer group: offboarding-initiation-saga
 */

import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Uuid } from '@hcm/shared-kernel';
import { HR_CORE, WORKER_TERMINATED } from '@hcm/event-schemas';
import type { HrEventEnvelope } from '@hcm/event-schemas';
import { createCommand } from '@hcm/command-contracts';
import { CommandBus } from '../../../platform/command-bus/command-bus.js';
import { EventBus } from '../../../platform/event-bus/event-bus.js';
import { InboxConsumer } from '../../../platform/outbox-inbox/inbox-consumer.js';
import { OffboardingPlanRepository } from '../repositories/offboarding-plan.repository.js';
import { OffboardingTemplateService } from '../services/offboarding-template.service.js';
import type { OffboardingReasonCategory } from '../aggregates/offboarding-plan.aggregate.js';

/**
 * Reserved system actor used to attribute commands the saga dispatches on
 * behalf of the platform (no human actor initiated this specific write —
 * the WorkerTerminated event did). Mirrors the SCHEDULER_SYSTEM_ACTOR_ID
 * convention used by the scheduler domain.
 */
export const OFFBOARDING_SYSTEM_ACTOR_ID = new Uuid('00000000-0000-4000-8000-0000000000b1');

const REASON_KEYWORD_CATEGORIES: Array<{ pattern: RegExp; category: OffboardingReasonCategory }> = [
  { pattern: /resign/i, category: 'RESIGNATION' },
  { pattern: /retire/i, category: 'RETIREMENT' },
  { pattern: /layoff|lay-off|redundan|reduction in force|\brif\b/i, category: 'LAYOFF_REDUNDANCY' },
  { pattern: /contract (end|expir)|end of contract|fixed[- ]term/i, category: 'END_OF_CONTRACT' },
  { pattern: /mutual/i, category: 'MUTUAL_AGREEMENT' },
];

@Injectable()
export class OffboardingInitiationSaga implements OnModuleInit {
  private readonly logger = new Logger(OffboardingInitiationSaga.name);
  private readonly consumerName = 'offboarding-initiation-saga';
  private readonly consumerVersion = '1';

  constructor(
    private readonly eventBus: EventBus,
    private readonly inboxConsumer: InboxConsumer,
    private readonly commandBus: CommandBus,
    private readonly planRepo: OffboardingPlanRepository,
    private readonly templates: OffboardingTemplateService,
  ) {}

  onModuleInit(): void {
    this.inboxConsumer.registerReplayHandler(this.consumerName, this.consumerVersion, {
      handle: async (event) => this.handle(event),
    });
    this.eventBus.subscribe(HR_CORE, this.consumerName, {
      consumerGroup: this.consumerName,
      handle: async (event: HrEventEnvelope<unknown>) => {
        await this.inboxConsumer.consume(event, this.consumerName, this.consumerVersion, {
          handle: async () => this.handle(event),
        });
      },
    });
  }

  private async handle(event: HrEventEnvelope<unknown>): Promise<void> {
    if (event.eventName !== WORKER_TERMINATED) {
      this.logger.debug({ type: 'CONSUMER_EVENT_IGNORED', eventName: event.eventName });
      return;
    }

    // aggregateId is authoritative: TerminateWorkerHandler always sets it to
    // the terminated worker's id, regardless of which fields made it onto
    // the outbox payload for this particular event schema version.
    const workerId = event.aggregateId;
    const payload = isRecord(event.payload) ? event.payload : {};

    const existingPlan = await this.planRepo.findByWorker(workerId);
    if (existingPlan && existingPlan.status !== 'CANCELLED') {
      this.logger.log({
        type: 'OFFBOARDING_PLAN_ALREADY_EXISTS',
        workerId: workerId.value,
        planId: existingPlan.id.value,
        status: existingPlan.status,
      });
      return;
    }

    const lastWorkingDay = dateValue(payload.effectiveDate) ?? dateValue(payload.terminationDate) ?? event.occurredAt ?? new Date();
    const initiatedBy = uuidValue(payload.terminatedBy) ?? OFFBOARDING_SYSTEM_ACTOR_ID;
    const reasonText = stringValue(payload.reason);
    const reasonCategory = categorizeReason(reasonText);
    const template = this.templates.getTemplateForReason(reasonCategory);

    const planId = Uuid.generate();
    await this.dispatchCommand(event.tenantId, event.metadata.correlationId, 'CreateOffboardingPlan', 'OffboardingPlan', {
      planId,
      workerId,
      lastWorkingDay,
      initiatedBy,
      reasonCategory,
      reasonNotes: reasonText,
    });

    const taskPayloads = this.templates.materializeTasks(template, planId.value, lastWorkingDay, {
      workerId: workerId.value,
    });
    for (const taskPayload of taskPayloads) {
      await this.dispatchCommand(event.tenantId, event.metadata.correlationId, 'CreateOffboardingTask', 'OffboardingTask', taskPayload);
    }

    await this.dispatchCommand(event.tenantId, event.metadata.correlationId, 'StartOffboarding', 'OffboardingPlan', { planId }, planId);

    this.logger.log({
      type: 'OFFBOARDING_PLAN_INITIATED',
      workerId: workerId.value,
      planId: planId.value,
      templateCode: template.code,
      reasonCategory,
      taskCount: taskPayloads.length,
    });
  }

  private async dispatchCommand(
    tenantId: Uuid,
    correlationId: Uuid,
    commandName: string,
    aggregateType: string,
    payload: unknown,
    aggregateId?: Uuid,
  ): Promise<void> {
    const command = createCommand(
      commandName,
      tenantId,
      {
        actorType: 'SYSTEM',
        actorId: OFFBOARDING_SYSTEM_ACTOR_ID,
        roles: ['SYSTEM_ACTOR'],
        permissions: ['ADMIN_SYSTEM'],
        mfaAuthenticated: true,
      },
      payload,
      {
        aggregateType,
        aggregateId,
        idempotencyKey: crypto.randomUUID(),
        correlationId,
        reason: `OffboardingInitiationSaga: ${commandName}`,
      },
    );

    const outcome = await this.commandBus.execute(command);
    if (!outcome.success) {
      throw new Error(`Command ${commandName} failed: ${(outcome as { errorMessage: string }).errorMessage}`);
    }
  }
}

function categorizeReason(reasonText: string | undefined): OffboardingReasonCategory {
  if (!reasonText) return 'OTHER';
  const match = REASON_KEYWORD_CATEGORIES.find((candidate) => candidate.pattern.test(reasonText));
  return match?.category ?? 'OTHER';
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function stringValue(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : undefined;
}

function dateValue(value: unknown): Date | undefined {
  const text = stringValue(value);
  if (!text) return undefined;
  const parsed = new Date(text);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed;
}

function uuidValue(value: unknown): Uuid | undefined {
  if (value instanceof Uuid) return value;
  if (typeof value === 'string' && Uuid.isValid(value)) return new Uuid(value);
  if (isRecord(value) && typeof value.value === 'string' && Uuid.isValid(value.value)) {
    return new Uuid(value.value);
  }
  return undefined;
}
