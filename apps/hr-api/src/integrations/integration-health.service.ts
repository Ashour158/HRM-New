/**
 * IntegrationHealthService tracks per-adapter health, metrics, and failure
 * statistics.  It is used by the orchestrator and exposed via the REST API.
 *
 * All state is held in-memory; in a production deployment this can be backed
 * by Redis or a time-series database without changing the interface.
 */

import { Injectable, Logger } from '@nestjs/common';
import type {
  IntegrationCredentialState,
  IntegrationAdapter,
  IntegrationHealth,
  IntegrationOperationLog,
  IntegrationIncidentState,
  IntegrationMetrics,
  IntegrationOutboundHealth,
  IntegrationOutboundHealthState,
  IntegrationProviderReadiness,
  IntegrationReadinessMetadata,
  IntegrationStatus,
} from './types.js';

interface CallRecord {
  timestamp: Date;
  latencyMs: number;
  success: boolean;
}

type IntegrationOperationName = IntegrationOperationLog['operation'];
type IntegrationOperationStatus = IntegrationOperationLog['status'];

@Injectable()
export class IntegrationHealthService {
  private readonly logger = new Logger(IntegrationHealthService.name);
  private readonly statuses = new Map<string, IntegrationStatus>();
  private readonly readiness = new Map<string, IntegrationReadinessMetadata>();
  private readonly outboundHealth = new Map<string, IntegrationOutboundHealth>();
  private readonly callHistory = new Map<string, CallRecord[]>();
  private readonly operationLogs = new Map<string, IntegrationOperationLog[]>();
  private readonly maxHistory = 1000;

