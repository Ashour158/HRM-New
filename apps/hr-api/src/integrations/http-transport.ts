import type { ExportResult, IntegrationReadinessMetadata, IntegrationResult } from './types.js';

type FetchFn = (input: string, init?: RequestInit) => Promise<Response>;
type Env = Record<string, string | undefined>;

interface IntegrationHttpTransportOptions {
  env?: Env;
  fetchFn?: FetchFn;
}

export interface IntegrationHttpTransportRequest {
  adapterName: string;
  endpointRef: string;
  credentialRef?: string;
  payload: unknown;
  method?: 'POST' | 'PUT' | 'PATCH';
  timeoutMs?: number;
}

function operationIdFromBody(body: unknown): string {
  if (body && typeof body === 'object' && 'operationId' in body) {
    const operationId = (body as { operationId?: unknown }).operationId;
    if (typeof operationId === 'string' && operationId.length > 0) {
      return operationId;
    }
  }
  return crypto.randomUUID();
}

function recordCountFromBody(body: unknown): number | undefined {
  if (body && typeof body === 'object' && 'recordCount' in body) {
    const recordCount = (body as { recordCount?: unknown }).recordCount;
    if (typeof recordCount === 'number') {
      return recordCount;
    }
  }
  if (Array.isArray(body)) {
    return body.length;
  }
  return undefined;
}

function envNameFromRef(ref: string): string | undefined {
  return ref.startsWith('env:') ? ref.slice(4) : undefined;
}

function normalizePayload(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((entry) => normalizePayload(entry));
  }
  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    const keys = Object.keys(record);
    if (keys.length === 1 && typeof record.value === 'string') {
      return record.value;
    }
    return Object.fromEntries(keys.map((key) => [key, normalizePayload(record[key])]));
  }
  return value;
}

async function responseBody(response: Response): Promise<unknown> {
  const text = await response.text();
  if (!text) {
    return {};
  }
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return text;
  }
}

export class IntegrationHttpTransport {
  private readonly env: Env;
  private readonly fetchFn: FetchFn;

  constructor(options: IntegrationHttpTransportOptions = {}) {
    this.env = options.env ?? process.env;
    this.fetchFn = options.fetchFn ?? fetch;
  }

  async send(request: IntegrationHttpTransportRequest): Promise<ExportResult> {
    const endpointEnvName = envNameFromRef(request.endpointRef);
    const endpoint = endpointEnvName ? this.env[endpointEnvName] : undefined;
    if (!endpoint) {
      return {
        success: false,
        adapterName: request.adapterName,
        operationId: crypto.randomUUID(),
        timestamp: new Date(),
        error: endpointEnvName
          ? `Endpoint env var '${endpointEnvName}' is not configured.`
          : `Endpoint ref '${request.endpointRef}' is not supported.`,
        details: { retryable: false, reason: 'ENDPOINT_NOT_CONFIGURED', endpointRef: request.endpointRef },
      };
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), request.timeoutMs ?? 15_000);
    try {
      const headers: Record<string, string> = { 'content-type': 'application/json' };
      const credentialEnvName = request.credentialRef ? envNameFromRef(request.credentialRef) : undefined;
      const token = credentialEnvName ? this.env[credentialEnvName] : undefined;
      if (request.credentialRef && !credentialEnvName) {
        return {
          success: false,
          adapterName: request.adapterName,
          operationId: crypto.randomUUID(),
          timestamp: new Date(),
          error: `Credential ref '${request.credentialRef}' is not resolvable by the HTTP transport.`,
          details: { retryable: false, reason: 'CREDENTIAL_NOT_CONFIGURED', credentialRef: request.credentialRef },
        };
      }
      if (credentialEnvName && !token) {
        return {
          success: false,
          adapterName: request.adapterName,
          operationId: crypto.randomUUID(),
          timestamp: new Date(),
          error: `Credential env var '${credentialEnvName}' is not configured.`,
          details: { retryable: false, reason: 'CREDENTIAL_NOT_CONFIGURED', credentialRef: request.credentialRef },
        };
      }
      if (token) {
        headers.authorization = `Bearer ${token}`;
      }

      const response = await this.fetchFn(endpoint, {
        method: request.method ?? 'POST',
        headers,
        body: JSON.stringify(normalizePayload(request.payload)),
        signal: controller.signal,
      });
      const body = await responseBody(response);
      if (!response.ok) {
        const message = typeof body === 'string' ? body : JSON.stringify(body);
        return {
          success: false,
          adapterName: request.adapterName,
          operationId: operationIdFromBody(body),
          timestamp: new Date(),
          error: `HTTP ${response.status} from integration provider: ${message}`,
          details: { retryable: response.status >= 500 || response.status === 429, status: response.status, responseBody: body },
        };
      }
      return {
        success: true,
        adapterName: request.adapterName,
        operationId: operationIdFromBody(body),
        timestamp: new Date(),
        recordCount: recordCountFromBody(body),
        details: { responseBody: body },
      };
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      const isAbort = error.name === 'AbortError';
      return {
        success: false,
        adapterName: request.adapterName,
        operationId: crypto.randomUUID(),
        timestamp: new Date(),
        error: isAbort ? 'Integration provider request timed out.' : error.message,
        details: { retryable: true, reason: isAbort ? 'TIMEOUT' : 'NETWORK_ERROR' },
      };
    } finally {
      clearTimeout(timeout);
    }
  }
}

export function endpointForCurrentEnvironment(readiness: IntegrationReadinessMetadata): { endpointRef: string; credentialRef: string } {
  const environmentName = process.env.HR_INTEGRATION_ENV === 'PRODUCTION' ? 'PRODUCTION' : 'SANDBOX';
  const lane = readiness.environments.find((environment) => environment.name === environmentName) ?? readiness.environments[0];
  if (!lane) {
    return { endpointRef: '', credentialRef: '' };
  }
  return { endpointRef: lane.endpointRef, credentialRef: lane.credentialRef };
}

export function isRetryableIntegrationResult(result: IntegrationResult): boolean {
  const retryable = result.details?.retryable;
  return retryable === true;
}

/**
 * Deterministic health/readiness probe: is the adapter's outbound endpoint for the
 * current environment actually configured? Reports real configuration state (not a
 * mock `true`) without performing network I/O, so health checks stay non-flaky in
 * environments without live external systems.
 */
export function integrationEndpointConfigured(
  readiness: IntegrationReadinessMetadata,
  env: Env = process.env,
): boolean {
  const { endpointRef } = endpointForCurrentEnvironment(readiness);
  const envName = endpointRef.startsWith('env:') ? endpointRef.slice(4) : undefined;
  if (!envName) return false;
  const value = env[envName];
  return typeof value === 'string' && value.trim().length > 0;
}

export async function sendIntegrationHttpPayload(
  adapterName: string,
  readiness: IntegrationReadinessMetadata,
  payload: unknown,
): Promise<ExportResult> {
  const lane = endpointForCurrentEnvironment(readiness);
  return new IntegrationHttpTransport().send({
    adapterName,
    endpointRef: lane.endpointRef,
    credentialRef: lane.credentialRef,
    payload,
  });
}
