import 'reflect-metadata';
import compression from 'compression';
import helmet from 'helmet';
import request from 'supertest';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { getPool } from '@hcm/database';

// SSO client libraries are mocked the same way as the other runtime e2e suites so
// AppModule can boot without reaching real identity providers.
vi.mock('openid-client', () => ({
  ClientSecretPost: () => undefined,
  discovery: vi.fn(async () => ({ issuer: 'https://mock-oidc.example.com' })),
  randomState: () => 'drain-state',
  randomNonce: () => 'drain-nonce',
  randomPKCECodeVerifier: () => 'drain-verifier',
  calculatePKCECodeChallenge: vi.fn(async () => 'drain-challenge'),
  buildAuthorizationUrl: vi.fn(() => new URL('https://mock-oidc.example.com/authorize')),
  authorizationCodeGrant: vi.fn(async () => ({ claims: () => ({ sub: 'drain-oidc' }) })),
}));

vi.mock('@node-saml/node-saml', () => ({
  ValidateInResponseTo: { always: 'always' },
  SAML: class MockSaml {
    async getAuthorizeUrlAsync(): Promise<string> {
      return 'https://mock-saml.example.com/sso';
    }
    async validatePostResponseAsync(): Promise<{ profile: Record<string, unknown> }> {
      return { profile: { nameID: 'drain-saml' } };
    }
    generateServiceProviderMetadata(): string {
      return '<EntityDescriptor entityID="hrm-nexus:drain" />';
    }
  },
}));

const TENANT_ID = '00000000-0000-0000-0000-000000000001';
const API_PREFIX = '/api/v1';

type JsonRecord = Record<string, unknown>;

// Minimal structural views of the providers we resolve from the running app — the
// compiled dist modules have no published types, so we describe only what we call.
interface OutboxPublisherLike {
  pollAndPublish(batchSize?: number): Promise<number>;
}
interface EventBusLike {
  getPublicationDiagnostics(): {
    directPublications: Array<{ eventName: string }>;
    duplicatePublications: Array<{ eventName: string }>;
  };
}

let app: INestApplication | undefined;
let authToken = '';
let dbReady = false;
let skipReason = '';
let suffix = '';
let publisher: OutboxPublisherLike | undefined;
let eventBus: EventBusLike | undefined;
const createdWorkerIds = new Set<string>();

async function canReachDatabase(): Promise<boolean> {
  if (!process.env.DATABASE_URL) {
    skipReason = 'DATABASE_URL is not set';
    return false;
  }
  try {
    await Promise.race([
      getPool().query('select 1'),
      new Promise((_resolve, reject) => setTimeout(() => reject(new Error('database reachability timeout')), 2_000)),
    ]);
    return true;
  } catch (err) {
    skipReason = err instanceof Error ? err.message : String(err);
    return false;
  }
}

async function loadCompiledRuntime(): Promise<{
  AppModule: unknown;
  OutboxPublisher: unknown;
  OutboxPublisherWorker: unknown;
  InboxRecoveryWorker: unknown;
  EventBus: unknown;
  RedisCacheService: unknown;
}> {
  try {
    const [
      { AppModule },
      { OutboxPublisher },
      { OutboxPublisherWorker },
      { InboxRecoveryWorker },
      { EventBus },
      { RedisCacheService },
    ] = await Promise.all([
      import('../dist/app.module.js'),
      import('../dist/platform/outbox-inbox/outbox-publisher.js'),
      import('../dist/platform/outbox-inbox/outbox-publisher.worker.js'),
      import('../dist/platform/outbox-inbox/inbox-recovery.worker.js'),
      import('../dist/platform/event-bus/event-bus.js'),
      import('@hcm/platform-core'),
    ]);
    return { AppModule, OutboxPublisher, OutboxPublisherWorker, InboxRecoveryWorker, EventBus, RedisCacheService };
  } catch (err) {
    throw new Error(
      `Compiled API runtime is unavailable. Run pnpm --filter @hcm/hr-api build before the outbox drain e2e. ${err instanceof Error ? err.message : String(err)}`,
    );
  }
}

function asRecord(value: unknown): JsonRecord {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as JsonRecord : {};
}

function payloadOf(body: unknown): unknown {
  const envelope = asRecord(body);
  return envelope.data ?? body;
}

