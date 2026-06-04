import { afterEach, describe, expect, it, vi } from 'vitest';
import { InboxRecoveryWorker } from './inbox-recovery.worker.js';
import type { InboxConsumer } from './inbox-consumer.js';

describe('InboxRecoveryWorker', () => {
  afterEach(() => {
    vi.useRealTimers();
    delete process.env.INBOX_RETRYABLE_REPLAY_INTERVAL_MS;
  });

  it('runs stale in-progress recovery once on application bootstrap', async () => {
    const consumer = {
      recoverStaleInProgressEvents: vi.fn().mockResolvedValue({ retryable: 2, skipped: 1 }),
      replayDueRetryableEvents: vi.fn().mockResolvedValue(2),
    } as unknown as InboxConsumer;
    const worker = new InboxRecoveryWorker(consumer);

    await worker.onApplicationBootstrap();
    await worker.onApplicationBootstrap();

    expect(consumer.recoverStaleInProgressEvents).toHaveBeenCalledTimes(1);
    expect(consumer.recoverStaleInProgressEvents).toHaveBeenCalledWith(expect.any(Date));
    expect(consumer.replayDueRetryableEvents).toHaveBeenCalledTimes(1);
    expect(consumer.replayDueRetryableEvents).toHaveBeenCalledWith(expect.any(Date));
  });

  it('continues replaying due retryable events on an interval', async () => {
    vi.useFakeTimers();
    process.env.INBOX_RETRYABLE_REPLAY_INTERVAL_MS = '1000';
    const consumer = {
      recoverStaleInProgressEvents: vi.fn().mockResolvedValue({ retryable: 0, skipped: 0 }),
      replayDueRetryableEvents: vi.fn().mockResolvedValue(0),
    } as unknown as InboxConsumer;
    const worker = new InboxRecoveryWorker(consumer);

    await worker.onApplicationBootstrap();
    await vi.advanceTimersByTimeAsync(1000);
    await vi.advanceTimersByTimeAsync(1000);
    worker.onModuleDestroy();
    await vi.advanceTimersByTimeAsync(1000);

    expect(consumer.replayDueRetryableEvents).toHaveBeenCalledTimes(3);
  });
});
