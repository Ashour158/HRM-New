/**
 * Shared types for the Integration & External Adapters framework.
 *
 * All integration adapters implement {@link IntegrationAdapter} and are
 * registered with the {@link IntegrationOrchestrator}.
 */

import type { Uuid } from '@hcm/shared-kernel';

/** Direction of data flow for an integration adapter. */
export type IntegrationDirection = 'INBOUND' | 'OUTBOUND' | 'BIDIRECTIONAL';

/** Environment lanes must stay explicitly separated for provider readiness. */
export type IntegrationEnvironmentName = 'SANDBOX' | 'PRODUCTION';

/** Credential posture as exposed by the integration readiness surface. */
export type IntegrationCredentialState = 'CONFIGURED' | 'NOT_CONFIGURED';

/** Incident posture for an integration provider. */
export type IntegrationIncidentStateName = 'NONE' | 'ACTIVE' | 'MITIGATING';

/** Severity label for provider incidents. */
export type IntegrationIncidentSeverity = 'SEV1' | 'SEV2' | 'SEV3' | 'SEV4';

/** Operational state stored for an adapter. */
export type IntegrationOperationalState =
  | 'HEALTHY'
  | 'DEGRADED'
  | 'UNHEALTHY'
  | 'UNKNOWN'
  | 'CREDENTIALS_NOT_CONFIGURED'
  | 'INCIDENT_ACTIVE';

/** Outbound health posture surfaced in readiness snapshots. */
export type IntegrationOutboundHealthState =
  | 'HEALTHY'
  | 'DEGRADED'
  | 'UNHEALTHY'
  | 'UNKNOWN'
  | 'CREDENTIALS_NOT_CONFIGURED';

/** Audit hook names adapters must declare for governed operation. */
export type IntegrationAuditLogHook =
  | 'HEALTH_CHECK'
  | 'SEND_ATTEMPT'
  | 'SEND_SUCCESS'
  | 'SEND_FAILURE'
  | 'RECEIVE_ATTEMPT'
  | 'RECEIVE_SUCCESS'
  | 'RECEIVE_FAILURE'
  | 'INCIDENT_STATE_CHANGED';

/** Owner and escalation metadata for a provider. */
export interface IntegrationOwner {
  team: string;
  contact: string;
  escalation?: string;
}

/** One environment lane for a provider. References point to config/vault keys only. */
export interface IntegrationEnvironmentReadiness {
  name: IntegrationEnvironmentName;
  endpointRef: string;
  credentialRef: string;
  credentialState: IntegrationCredentialState;
}

/** Retry and DLQ policy declared by each outbound provider. */
export interface IntegrationRetryPolicy {
  maxAttempts: number;
  backoff: 'EXPONENTIAL' | 'LINEAR';
  initialDelayMs: number;
  maxDelayMs: number;
  deadLetterAfterAttempts: number;
}

/** Active incident metadata. */
export interface IntegrationIncidentState {
  state: IntegrationIncidentStateName;
  severity?: IntegrationIncidentSeverity;
  summary?: string;
  openedAt?: Date;
  updatedAt?: Date;
}

/** Runtime outbound health summarized for readiness views. */
export interface IntegrationOutboundHealth {
  state: IntegrationOutboundHealthState;
  consecutiveFailures: number;
  totalFailures: number;
  lastCheckedAt?: Date;
  lastSuccessAt?: Date;
  lastFailureAt?: Date;
}

/** Static governance metadata declared by each integration adapter. */
export interface IntegrationReadinessMetadata {
  owner: IntegrationOwner;
  environments: IntegrationEnvironmentReadiness[];
  retryPolicy: IntegrationRetryPolicy;
  auditLogHooks: IntegrationAuditLogHook[];
  incident: IntegrationIncidentState;
}

/** Runtime readiness snapshot combining adapter metadata and health state. */
export interface IntegrationProviderReadiness extends IntegrationReadinessMetadata {
  adapterName: string;
  direction: IntegrationDirection;
  credentialState: IntegrationCredentialState;
  ready: boolean;
  blockers: string[];
  outboundHealth?: IntegrationOutboundHealth;
}

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
  readiness?: IntegrationProviderReadiness;
}

/** Operational status for one adapter. */
export interface IntegrationStatus {
  adapterName: string;
  direction: IntegrationDirection;
  state: IntegrationOperationalState;
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

/** Governed operator and runtime operation log entry for integration evidence. */
export interface IntegrationOperationLog {
  id: string;
  adapterName: string;
  operation: 'HEALTH_CHECK' | 'TEST_CONNECTION' | 'SEND' | 'RECEIVE';
  status: 'SUCCESS' | 'FAILED' | 'BLOCKED';
  latencyMs?: number;
  message?: string;
  blockers?: string[];
  readinessReady?: boolean;
  createdAt: Date;
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

  /** Governed readiness metadata for provider ownership and production posture. */
  readonly readiness: IntegrationReadinessMetadata;

  /** Quick health probe (e.g. ping endpoint, check auth token). */
  healthCheck(): Promise<boolean>;

  /** Send a payload to the external system (OUTBOUND / BIDIRECTIONAL). */
  send(payload: unknown): Promise<IntegrationResult>;

  /** Receive a payload from the external system (INBOUND / BIDIRECTIONAL). */
  receive(): Promise<unknown>;
}
