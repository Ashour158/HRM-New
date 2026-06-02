import { Injectable, OnApplicationBootstrap, OnModuleDestroy } from '@nestjs/common';
import { OutboxPublisher } from './outbox-publisher.js';

@Injectable()
export class OutboxPublisherWorker implements OnApplicationBootstrap, OnModuleDestroy {
  private started = false;

  constructor(private readonly publisher: OutboxPublisher) {}

  onApplicationBootstrap(): void {
    if (this.started) {
      return;
    }
    this.publisher.startPolling();
    this.started = true;
  }

  onModuleDestroy(): void {
    if (!this.started) {
      return;
    }
    this.publisher.stopPolling();
    this.started = false;
  }
}