function bodyData(body: unknown): JsonRecord {
  return asRecord(payloadOf(body));
}

function stringField(record: JsonRecord, field: string): string | undefined {
  const value = record[field];
  if (typeof value === 'string') return value;
  const nested = asRecord(value);
  return typeof nested.value === 'string' ? nested.value : undefined;
}

function findId(value: unknown, preferredFields: string[] = []): string {
  const record = bodyData(value);
  const data = asRecord(record.data);
  for (const field of [...preferredFields, 'id', 'aggregateId', 'workerId']) {
    const direct = stringField(record, field);
    if (direct) return direct;
    const nested = stringField(data, field);
    if (nested) return nested;
  }
  for (const candidate of Object.values(record)) {
    if (typeof candidate === 'string' && /^[0-9a-f-]{36}$/i.test(candidate)) return candidate;
  }
  throw new Error(`Could not extract id from response: ${JSON.stringify(value)}`);
}

function expectSuccessful(response: request.Response, label: string): JsonRecord {
  if (response.status < 200 || response.status >= 300) {
    throw new Error(`${label} returned ${response.status}: ${JSON.stringify(response.body)}`);
  }
  const data = bodyData(response.body);
  expect(response.body?.success ?? data.success ?? true).not.toBe(false);
  return data;
}

function headers(): Record<string, string> {
  return { Authorization: `Bearer ${authToken}`, 'X-Tenant-ID': TENANT_ID };
}

function isoDate(dayOffset = 0): string {
  return new Date(Date.UTC(2037, 0, 5 + dayOffset, 9, 0, 0)).toISOString();
}

function shortCode(prefix: string): string {
  return `${prefix}-${suffix}-${randomUUID().slice(0, 8)}`;
}

async function apiPost(path: string, payload: JsonRecord = {}): Promise<request.Response> {
  return request(app!.getHttpServer()).post(`${API_PREFIX}${path}`).set(headers()).send(payload);
}

const drainIt = (name: string, fn: () => Promise<void>, timeout = 90_000): void => {
  it(name, async () => {
    if (!dbReady) {
      console.warn(`[outbox-drain.e2e] skipped: ${skipReason}`);
      return;
    }
    await fn();
  }, timeout);
};

beforeAll(async () => {
  process.env.NODE_ENV = 'test';
  // Empty broker list selects the in-process EventBus, so publish() dispatches
  // synchronously and the drain is deterministic without a live Kafka/Redpanda.
  process.env.KAFKA_BROKERS = '';
  process.env.JWT_SECRET ??= 'runtime-lifecycle-test-secret';
  process.env.SSO_SECRET_ENCRYPTION_KEY ??= 'MDEyMzQ1Njc4OWFiY2RlZjAxMjM0NTY3ODlhYmNkZWY=';

  dbReady = await canReachDatabase();
  if (!dbReady) return;

  let runtime: Awaited<ReturnType<typeof loadCompiledRuntime>>;
  try {
    runtime = await loadCompiledRuntime();
  } catch (err) {
    dbReady = false;
    skipReason = err instanceof Error ? err.message : String(err);
    return;
  }

  suffix = Date.now().toString(36);
  const moduleRef = await Test.createTestingModule({ imports: [runtime.AppModule as never] })
    .overrideProvider(runtime.RedisCacheService as never)
    .useValue({
      get: vi.fn(async () => undefined),
      set: vi.fn(async () => undefined),
      delete: vi.fn(async () => undefined),
      getOrSet: vi.fn(async (_key: string, factory: () => Promise<unknown>) => factory()),
      flushTenant: vi.fn(async () => undefined),
    })
    // Disable the background pollers so this test drives the drain explicitly and
    // there is no race between the interval and the assertions.
    .overrideProvider(runtime.OutboxPublisherWorker as never)
    .useValue({ onApplicationBootstrap: vi.fn(), onModuleDestroy: vi.fn() })
    .overrideProvider(runtime.InboxRecoveryWorker as never)
    .useValue({ onApplicationBootstrap: vi.fn(), onModuleDestroy: vi.fn() })
    .compile();

  app = moduleRef.createNestApplication({ logger: false });
  app.setGlobalPrefix('api/v1');
  app.use(helmet());
  app.use(compression());
  await app.init();

  publisher = app.get(runtime.OutboxPublisher as never, { strict: false }) as OutboxPublisherLike;
  eventBus = app.get(runtime.EventBus as never, { strict: false }) as EventBusLike;

  const login = await request(app.getHttpServer())
    .post(`${API_PREFIX}/auth/login`)
    .set('X-Tenant-ID', TENANT_ID)
    .send({ email: 'hr.admin@example.com', password: 'Password123!' });
  const loginData = expectSuccessful(login, 'POST /auth/login');
  authToken = String(loginData.token ?? asRecord(loginData.session).token ?? '');
  expect(authToken).toBeTruthy();
}, 60_000);

