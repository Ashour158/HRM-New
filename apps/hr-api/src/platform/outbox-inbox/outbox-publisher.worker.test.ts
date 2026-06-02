import { describe, expect, it, vi } from 'vitest';
import { OutboxPublisherWorker } from './outbox-publisher.worker.js';

describe('OutboxPublisherWorker', () => {
  it('starts and stops the outbox publisher once across repeated lifecycle calls', () => {
    const publisher = {
      startPolling: vi.fn(),
      stopPolling: vi.fn(),
    };
    const worker = new OutboxPublisherWorker(publisher);

    worker.onApplicationBootstrap();
    worker.onApplicationBootstrap();
    worker.onModuleDestroy();
    worker.onModuleDestroy();

    expect(publisher.startPolling).toHaveBeenCalledTimes(1);
    expect(publisher.stopPolling).toHaveBeenCalledTimes(1);
  });
});
