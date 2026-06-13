import { Inject, Injectable, Optional } from '@nestjs/common';
import { computeRequestHash } from '@hcm/platform-core';
import { createPrivacyForEvent, type HrEventEnvelope } from '@hcm/event-schemas';
import { Uuid } from '@hcm/shared-kernel';
import { EventBus } from '../event-bus/event-bus.js';
import { ReminderDispatchLogRepository } from './reminder-dispatch-log.repository.js';
import type { ReminderDispatchLogRepositoryPort } from './reminder-dispatch-log.repository.js';

export interface ReminderEmitterConfig {
  dedupeWindowMs?: number;
}

export const REMINDER_EMITTER_CONFIG = Symbol('REMINDER_EMITTER_CONFIG');

export interface ReminderEscalationTier {
  code: string;
  label: string;
  level: number;
  escalateToManager?: boolean;
}

export interface ReminderSubject {
  aggregateType: string;
  subjectId: Uuid;
  subjectWorkerId?: Uuid;
}

export interface ReminderEmitterInput {
  tenantId: Uuid;
  audienceWorkerIds: Uuid[];
  managerAudienceWorkerIds?: Uuid[];
  reminderType: string;
  subject: ReminderSubject;
  dueDate: Date;
  payload: Record<string, unknown>;
  escalationTier?: ReminderEscalationTier;
  now?: Date;
  dedupeWindowMs?: number;
}

export interface ReminderEmitterResult {
  status: 'PUBLISHED' | 'DEDUPED';
  dispatchKey: string;
  eventId?: Uuid;
}

const DEFAULT_DEDUPE_WINDOW_MS = 24 * 60 * 60 * 1000;

@Injectable()
export class ReminderEmitter {
  constructor(
    private readonly eventBus: EventBus,
    @Optional()
    @Inject(ReminderDispatchLogRepository)
    private readonly dispatchLog: ReminderDispatchLogRepositoryPort = new ReminderDispatchLogRepository(),
    @Optional()
    @Inject(REMINDER_EMITTER_CONFIG)
    private readonly config: ReminderEmitterConfig = {},
  ) {}

  async emit(input: ReminderEmitterInput): Promise<ReminderEmitterResult> {
    const now = input.now ?? new Date();
    const dueDateBucket = dateBucket(input.dueDate);
    const escalationTierCode = input.escalationTier?.code ?? 'STANDARD';
    const dispatchKey = buildReminderDispatchKey({
      tenantId: input.tenantId,
      reminderType: input.reminderType,
      subjectId: input.subject.subjectId,
      dueDateBucket,
      escalationTier: escalationTierCode,
    });
    const audienceWorkerIds = uniqueUuids(input.audienceWorkerIds);
    const managerAudienceWorkerIds = uniqueUuids(input.managerAudienceWorkerIds ?? []);
    const recorded = await this.dispatchLog.tryRecordDispatch({
      tenantId: input.tenantId,
      dispatchKey,
      reminderType: input.reminderType,
      subjectId: input.subject.subjectId,
      subjectType: input.subject.aggregateType,
      dueDateBucket,
      escalationTier: escalationTierCode,
      audienceWorkerIds: audienceWorkerIds.map((id) => id.value),
      now,
      dedupeWindowMs: input.dedupeWindowMs ?? this.config.dedupeWindowMs ?? DEFAULT_DEDUPE_WINDOW_MS,
    });

    if (!recorded.recorded) {
      return { status: 'DEDUPED', dispatchKey };
    }

    const event = this.buildEvent({
      ...input,
      audienceWorkerIds,
      managerAudienceWorkerIds,
      dueDateBucket,
      escalationTierCode,
      now,
      dispatchKey,
    });
    await this.eventBus.publish(event);
    return { status: 'PUBLISHED', dispatchKey, eventId: event.eventId };
  }

  private buildEvent(input: ReminderEmitterInput & {
    audienceWorkerIds: Uuid[];
    managerAudienceWorkerIds: Uuid[];
    dueDateBucket: string;
    escalationTierCode: string;
    now: Date;
    dispatchKey: string;
  }): HrEventEnvelope<Record<string, unknown>> {
    const tier = input.escalationTier;
    const payload = {
      ...input.payload,
      reminderType: input.reminderType,
      subjectId: input.subject.subjectId.value,
      subjectType: input.subject.aggregateType,
      dueDate: input.dueDate.toISOString(),
      dueDateBucket: input.dueDateBucket,
      dispatchKey: input.dispatchKey,
      escalationTier: tier?.code ?? input.escalationTierCode,
      escalationLabel: tier?.label ?? 'Standard reminder',
      escalationLevel: tier?.level ?? 0,
      escalateToManager: tier?.escalateToManager === true,
      audienceWorkerIds: input.audienceWorkerIds.map((id) => id.value),
      managerAudienceWorkerIds: tier?.escalateToManager === true
        ? input.managerAudienceWorkerIds.map((id) => id.value)
        : [],
    };

    const subjectWorkerId = input.subject.subjectWorkerId ?? input.audienceWorkerIds[0];
    return {
      eventId: Uuid.generate(),
      eventName: 'ReminderDue',
      eventSchemaVersion: 1,
      tenantId: input.tenantId,
      aggregateType: input.subject.aggregateType,
      aggregateId: input.subject.subjectId,
      payload,
      metadata: {
        correlationId: Uuid.generate(),
        requestHash: computeRequestHash(payload),
        clientType: 'SYSTEM_SCHEDULER',
        hrDataSensitivity: 'LOW',
      },
      privacy: createPrivacyForEvent('LOW', subjectWorkerId?.value, 'PROFILE'),
      occurredAt: input.now,
      version: 1,
    };
  }
}

export function buildReminderDispatchKey(input: {
  tenantId: Uuid;
  reminderType: string;
  subjectId: Uuid;
  dueDateBucket: string;
  escalationTier: string;
}): string {
  return [
    input.tenantId.value,
    input.reminderType,
    input.subjectId.value,
    input.dueDateBucket,
    input.escalationTier,
  ].join(':');
}

function uniqueUuids(values: Uuid[]): Uuid[] {
  const byValue = new Map(values.map((value) => [value.value, value]));
  return Array.from(byValue.values());
}

function dateBucket(date: Date): string {
  return date.toISOString().slice(0, 10);
}