afterAll(async () => {
  if (dbReady) {
    const pool = getPool();
    const workerIds = [...createdWorkerIds];
    await pool.query('delete from hr_platform.outbox_events where tenant_id = $1 and aggregate_id = any($2::uuid[])', [TENANT_ID, workerIds]).catch(() => undefined);
    await pool.query('delete from hr_platform.audit_log where tenant_id = $1 and resource_id = any($2::uuid[])', [TENANT_ID, workerIds]).catch(() => undefined);
    await pool.query('delete from hr_core.personal_data_records where tenant_id = $1 and worker_id = any($2::uuid[])', [TENANT_ID, workerIds]).catch(() => undefined);
    await pool.query('delete from hr_core.workers where tenant_id = $1 and id = any($2::uuid[])', [TENANT_ID, workerIds]).catch(() => undefined);
  }
  await app?.close();
});

describe.sequential('outbox -> event bus -> inbox drain', () => {
  drainIt('publishes pending outbox events and records them on the event bus', async () => {
    expect(publisher).toBeTruthy();
    expect(eventBus).toBeTruthy();

    // A real command writes outbox rows transactionally (published_at IS NULL).
    const workerCreate = await apiPost('/hr/core/workers', {
      employeeNumber: shortCode('DRAIN'),
      firstName: 'Drain',
      lastName: 'Probe',
      email: `${shortCode('drain').toLowerCase()}@example.com`,
      hireDate: isoDate(-10),
      employmentType: 'FULL_TIME',
      jobTitle: 'Drain Probe',
    });
    const workerId = findId(workerCreate.body, ['workerId']);
    createdWorkerIds.add(workerId);
    expectSuccessful(workerCreate, 'POST /hr/core/workers');

    const pool = getPool();
    const pending = await pool.query(
      `select id, published_at from hr_platform.outbox_events
       where tenant_id = $1 and aggregate_id = $2 and published_at is null`,
      [TENANT_ID, workerId],
    );
    expect(pending.rowCount ?? 0).toBeGreaterThanOrEqual(1);

    // Drive the publisher explicitly and assert it drains the pending rows.
    const publishedCount = await publisher!.pollAndPublish(500);
    expect(publishedCount).toBeGreaterThanOrEqual(1);

    const afterDrain = await pool.query(
      `select count(*)::int as remaining from hr_platform.outbox_events
       where tenant_id = $1 and aggregate_id = $2 and published_at is null`,
      [TENANT_ID, workerId],
    );
    expect(afterDrain.rows[0]?.remaining).toBe(0);

    const drained = await pool.query(
      `select id, published_at from hr_platform.outbox_events
       where tenant_id = $1 and aggregate_id = $2 order by id`,
      [TENANT_ID, workerId],
    );
    expect(drained.rowCount ?? 0).toBeGreaterThanOrEqual(1);
    expect(drained.rows.every((row) => row.published_at !== null)).toBe(true);

    // The in-process bus must have actually received the publication(s).
    const diagnostics = eventBus!.getPublicationDiagnostics();
    const totalPublications = diagnostics.directPublications.length + diagnostics.duplicatePublications.length;
    expect(totalPublications).toBeGreaterThanOrEqual(1);

    // Idempotency: published_at guards re-publishing. A second drain must not
    // re-publish this worker's already-drained rows (their timestamps are stable).
    const firstPass = new Map(drained.rows.map((row) => [row.id as string, String(row.published_at)]));
    await publisher!.pollAndPublish(500);
    const secondPass = await pool.query(
      `select id, published_at from hr_platform.outbox_events
       where tenant_id = $1 and aggregate_id = $2 order by id`,
      [TENANT_ID, workerId],
    );
    expect(secondPass.rows.every((row) => firstPass.get(row.id as string) === String(row.published_at))).toBe(true);
  });
});