  /** Register a new adapter so metrics collection can begin. */
  register(adapter: IntegrationAdapter): void {
    this.readiness.set(adapter.name, adapter.readiness);
    if (!this.statuses.has(adapter.name)) {
      const credentialState = this.getCredentialState(adapter.name);
      this.statuses.set(adapter.name, {
        adapterName: adapter.name,
        direction: adapter.direction,
        state: credentialState === 'CONFIGURED' ? 'UNKNOWN' : 'CREDENTIALS_NOT_CONFIGURED',
        consecutiveFailures: 0,
        totalSuccesses: 0,
        totalFailures: 0,
      });
      this.callHistory.set(adapter.name, []);
      this.operationLogs.set(adapter.name, []);
      this.outboundHealth.set(adapter.name, {
        state: credentialState === 'CONFIGURED' ? 'UNKNOWN' : 'CREDENTIALS_NOT_CONFIGURED',
        consecutiveFailures: 0,
        totalFailures: 0,
      });
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
    const checkedAt = new Date();
    let healthy = false;
    let errorMessage: string | undefined;

    if (!this.hasConfiguredCredentials(adapter.name)) {
      errorMessage = `Adapter '${adapter.name}' credentials are not configured.`;
    } else {
      try {
        healthy = await adapter.healthCheck();
      } catch (err) {
        errorMessage = err instanceof Error ? err.message : String(err);
        this.logger.warn({ type: 'ADAPTER_HEALTH_CHECK_FAILED', adapter: adapter.name, error: errorMessage });
      }
    }

    const latencyMs = Date.now() - start;
    const status = this.statuses.get(adapter.name);

    if (status) {
      status.lastSuccessAt = healthy ? checkedAt : status.lastSuccessAt;
      status.lastFailureAt = !healthy ? checkedAt : status.lastFailureAt;
      if (!this.hasConfiguredCredentials(adapter.name)) {
        status.state = 'CREDENTIALS_NOT_CONFIGURED';
      } else if (this.hasActiveIncident(adapter.name)) {
        status.state = 'INCIDENT_ACTIVE';
      } else {
        status.state = healthy
          ? status.consecutiveFailures > 0
            ? 'DEGRADED'
            : 'HEALTHY'
          : 'UNHEALTHY';
      }
      this.updateOutboundHealth(adapter.name, this.toOutboundHealthState(status.state), checkedAt);
    }

    const result = {
      adapterName: adapter.name,
      direction: adapter.direction,
      healthy,
      lastCheckedAt: checkedAt,
      latencyMs,
      errorMessage,
      readiness: this.getReadiness(adapter.name),
    };
    this.recordOperation(adapter.name, {
      operation: 'HEALTH_CHECK',
      status: healthy ? 'SUCCESS' : 'FAILED',
      latencyMs,
      message: errorMessage,
      readinessReady: result.readiness?.ready,
      blockers: result.readiness?.blockers,
    });
    return result;
  }

  /** Record an operator-initiated connection test without leaking payloads or secrets. */
  recordTestResult(adapterName: string, input: {
    success: boolean;
    latencyMs?: number;
    message?: string;
    readinessReady?: boolean;
    blockers?: string[];
  }): IntegrationOperationLog {
    return this.recordOperation(adapterName, {
      operation: 'TEST_CONNECTION',
      status: input.success ? 'SUCCESS' : 'FAILED',
      latencyMs: input.latencyMs,
      message: input.message,
      readinessReady: input.readinessReady,
      blockers: input.blockers,
    });
  }

  /** Record a successful adapter invocation. */
  recordSuccess(adapterName: string, latencyMs: number): void {
    const status = this.statuses.get(adapterName);
    if (status) {
      status.totalSuccesses += 1;
      status.consecutiveFailures = 0;
      status.lastSuccessAt = new Date();
      status.state = this.hasActiveIncident(adapterName) ? 'INCIDENT_ACTIVE' : 'HEALTHY';
      this.updateOutboundHealth(adapterName, 'HEALTHY', status.lastSuccessAt);
    }
    this.pushRecord(adapterName, { timestamp: new Date(), latencyMs, success: true });
    this.recordOperation(adapterName, {
      operation: 'SEND',
      status: 'SUCCESS',
      latencyMs,
      readinessReady: this.getReadiness(adapterName)?.ready,
      blockers: this.getReadiness(adapterName)?.blockers,
    });
  }

  /** Record a failed adapter invocation. */
  recordFailure(adapterName: string, error: Error): void {
    const status = this.statuses.get(adapterName);
    if (status) {
      status.totalFailures += 1;
      status.consecutiveFailures += 1;
      status.lastFailureAt = new Date();
      if (!this.hasConfiguredCredentials(adapterName)) {
        status.state = 'CREDENTIALS_NOT_CONFIGURED';
      } else if (this.hasActiveIncident(adapterName)) {
        status.state = 'INCIDENT_ACTIVE';
      } else if (status.consecutiveFailures >= 5) {
        status.state = 'UNHEALTHY';
      } else if (status.consecutiveFailures >= 2) {
        status.state = 'DEGRADED';
      }
      this.updateOutboundHealth(adapterName, this.toOutboundHealthState(status.state), status.lastFailureAt);
    }
    this.pushRecord(adapterName, { timestamp: new Date(), latencyMs: 0, success: false });
    this.recordOperation(adapterName, {
      operation: 'SEND',
      status: 'FAILED',
      message: error.message,
      readinessReady: this.getReadiness(adapterName)?.ready,
      blockers: this.getReadiness(adapterName)?.blockers,
    });
    this.logger.error({ type: 'ADAPTER_FAILURE', adapter: adapterName, error: error.message });
  }

  /** Mark credentials as configured after the vault/config layer confirms readiness. */
  markCredentialsConfigured(adapterName: string): void {
    const metadata = this.readiness.get(adapterName);
    if (!metadata) {
      return;
    }
    metadata.environments = metadata.environments.map((environment) => ({
      ...environment,
      credentialState: 'CONFIGURED',
    }));
    const status = this.statuses.get(adapterName);
    if (status && status.state === 'CREDENTIALS_NOT_CONFIGURED') {
      status.state = 'UNKNOWN';
    }
    this.updateOutboundHealth(adapterName, 'UNKNOWN');
  }

  /** True when every declared environment has a configured credential reference. */
  hasConfiguredCredentials(adapterName: string): boolean {
    return this.getCredentialState(adapterName) === 'CONFIGURED';
  }

  /** Record or update a provider incident for readiness and status reporting. */
  recordIncident(adapterName: string, incident: IntegrationIncidentState): void {
    const metadata = this.readiness.get(adapterName);
    if (!metadata) {
      return;
    }
    const now = new Date();
    metadata.incident = {
      ...incident,
      openedAt: incident.openedAt ?? now,
      updatedAt: now,
    };
    const status = this.statuses.get(adapterName);
    if (status) {
      status.state = incident.state === 'ACTIVE' ? 'INCIDENT_ACTIVE' : status.state;
    }
    this.logger.warn({ type: 'INCIDENT_STATE_CHANGED', adapter: adapterName, state: incident.state, severity: incident.severity });
  }

  /** Runtime readiness snapshot for a single provider. */
  getReadiness(adapterName: string): IntegrationProviderReadiness | undefined {
    const metadata = this.readiness.get(adapterName);
    const status = this.statuses.get(adapterName);
    if (!metadata || !status) {
      return undefined;
    }

    const credentialState = this.getCredentialState(adapterName);
    const blockers = this.getReadinessBlockers(metadata, credentialState);
    const outboundHealth = this.outboundHealth.get(adapterName);

    return {
      adapterName,
      direction: status.direction,
      owner: metadata.owner,
      environments: metadata.environments,
      retryPolicy: metadata.retryPolicy,
      auditLogHooks: metadata.auditLogHooks,
      incident: metadata.incident,
      credentialState,
      ready: blockers.length === 0,
      blockers,
      outboundHealth,
    };
  }

  /** Runtime readiness snapshots for every registered provider. */
  getAllReadiness(): IntegrationProviderReadiness[] {
    return Array.from(this.statuses.keys())
      .map((adapterName) => this.getReadiness(adapterName))
      .filter((entry): entry is IntegrationProviderReadiness => Boolean(entry));
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

  /** Recent governed integration operation logs for operator consoles. */
  getOperationLogs(adapterName: string, limit = 50): IntegrationOperationLog[] {
    return [...(this.operationLogs.get(adapterName) ?? [])]
      .sort((left, right) => right.createdAt.getTime() - left.createdAt.getTime())
      .slice(0, Math.max(1, Math.min(limit, this.maxHistory)));
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

  private recordOperation(adapterName: string, input: {
    operation: IntegrationOperationName;
    status: IntegrationOperationStatus;
    latencyMs?: number;
    message?: string;
    blockers?: string[];
    readinessReady?: boolean;
  }): IntegrationOperationLog {
    const entry: IntegrationOperationLog = {
      id: `${adapterName}:${Date.now()}:${Math.random().toString(36).slice(2, 10)}`,
      adapterName,
      operation: input.operation,
      status: input.status,
      latencyMs: input.latencyMs,
      message: input.message,
      blockers: input.blockers ?? [],
      readinessReady: input.readinessReady,
      createdAt: new Date(),
    };
    const logs = this.operationLogs.get(adapterName) ?? [];
    logs.push(entry);
    if (logs.length > this.maxHistory) {
      logs.shift();
    }
    this.operationLogs.set(adapterName, logs);
    return entry;
  }

  private getCredentialState(adapterName: string): IntegrationCredentialState {
    const metadata = this.readiness.get(adapterName);
    if (!metadata || metadata.environments.length === 0) {
      return 'NOT_CONFIGURED';
    }
    return metadata.environments.every((environment) => environment.credentialState === 'CONFIGURED')
      ? 'CONFIGURED'
      : 'NOT_CONFIGURED';
  }

  private hasActiveIncident(adapterName: string): boolean {
    return this.readiness.get(adapterName)?.incident.state === 'ACTIVE';
  }

  private getReadinessBlockers(
    metadata: IntegrationReadinessMetadata,
    credentialState: IntegrationCredentialState,
  ): string[] {
    const blockers: string[] = [];
    const sandbox = metadata.environments.find((environment) => environment.name === 'SANDBOX');
    const production = metadata.environments.find((environment) => environment.name === 'PRODUCTION');

    if (!metadata.owner.team || !metadata.owner.contact) {
      blockers.push('OWNER_NOT_ASSIGNED');
    }
    if (!sandbox || !production || sandbox.endpointRef === production.endpointRef) {
      blockers.push('ENVIRONMENTS_NOT_SEPARATED');
    }
    if (credentialState === 'NOT_CONFIGURED') {
      blockers.push('CREDENTIALS_NOT_CONFIGURED');
    }
    if (metadata.retryPolicy.maxAttempts < 3 || metadata.retryPolicy.deadLetterAfterAttempts < metadata.retryPolicy.maxAttempts) {
      blockers.push('RETRY_POLICY_NOT_GOVERNED');
    }
    if (!metadata.auditLogHooks.includes('SEND_ATTEMPT') ||
      !metadata.auditLogHooks.includes('SEND_SUCCESS') ||
      !metadata.auditLogHooks.includes('SEND_FAILURE')) {
      blockers.push('AUDIT_LOG_HOOKS_INCOMPLETE');
    }
    if (metadata.incident.state === 'ACTIVE') {
      blockers.push('ACTIVE_INCIDENT');
    }

    return blockers;
  }

  private updateOutboundHealth(
    adapterName: string,
    state: IntegrationOutboundHealthState,
    checkedAt = new Date(),
  ): void {
    const status = this.statuses.get(adapterName);
    this.outboundHealth.set(adapterName, {
      state,
      consecutiveFailures: status?.consecutiveFailures ?? 0,
      totalFailures: status?.totalFailures ?? 0,
      lastCheckedAt: checkedAt,
      lastSuccessAt: status?.lastSuccessAt,
      lastFailureAt: status?.lastFailureAt,
    });
  }

  private toOutboundHealthState(state: IntegrationStatus['state']): IntegrationOutboundHealthState {
    if (state === 'INCIDENT_ACTIVE') {
      return 'UNHEALTHY';
    }
    if (state === 'CREDENTIALS_NOT_CONFIGURED') {
      return 'CREDENTIALS_NOT_CONFIGURED';
    }
    if (state === 'HEALTHY' || state === 'DEGRADED' || state === 'UNHEALTHY' || state === 'UNKNOWN') {
      return state;
    }
    return 'UNKNOWN';
  }
}
