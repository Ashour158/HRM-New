import { describe, expect, it, vi } from 'vitest';
import { Uuid } from '@hcm/shared-kernel';
import type { EventBus } from '../event-bus/event-bus.js';
import { ReminderEmitter } from './reminder-emitter.js';
import type { ReminderDispatchLogRepositoryPort } from './reminder-dispatch-log.repository.js';

const tenantId = new Uuid('00000000-0000-4000-8000-000000000111');
const workerId = new Uuid('00000000-0000-4000-8000-000000000222');
const managerId = new Uuid('00000000-0000-4000-8000-000000000333');
const subjectId = new Uuid('00000000-0000-4000-8000-000000000444');

describe('ReminderEmitter', () => {
  it('deduplicates reminders within the configured window', async () => {
    const repository = new FakeReminderDispatchLogRepository();
    const eventBus = { publish: vi.fn(async () => undefined) } as unknown as EventBus;
    const emitter = new ReminderEmitter(eventBus, repository, { dedupeWindowMs: 60 * 60 * 1000 });
    const now = new Date('2026-06-13T08:00:00.000Z');

    const first = await emitter.emit({
      tenantId,
      audienceWorkerIds: [workerId],
      reminderType: 'POLICY_REVIEW',
      subject: { aggregateType: 'PolicyDocument', subjectId, subjectWorkerId: workerId },
      dueDate: new Date('2026-06-20T00:00:00.000Z'),
      payload: { title: 'Policy review due' },
      escalationTier: { code: 'T_MINUS_7', label: 'Seven days before due date', level: 0 },
      now,
    });
    const duplicate = await emitter.emit({
      tenantId,
      audienceWorkerIds: [workerId],
      reminderType: 'POLICY_REVIEW',
      subject: { aggregateType: 'PolicyDocument', subjectId, subjectWorkerId: workerId },
      dueDate: new Date('2026-06-20T00:00:00.000Z'),
      payload: { title: 'Policy review due' },
      escalationTier: { code: 'T_MINUS_7', label: 'Seven days before due date', level: 0 },
      now: new Date('2026-06-13T08:30:00.000Z'),
    });

    expect(first.status).toBe('PUBLISHED');
    expect(duplicate.status).toBe('DEDUPED');
    expect(eventBus.publish).toHaveBeenCalledTimes(1);
    expect(eventBus.publish).toHaveBeenCalledWith(expect.objectContaining({
      eventName: 'ReminderDue',
      aggregateType: 'PolicyDocument',
      aggregateId: subjectId,
      tenantId,
      payload: expect.objectContaining({
        reminderType: 'POLICY_REVIEW',
        audienceWorkerIds: [workerId.value],
        escalationTier: 'T_MINUS_7',
        dueDateBucket: '2026-06-20',
      }),
      metadata: expect.objectContaining({ clientType: 'SYSTEM_SCHEDULER' }),
    }));
  });

  it('treats escalation tiers as distinct reminder dispatches', async () => {
    const repository = new FakeReminderDispatchLogRepository();
    const eventBus = { publish: vi.fn(async () => undefined) } as unknown as EventBus;
    const emitter = new ReminderEmitter(eventBus, repository, { dedupeWindowMs: 7 * 24 * 60 * 60 * 1000 });

    await emitter.emit({
      tenantId,
      audienceWorkerIds: [workerId],
      managerAudienceWorkerIds: [managerId],
      reminderType: 'PERFORMANCE_REVIEW',
      subject: { aggregateType: 'PerformanceReview', subjectId, subjectWorkerId: workerId },
      dueDate: new Date('2026-06-20T00:00:00.000Z'),
      escalationTier: { code: 'T_ZERO', label: 'Due today', level: 1 },
      payload: {},
      now: new Date('2026-06-20T08:00:00.000Z'),
    });
    await emitter.emit({
      tenantId,
      audienceWorkerIds: [workerId],
      managerAudienceWorkerIds: [managerId],
      reminderType: 'PERFORMANCE_REVIEW',
      subject: { aggregateType: 'PerformanceReview', subjectId, subjectWorkerId: workerId },
      dueDate: new Date('2026-06-20T00:00:00.000Z'),
      escalationTier: { code: 'T_PLUS_3', label: 'Three days overdue', level: 2, escalateToManager: true },
      payload: {},
      now: new Date('2026-06-23T08:00:00.000Z'),
    });

    expect(eventBus.publish).toHaveBeenCalledTimes(2);
    expect((eventBus.publish as ReturnType<typeof vi.fn>).mock.calls[1]?.[0]).toEqual(expect.objectContaining({
      payload: expect.objectContaining({
        escalationTier: 'T_PLUS_3',
        escalationLevel: 2,
        escalateToManager: true,
        managerAudienceWorkerIds: [managerId.value],
      }),
    }));
  });
});

class FakeReminderDispatchLogRepository implements ReminderDispatchLogRepositoryPort {
  private readonly activeKeys = new Map<string, Date>();

  async tryRecordDispatch(input: Parameters<ReminderDispatchLogRepositoryPort['tryRecordDispatch']>[0]) {
    const existingExpiry = this.activeKeys.get(input.dispatchKey);
    if (existingExpiry && existingExpiry > input.now) {
      return { recorded: false as const, dispatchKey: input.dispatchKey };
    }
    this.activeKeys.set(input.dispatchKey, new Date(input.now.getTime() + input.dedupeWindowMs));
    return { recorded: true as const, dispatchKey: input.dispatchKey };
  }
}
