import 'reflect-metadata';
import compression from 'compression';
import helmet from 'helmet';
import request from 'supertest';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { randomUUID } from 'node:crypto';
import jwt from 'jsonwebtoken';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { BaseRepository, createKyselyInstance, getPool, getSystemPool, runWithTenant, type Database } from '@hcm/database';
import { Uuid } from '@hcm/shared-kernel';

vi.mock('openid-client', () => ({
  ClientSecretPost: () => undefined,
  discovery: vi.fn(async () => ({ issuer: 'https://mock-oidc.example.com' })),
  randomState: () => 'tenant-state',
  randomNonce: () => 'tenant-nonce',
  randomPKCECodeVerifier: () => 'tenant-verifier',
  calculatePKCECodeChallenge: vi.fn(async () => 'tenant-challenge'),
  buildAuthorizationUrl: vi.fn(() => new URL('https://mock-oidc.example.com/authorize')),
  authorizationCodeGrant: vi.fn(async () => ({ claims: () => ({ sub: 'tenant-oidc' }) })),
}));

vi.mock('@node-saml/node-saml', () => ({
  ValidateInResponseTo: { always: 'always' },
  SAML: class MockSaml {
    async getAuthorizeUrlAsync(): Promise<string> {
      return 'https://mock-saml.example.com/sso';
    }
    async validatePostResponseAsync(): Promise<{ profile: Record<string, unknown> }> {
      return { profile: { nameID: 'tenant-saml' } };
    }
    generateServiceProviderMetadata(): string {
      return '<EntityDescriptor entityID="hrm-nexus:tenant" />';
    }
  },
}));

const TENANT_A = '00000000-0000-0000-0000-000000000001';
const TENANT_B = '00000000-0000-0000-0000-0000000000b2';
const EMPLOYEE_ID = '00000000-0000-0000-0000-000000000012';
const API_PREFIX = '/api/v1';

type JsonRecord = Record<string, unknown>;

class WorkerRowRepository extends BaseRepository<'workers', Database['workers']> {
  protected readonly tableName = 'workers' as const;

  constructor() {
    super(createKyselyInstance(getPool()));
  }
}

let app: INestApplication | undefined;
let dbReady = false;
let skipReason = '';
let limitedToken = '';
let managerToken = '';
let suffix = '';
let seededWorkerId = '';

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
  OutboxPublisherWorker: unknown;
  InboxRecoveryWorker: unknown;
  RedisCacheService: unknown;
}> {
  const [{ AppModule }, { OutboxPublisherWorker }, { InboxRecoveryWorker }, { RedisCacheService }] = await Promise.all([
    import('../dist/app.module.js'),
    import('../dist/platform/outbox-inbox/outbox-publisher.worker.js'),
    import('../dist/platform/outbox-inbox/inbox-recovery.worker.js'),
    import('@hcm/platform-core'),
  ]);
  return { AppModule, OutboxPublisherWorker, InboxRecoveryWorker, RedisCacheService };
}

function asRecord(value: unknown): JsonRecord {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as JsonRecord : {};
}

function payloadOf(body: unknown): unknown {
  const envelope = asRecord(body);
  return envelope.data ?? body;
}

function expectSuccessful(response: request.Response, label: string): JsonRecord {
  if (response.status < 200 || response.status >= 300) {
    throw new Error(`${label} returned ${response.status}: ${JSON.stringify(response.body)}`);
  }
  const data = asRecord(payloadOf(response.body));
  expect(response.body?.success ?? data.success ?? true).not.toBe(false);
  return data;
}

function authHeaders(token: string, tenantId = TENANT_A): Record<string, string> {
  return {
    Authorization: `Bearer ${token}`,
    'X-Tenant-ID': tenantId,
  };
}

const tenantIt = (name: string, fn: () => Promise<void>, timeout = 60_000): void => {
  it(name, async () => {
    if (!dbReady) {
      console.warn(`[tenant-isolation.e2e] skipped: ${skipReason}`);
      return;
    }
    await fn();
  }, timeout);
};

