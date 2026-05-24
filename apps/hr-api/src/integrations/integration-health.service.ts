/**
 * IntegrationHealthService tracks per-adapter health, metrics, and failure
 * statistics.  It is used by the orchestrator and exposed via the REST API.
 *
 * All state is held in-memory; in a production deployment this can be backed
 * by Redis or a time-series database without changing the interface.
 */

import { Injectable, Logger } from '@nestjs/common';
import type {
  IntegrationAdapter,
  IntegrationHealth,
  IntegrationMetrics,
  IntegrationStatus,
} from './types.js';

interface CallRecord {
  timestamp: Date;
  latencyMs: number;
  success: boolean;
}

@Injectable()
export class IntegrationHealthService {
  private readonly logger = new Logger(IntegrationHealthService.name);
  private readonly statuses = new Map<string, IntegrationStatus>();
  private readonly callHistory = new Map<string, CallRecord[]>();
  private readonly maxHistory = 1000;

  /** Register a new adapter so metrics collection can begin. */
  register(adapter: IntegrationAdapter): void {
    if (!this.statuses.has(adapter.name)) {
      this.statuses.set(adapter.name, {
        adapterName: adapter.name,
        direction: adapter.direction,
        state: 'UNKNOWN',
        consecutiveFailures: 0,
        totalSuccesses: 0,
        totalFailures: 0,
      });
      this.callHistory.set(adapter.name, []);
    }
  }

  /** Run a health probe against every registered adapter. */
  async checkAll(adapters: IntegrationAdapter[]): Promise<IntegrationHealth[]> {
    const results: IntegrationHealth[] = [];
    for (const adapter of adapters) {
      results.push(await this.check(adapter));
    }
    return results;
  }

  /** Run a health probe for a single adapter by name. */
  async check(adapter: IntegrationAdapter): Promise<IntegrationHealth> {
    const start = Date.now();
    let healthy = false;
    let errorMessage: string | undefined;

    try {
      healthy = await adapter.healthCheck();
    } catch (err) {
      errorMessage = err instanceof Error ? err.message : String(err);
      this.logger.warn({ type: 'ADAPTER_HEALTH_CHECK_FAILED', adapter: adapter.name, error: errorMessage });
    }

    const latencyMs = Date.now() - start;
    const status = this.statuses.get(adapter.name);

    if (status) {
      status.lastSuccessAt = healthy ? new Date() : status.lastSuccessAt;
      status.lastFailureAt = !healthy ? new Date() : status.lastFailureAt;
      status.state = healthy
        ? status.consecutiveFailures > 0
          ? 'DEGRADED'
          : 'HEALTHY'
        : 'UNHEALTHY';
    }

    return {
      adapterName: adapter.name,
      direction: adapter.direction,
      healthy,
      lastCheckedAt: new Date(),
      latencyMs,
      errorMessage,
    };
  }

  /** Record a successful adapter invocation. */
  recordSuccess(adapterName: string, latencyMs: number): void {
    const status = this.statuses.get(adapterName);
    if (status) {
      status.totalSuccesses += 1;
      status.consecutiveFailures = 0;
      status.lastSuccessAt = new Date();
    }
    this.pushRecord(adapterName, { timestamp: new Date(), latencyMs, success: true });
  }

  /** Record a failed adapter invocation. */
  recordFailure(adapterName: string, error: Error): void {
    const status = this.statuses.get(adapterName);
    if (status) {
      status.totalFailures += 1;
      status.consecutiveFailures += 1;
      status.lastFailureAt = new Date();
      if (status.consecutiveFailures >= 5) {
        status.state = 'UNHEALTHY';
      } else if (status.consecutiveFailures >= 2) {
        status.state = 'DEGRADED';
      }
    }
    this.pushRecord(adapterName, { timestamp: new Date(), latencyMs: 0, success: false });
    this.logger.error({ type: 'ADAPTER_FAILURE', adapter: adapterName, error: error.message });
  }

  /** Retrieve computed metrics for an adapter. */
  getMetrics(adapterName: string): IntegrationMetrics {
    const history = this.callHistory.get(adapterName) ?? [];
    const totalCalls = history.length;
    const successfulCalls = history.filter((r) => r.success).length;
    const failedCalls = totalCalls - successfulCalls;
    const latencies = history.filter((r) => r.success).map((r) => r.latencyMs);

    const averageLatencyMs = latencies.length
      ? latencies.reduce((a, b) => a + b, 0) / latencies.length
      : 0;

    const sorted = [...latencies].sort((a, b) => a - b);
    const p95LatencyMs = sorted.length ? sorted[Math.floor(sorted.length * 0.95)] ?? sorted[sorted.length - 1] : undefined;
    const p99LatencyMs = sorted.length ? sorted[Math.floor(sorted.length * 0.99)] ?? sorted[sorted.length - 1] : undefined;

    return {
      adapterName,
      totalCalls,
      successfulCalls,
      failedCalls,
      averageLatencyMs,
      lastCallAt: history[history.length - 1]?.timestamp,
      p95LatencyMs,
      p99LatencyMs,
    };
  }

  /** Get the current status for every registered adapter. */
  getAllStatuses(): IntegrationStatus[] {
    return Array.from(this.statuses.values());
  }

  /** Get the current status for a single adapter. */
  getStatus(adapterName: string): IntegrationStatus | undefined {
    return this.statuses.get(adapterName);
  }

  private pushRecord(adapterName: string, record: CallRecord): void {
    const history = this.callHistory.get(adapterName) ?? [];
    history.push(record);
    if (history.length > this.maxHistory) {
      history.shift();
    }
    this.callHistory.set(adapterName, history);
  }
}
