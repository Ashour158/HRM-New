/**
 * IntegrationOrchestrator is the central registry for all external adapters.
 *
 * On module init every adapter self-registers.  The orchestrator exposes
 * health checks, status queries, and a unified `send` / `receive` facade.
 *
 * Architecture rule: no adapter may directly mutate another domain's tables.
 * All cross-domain communication goes through command ports and event
 * consumption.
 */

import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import type {
  IntegrationAdapter,
  IntegrationHealth,
  IntegrationProviderReadiness,
  IntegrationResult,
  IntegrationRetryPolicy,
  IntegrationStatus,
} from './types.js';
import { IntegrationHealthService } from './integration-health.service.js';
import { isRetryableIntegrationResult } from './http-transport.js';

export interface IntegrationDeadLetterEntry {
  adapterName: string;
  payload: unknown;
  attempt: number;
  error: string;
  createdAt: Date;
}

type IntegrationSendError = Error & { retryable?: boolean; recorded?: boolean };

@Injectable()
export class IntegrationOrchestrator implements OnModuleInit {
  private readonly logger = new Logger(IntegrationOrchestrator.name);
  private readonly adapters = new Map<string, IntegrationAdapter>();
  // No integration DLQ table exists today; keep a process-local operator view without inventing schema.
  private readonly deadLetters: IntegrationDeadLetterEntry[] = [];

  constructor(
    private readonly healthService: IntegrationHealthService,
  ) {}

  onModuleInit(): void {
    this.logger.log({
      type: 'ORCHESTRATOR_INIT',
      registeredAdapters: this.getAdapterNames(),
    });
  }

  /** Register an adapter instance.  Idempotent – safe to call twice. */
  registerAdapter(adapter: IntegrationAdapter): void {
    if (this.adapters.has(adapter.name)) {
      this.logger.warn({ type: 'ADAPTER_ALREADY_REGISTERED', name: adapter.name });
      return;
    }
    this.adapters.set(adapter.name, adapter);
    this.healthService.register(adapter);
    this.logger.log({ type: 'ADAPTER_REGISTERED', name: adapter.name, direction: adapter.direction });
  }

  /** Retrieve a registered adapter by name. */
  getAdapter(name: string): IntegrationAdapter | undefined {
    return this.adapters.get(name);
  }

  /** List all registered adapter names. */
  getAdapterNames(): string[] {
    return Array.from(this.adapters.keys());
  }

  /** Run health checks against every registered adapter. */
  async healthCheck(): Promise<IntegrationHealth[]> {
    return this.healthService.checkAll(Array.from(this.adapters.values()));
  }

  /** Get cached operational status for every adapter. */
  getIntegrationStatus(): IntegrationStatus[] {
    return this.healthService.getAllStatuses();
  }

  getProviderReadiness(): IntegrationProviderReadiness[] {
    return this.healthService.getAllReadiness();
  }

  getAdapterReadiness(adapterName: string): IntegrationProviderReadiness | undefined {
    return this.healthService.getReadiness(adapterName);
  }

  getDeadLetters(): IntegrationDeadLetterEntry[] {
    return [...this.deadLetters];
  }

  /** Unified outbound send – delegates to the named adapter. */
  async send(adapterName: string, payload: unknown): Promise<IntegrationResult> {
    const adapter = this.adapters.get(adapterName);
    if (!adapter) {
      throw new Error(`Adapter '${adapterName}' is not registered.`);
    }
    this.logger.log({ type: 'INTEGRATION_SEND_ATTEMPT', adapterName });
    if (!this.healthService.hasConfiguredCredentials(adapterName)) {
      this.logger.warn({ type: 'INTEGRATION_SEND_BLOCKED', adapterName, reason: 'CREDENTIALS_NOT_CONFIGURED' });
      throw new Error(`Adapter '${adapterName}' credentials are not configured.`);
    }
    const retryPolicy = adapter.readiness.retryPolicy;
    const maxAttempts = Math.max(1, retryPolicy.maxAttempts);
    let lastError: IntegrationSendError | undefined;

    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      const start = Date.now();
      try {
        const result = await adapter.send(payload);
        if (result.success) {
          this.healthService.recordSuccess(adapterName, Date.now() - start);
          this.logger.log({ type: 'INTEGRATION_SEND_SUCCESS', adapterName, operationId: result.operationId, attempt });
          return result;
        }

        lastError = new Error(result.error ?? `Adapter '${adapterName}' returned an unsuccessful result.`) as IntegrationSendError;
        (lastError as IntegrationSendError).retryable = isRetryableIntegrationResult(result);
        (lastError as IntegrationSendError).recorded = true;
        this.healthService.recordFailure(adapterName, lastError);
        this.logger.warn({ type: 'INTEGRATION_SEND_RETRYABLE_RESULT', adapterName, attempt, error: lastError.message });
        if (!(lastError as IntegrationSendError).retryable) {
          throw lastError;
        }
      } catch (err) {
        lastError = (err instanceof Error ? err : new Error(String(err))) as IntegrationSendError;
        if (!lastError.recorded) {
          this.healthService.recordFailure(adapterName, lastError);
        }
        this.logger.error({ type: 'INTEGRATION_SEND_FAILURE', adapterName, attempt, error: lastError.message });
        if (lastError.retryable === false) {
          throw lastError;
        }
        if (attempt >= maxAttempts) {
          this.deadLetter(adapterName, payload, attempt, lastError);
          throw lastError;
        }
      }

      if (attempt >= maxAttempts) {
        const error = lastError ?? new Error(`Adapter '${adapterName}' failed.`);
        this.deadLetter(adapterName, payload, attempt, error);
        throw error;
      }

      // Back off before the next retry per the adapter's retry policy so a failing
      // or rate-limited (429) provider is not hammered with immediate retries.
      const delayMs = this.backoffDelayMs(retryPolicy, attempt);
      if (delayMs > 0) await this.sleep(delayMs);
    }

    throw lastError ?? new Error(`Adapter '${adapterName}' failed.`);
  }

  private backoffDelayMs(retryPolicy: IntegrationRetryPolicy, attempt: number): number {
    const base = retryPolicy.backoff === 'EXPONENTIAL'
      ? retryPolicy.initialDelayMs * 2 ** (attempt - 1)
      : retryPolicy.initialDelayMs * attempt;
    return Math.min(base, retryPolicy.maxDelayMs);
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /** Unified inbound receive – delegates to the named adapter. */
  async receive(adapterName: string): Promise<unknown> {
    const adapter = this.adapters.get(adapterName);
    if (!adapter) {
      throw new Error(`Adapter '${adapterName}' is not registered.`);
    }
    return adapter.receive();
  }

  private deadLetter(adapterName: string, payload: unknown, attempt: number, error: Error): void {
    this.deadLetters.push({
      adapterName,
      payload,
      attempt,
      error: error.message,
      createdAt: new Date(),
    });
    this.logger.error({ type: 'INTEGRATION_SEND_DEAD_LETTERED', adapterName, attempt, error: error.message });
  }
}
