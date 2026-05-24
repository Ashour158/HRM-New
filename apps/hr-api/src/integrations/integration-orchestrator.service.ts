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
  IntegrationResult,
  IntegrationStatus,
} from './types.js';
import { IntegrationHealthService } from './integration-health.service.js';

@Injectable()
export class IntegrationOrchestrator implements OnModuleInit {
  private readonly logger = new Logger(IntegrationOrchestrator.name);
  private readonly adapters = new Map<string, IntegrationAdapter>();

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

  /** Unified outbound send – delegates to the named adapter. */
  async send(adapterName: string, payload: unknown): Promise<IntegrationResult> {
    const adapter = this.adapters.get(adapterName);
    if (!adapter) {
      throw new Error(`Adapter '${adapterName}' is not registered.`);
    }
    const start = Date.now();
    try {
      const result = await adapter.send(payload);
      this.healthService.recordSuccess(adapterName, Date.now() - start);
      return result;
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      this.healthService.recordFailure(adapterName, error);
      throw error;
    }
  }

  /** Unified inbound receive – delegates to the named adapter. */
  async receive(adapterName: string): Promise<unknown> {
    const adapter = this.adapters.get(adapterName);
    if (!adapter) {
      throw new Error(`Adapter '${adapterName}' is not registered.`);
    }
    return adapter.receive();
  }
}