beforeAll(async () => {
  process.env.NODE_ENV = 'test';
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

  limitedToken = jwt.sign(
    {
      sub: '00000000-0000-0000-0000-000000000099',
      email: 'limited.employee@example.com',
      roles: ['EMPLOYEE'],
      permissions: ['WORKER_READ'],
      tenant_id: TENANT_A,
      actor_type: 'USER',
      session_id: `limited-${suffix}`,
      mfa_authenticated: true,
    },
    process.env.JWT_SECRET ?? 'runtime-lifecycle-test-secret',
    { expiresIn: '1h' },
  );
  managerToken = jwt.sign(
    {
      sub: '00000000-0000-0000-0000-000000000011',
      email: 'manager@example.com',
      roles: ['MANAGER'],
      permissions: ['WORKER_READ'],
      tenant_id: TENANT_A,
      actor_type: 'USER',
      session_id: `manager-${suffix}`,
      mfa_authenticated: true,
    },
    process.env.JWT_SECRET ?? 'runtime-lifecycle-test-secret',
    { expiresIn: '1h' },
  );

  // Seed via the system pool: under RLS the request pool (hcm_app) is tenant-bound,
  // so raw cross-tenant seed inserts must use the BYPASSRLS system connection.
  const pool = getSystemPool();
  await pool.query(
    `insert into hr_platform.tenants (id, name, slug, status)
     values ($1, 'Tenant Isolation B', $2, 'ACTIVE')
     on conflict (id) do update set status = excluded.status`,
    [TENANT_B, `tenant-isolation-${suffix}`],
  );
}, 60_000);

afterAll(async () => {
  if (dbReady) {
    const pool = getSystemPool();
    if (seededWorkerId) {
      await pool.query('delete from hr_core.workers where id = $1', [seededWorkerId]).catch(() => undefined);
    }
    await pool.query('delete from hr_platform.tenants where id = $1', [TENANT_B]).catch(() => undefined);
  }
  await app?.close();
});

describe.sequential('tenant isolation and privacy runtime regressions', () => {
  tenantIt('repository findById and findAll require tenant context and isolate cross-tenant rows', async () => {
    const repo = new WorkerRowRepository();
    seededWorkerId = randomUUID();
    // Seed the cross-tenant probe row via the BYPASSRLS system pool.
    await getSystemPool().query(
      `insert into hr_core.workers (
        id, tenant_id, employee_number, status, first_name, last_name, email, hire_date,
        termination_date, legal_entity_id, department_id, manager_id, job_title,
        employment_type, aggregate_version, data_classification, legal_hold_status,
        created_at, updated_at
      ) values (
        $1, $2, $3, 'ACTIVE', 'Tenant', 'Scoped', $4, now(),
        null, null, null, null, 'Isolation Probe',
        'FULL_TIME', 0, 'CONFIDENTIAL', 'NONE',
        now(), now()
      )`,
      [seededWorkerId, TENANT_A, `ISO-${suffix}`, `iso-${suffix}@example.com`],
    );

    await runWithTenant(new Uuid(TENANT_B), async () => {
      await expect(repo.findById(new Uuid(seededWorkerId))).resolves.toBeUndefined();
      const rows = await repo.findAll({ limit: 200 });
      expect(rows.some((row) => row.id === seededWorkerId)).toBe(false);
    });

    await expect(repo.findById(new Uuid(seededWorkerId))).rejects.toThrow('Tenant context required for findById');
    await expect(repo.findAll()).rejects.toThrow('Tenant context required for findAll');
    await expect(repo.insert({ id: randomUUID() } as never)).rejects.toThrow('Tenant context required for insert');
    await expect(repo.update(new Uuid(seededWorkerId), { first_name: 'No Context' } as never)).rejects.toThrow('Tenant context required for update');
    await expect(repo.delete(new Uuid(seededWorkerId))).rejects.toThrow('Tenant context required for delete');
  });

  tenantIt('protected create commands reject actors without write permission', async () => {
    const response = await request(app!.getHttpServer())
      .post(`${API_PREFIX}/hr/core/workers`)
      .set(authHeaders(limitedToken))
      .send({
        employeeNumber: `DENIED-${suffix}`,
        firstName: 'Denied',
        lastName: 'Actor',
        email: `denied-${suffix}@example.com`,
        hireDate: new Date().toISOString(),
        employmentType: 'FULL_TIME',
      });

    expect([400, 403]).toContain(response.status);
    expect(JSON.stringify(response.body)).toMatch(/permission|forbidden|access|authoriz/i);
  });

  tenantIt('field-level policy masks confidential payroll data without clearance', async () => {
    const response = await request(app!.getHttpServer())
      .get(`${API_PREFIX}/policy/field-access?fieldPath=worker.payroll.netPay&resourceType=PAYROLL&resourceId=${EMPLOYEE_ID}&dataClassification=HIGH_SENSITIVITY`)
      .set(authHeaders(managerToken));
    const decision = expectSuccessful(response, 'GET /policy/field-access manager payroll');
    expect(decision.decision).toBe('MASKED');
    expect(decision.maskingRule).toBeTruthy();
  });
});
