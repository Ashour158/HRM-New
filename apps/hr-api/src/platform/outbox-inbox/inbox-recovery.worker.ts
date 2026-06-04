import { Injectable, Logger, OnApplicationBootstrap, OnModuleDestroy } from '@nestjs/common';
import { InboxConsumer } from './inbox-consumer.js';

const DEFAULT_STALE_INBOX_MINUTES = 15;
const DEFAULT_REPLAY_INTERVAL_MS = 30_000;

@Injectable()
export class InboxRecoveryWorker implements OnApplicationBootstrap, OnModuleDestroy {
  private readonly logger = new Logger(InboxRecoveryWorker.name);
  private started = false;
  private replayInterval: ReturnType<typeof setInterval> | null = null;
  private replayInProgress = false;

  constructor(private readonly consumer: InboxConsumer) {}

  async onApplicationBootstrap(): Promise<void> {
    if (this.started) return;
    this.started = true;

    const minutes = Number(process.env.INBOX_STALE_IN_PROGRESS_RECOVERY_MINUTES ?? DEFAULT_STALE_INBOX_MINUTES);
    const cutoffMinutes = Number.isFinite(minutes) && minutes > 0 ? minutes : DEFAULT_STALE_INBOX_MINUTES;
    const olderThan = new Date(Date.now() - cutoffMinutes * 60_000);
    const recovered = await this.consumer.recoverStaleInProgressEvents(olderThan);
    const replayed = await this.consumer.replayDueRetryableEvents(new Date());

    if (recovered.retryable > 0 || recovered.skipped > 0 || replayed > 0) {
      this.logger.warn({
        type: 'INBOX_RECOVERY_COMPLETED',
        staleAfterMinutes: cutoffMinutes,
        retryable: recovered.retryable,
        skipped: recovered.skipped,
        replayed,
      });
    }
    this.startReplayPolling();
  }

  onModuleDestroy(): void {
    if (!this.replayInterval) return;
    clearInterval(this.replayInterval);
    this.replayInterval = null;
  }

  private startReplayPolling(): void {
    if (this.replayInterval) return;
    const configuredInterval = Number(process.env.INBOX_RETRYABLE_REPLAY_INTERVAL_MS ?? DEFAULT_REPLAY_INTERVAL_MS);
    const intervalMs = Number.isFinite(configuredInterval) && configuredInterval > 0
      ? configuredInterval
      : DEFAULT_REPLAY_INTERVAL_MS;
    this.replayInterval = setInterval(() => {
      void this.replayDueEvents();
    }, intervalMs);
  }

  private async replayDueEvents(): Promise<void> {
    if (this.replayInProgress) return;
    this.replayInProgress = true;
    try {
      await this.consumer.replayDueRetryableEvents(new Date());
    } catch (err) {
      this.logger.error({
        type: 'INBOX_RETRYABLE_REPLAY_POLL_FAILED',
        error: err instanceof Error ? err.message : String(err),
      });
    } finally {
      this.replayInProgress = false;
    }
  }
}
