/**
 * Shared types for the Integration & External Adapters framework.
 *
 * All integration adapters implement {@link IntegrationAdapter} and are
 * registered with the {@link IntegrationOrchestrator}.
 */

import type { Uuid } from '@hcm/shared-kernel';

/** Direction of data flow for an integration adapter. */
export type IntegrationDirection = 'INBOUND' | 'OUTBOUND' | 'BIDIRECTIONAL';

/** Result of a single integration operation. */
export interface IntegrationResult {
  success: boolean;
  adapterName: string;
  operationId: string;
  timestamp: Date;
  details?: Record<string, unknown>;
  error?: string;
}

/** Health snapshot for one adapter. */
export interface IntegrationHealth {
  adapterName: string;
  direction: IntegrationDirection;
  healthy: boolean;
  lastCheckedAt: Date;
  latencyMs?: number;
  errorMessage?: string;
}

/** Operational status for one adapter. */
export interface IntegrationStatus {
  adapterName: string;
  direction: IntegrationDirection;
  state: 'HEALTHY' | 'DEGRADED' | 'UNHEALTHY' | 'UNKNOWN';
  lastSuccessAt?: Date;
  lastFailureAt?: Date;
  consecutiveFailures: number;
  totalSuccesses: number;
  totalFailures: number;
}

/** Metrics collected for an adapter. */
export interface IntegrationMetrics {
  adapterName: string;
  totalCalls: number;
  successfulCalls: number;
  failedCalls: number;
  averageLatencyMs: number;
  lastCallAt?: Date;
  p95LatencyMs?: number;
  p99LatencyMs?: number;
}

/** Time-series entry for integration logs. */
export interface IntegrationLogEntry {
  id: Uuid;
  adapterName: string;
  tenantId: Uuid;
  operation: string;
  status: 'SUCCESS' | 'FAILED' | 'RETRY' | 'DLQ';
  payload?: unknown;
  errorMessage?: string;
  createdAt: Date;
}

/** Export result returned by outbound adapters. */
export interface ExportResult extends IntegrationResult {
  format?: string;
  recordCount?: number;
  fileUrl?: string;
}

/** Validation result returned by adapters. */
export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

/** Every integration adapter must conform to this interface. */
export interface IntegrationAdapter {
  /** Canonical adapter name (kebab-case). */
  readonly name: string;

  /** Data-flow direction. */
  readonly direction: IntegrationDirection;

  /** Quick health probe (e.g. ping endpoint, check auth token). */
  healthCheck(): Promise<boolean>;

  /** Send a payload to the external system (OUTBOUND / BIDIRECTIONAL). */
  send(payload: unknown): Promise<IntegrationResult>;

  /** Receive a payload from the external system (INBOUND / BIDIRECTIONAL). */
  receive(): Promise<unknown>;
}
