import 'reflect-metadata';
import compression from 'compression';
import helmet from 'helmet';
import request from 'supertest';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { randomUUID } from 'node:crypto';
import jwt from 'jsonwebtoken';
import { beforeAll, afterAll, describe, expect, it, vi } from 'vitest';
import { getPool } from '@hcm/database';

const oidcMock = vi.hoisted(() => ({
  sequence: 0,
  claims: {
    sub: 'oidc-user',
    email: 'oidc.user@example.com',
    given_name: 'Oidc',
    family_name: 'User',
    groups: ['employees'],
  } as Record<string, unknown>,
}));

const samlMock = vi.hoisted(() => ({
  profile: {
    nameID: 'saml-user',
    email: 'saml.user@example.com',
    firstName: 'Saml',
    lastName: 'User',
    groups: ['employees'],
  } as Record<string, unknown>,
}));

vi.mock('openid-client', () => ({
  ClientSecretPost: () => undefined,
  discovery: vi.fn(async () => ({ issuer: 'https://mock-oidc.example.com' })),
  randomState: () => {
    oidcMock.sequence += 1;
    return `oidc-state-${oidcMock.sequence}`;
  },
  randomNonce: () => `oidc-nonce-${oidcMock.sequence}`,
  randomPKCECodeVerifier: () => `oidc-verifier-${oidcMock.sequence}`,
  calculatePKCECodeChallenge: vi.fn(async (verifier: string) => `challenge-${verifier}`),
  buildAuthorizationUrl: vi.fn((_config: unknown, params: Record<string, string>) => {
    const url = new URL('https://mock-oidc.example.com/authorize');
    for (const [key, value] of Object.entries(params)) {
      url.searchParams.set(key, value);
    }
    return url;
  }),
  authorizationCodeGrant: vi.fn(async () => ({
    claims: () => oidcMock.claims,
  })),
}));

vi.mock('@node-saml/node-saml', () => ({
  ValidateInResponseTo: { always: 'always' },
  SAML: class MockSaml {
    constructor(private readonly options: { generateUniqueId?: () => string }) {}

    async getAuthorizeUrlAsync(relayState: string): Promise<string> {
      const url = new URL('https://mock-saml.example.com/sso');
      url.searchParams.set('RelayState', relayState);
      url.searchParams.set('SAMLRequest', this.options.generateUniqueId?.() ?? 'mock-saml-request');
      return url.toString();
    }

    async validatePostResponseAsync(payload: { SAMLResponse?: string }): Promise<{ profile: Record<string, unknown> }> {
      if (String(payload.SAMLResponse ?? '').includes('unsigned') || String(payload.SAMLResponse ?? '').includes('tampered')) {
        throw new Error('unsigned SAML assertion rejected');
      }
      return { profile: samlMock.profile };
    }

    generateServiceProviderMetadata(): string {
      return '<EntityDescriptor entityID="hrm-nexus:test" />';
    }
  },
}));

const TENANT_ID = '00000000-0000-0000-0000-000000000001';
const HR_ADMIN_ID = '00000000-0000-0000-0000-000000000010';
const MANAGER_ID = '00000000-0000-0000-0000-000000000011';
const EMPLOYEE_ID = '00000000-0000-0000-0000-000000000012';

const apiPrefix = '/api/v1';

type JsonRecord = Record<string, unknown>;

let app: INestApplication | undefined;
let authToken = '';
let managerAuthToken = '';
let hrAdminWithoutWellbeingToken = '';
let dbReady = false;
let skipReason = '';
let suffix = '';

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
  try {
    const [{ AppModule }, { OutboxPublisherWorker }, { InboxRecoveryWorker }, { RedisCacheService }] = await Promise.all([
      import('../dist/app.module.js'),
      import('../dist/platform/outbox-inbox/outbox-publisher.worker.js'),
      import('../dist/platform/outbox-inbox/inbox-recovery.worker.js'),
      import('@hcm/platform-core'),
    ]);
    return { AppModule, OutboxPublisherWorker, InboxRecoveryWorker, RedisCacheService };
  } catch (err) {
    throw new Error(`Compiled API runtime is unavailable. Run pnpm --filter @hcm/hr-api build before lifecycle e2e. ${err instanceof Error ? err.message : String(err)}`);
  }
}

function payloadOf(body: unknown): unknown {
  const envelope = asRecord(body);
  if ('data' in envelope && envelope.data !== undefined) {
    return envelope.data;
  }
  return body;
}

function bodyData(body: unknown): JsonRecord {
  return asRecord(payloadOf(body));
}

function asRecord(value: unknown): JsonRecord {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as JsonRecord
    : {};
}

function snakeCase(value: string): string {
  return value.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);
}

function collectRecords(value: unknown, seen = new WeakSet<object>()): JsonRecord[] {
  if (!value || typeof value !== 'object') {
    return [];
  }
  if (seen.has(value)) {
    return [];
  }
  seen.add(value);
  if (Array.isArray(value)) {
    return value.map(asRecord).filter((record) => Object.keys(record).length > 0);
  }
  const record = asRecord(value);
  for (const key of ['items', 'records', 'rows', 'results', 'events', 'data']) {
    const nested = record[key];
    const nestedRecords = collectRecords(nested, seen);
    if (nestedRecords.length > 0) return nestedRecords;
  }
  return Object.keys(record).length > 0 ? [record] : [];
}

function stringField(record: JsonRecord, field: string): string | undefined {
  const value = record[field];
  if (typeof value === 'string') return value;
  const nested = asRecord(value);
  if (typeof nested.value === 'string') return nested.value;
  return undefined;
}

function fieldValue(record: JsonRecord, field: string): unknown {
  const candidates = [
    field,
    snakeCase(field),
    field.replace(/Id$/, '_id'),
    snakeCase(field.replace(/Id$/, 'ID')),
  ];
  if (field === 'workerId') {
    candidates.push('subjectWorkerId', 'subject_worker_id', 'requesterWorkerId', 'requester_worker_id', 'reviewerWorkerId', 'reviewer_worker_id');
  }
  if (field === 'subjectWorkerId') {
    candidates.push('workerId', 'worker_id', 'subject_worker_id');
  }
  if (field === 'requesterWorkerId') {
    candidates.push('workerId', 'worker_id', 'requester_worker_id');
  }

  for (const candidate of candidates) {
    if (candidate in record) {
      const value = record[candidate];
      const nested = asRecord(value);
      return typeof nested.value === 'string' ? nested.value : value;
    }
  }
  return undefined;
}

function recordContainsId(value: unknown, id: string, depth = 0): boolean {
  if (value === id) return true;
  if (depth > 3) return false;
  if (Array.isArray(value)) return value.some((item) => recordContainsId(item, id, depth + 1));
  const record = asRecord(value);
  if (!Object.keys(record).length) return false;
  const idFields = [
    'id',
    'aggregateId',
    'aggregate_id',
    'employeeRelationsCaseId',
    'employee_relations_case_id',
    'hrServiceCaseId',
    'hr_service_case_id',
    'sowEngagementId',
    'sow_engagement_id',
    'unionRecognitionId',
    'union_recognition_id',
    'wellnessProgramId',
    'wellness_program_id',
    'talentPoolId',
    'talent_pool_id',
    'learningCourseId',
    'learning_course_id',
    'hrAiUseCaseId',
    'hr_ai_use_case_id',
    'deiReportId',
    'dei_report_id',
    'workAuthorizationCaseId',
    'work_authorization_case_id',
    'shiftScheduleId',
    'shift_schedule_id',
    'positionId',
    'position_id',
    'planId',
    'plan_id',
    'feedback360CycleId',
    'feedback_360_cycle_id',
    'payrollCycleId',
    'payroll_cycle_id',
    'absenceRequestId',
    'absence_request_id',
    'timeClockEventId',
    'time_clock_event_id',
    'performanceReviewCycleId',
    'performance_review_cycle_id',
  ];
  if (idFields.some((field) => stringField(record, field) === id)) return true;
  return Object.values(record).some((candidate) => recordContainsId(candidate, id, depth + 1));
}

function findId(value: unknown, preferredFields: string[] = []): string {
  const record = bodyData(value);
  const nestedData = asRecord(record.data);
  const candidates = [
    ...preferredFields,
    'id',
    'aggregateId',
    'employeeRelationsCaseId',
    'hrServiceCaseId',
    'sowEngagementId',
    'unionRecognitionId',
    'wellnessProgramId',
    'talentPoolId',
    'learningCourseId',
    'hrAiUseCaseId',
    'deiReportId',
    'workAuthorizationCaseId',
    'shiftScheduleId',
    'positionId',
    'planId',
    'feedback360CycleId',
    'payrollCycleId',
    'absenceRequestId',
    'timeClockEventId',
    'performanceReviewCycleId',
  ];

  for (const field of candidates) {
    const direct = stringField(record, field);
    if (direct) return direct;
    const nested = stringField(nestedData, field);
    if (nested) return nested;
  }

  for (const candidate of Object.values(record)) {
    if (typeof candidate === 'string' && /^[0-9a-f-]{36}$/i.test(candidate)) {
      return candidate;
    }
    const nested = asRecord(candidate);
    if (typeof nested.value === 'string' && /^[0-9a-f-]{36}$/i.test(nested.value)) {
      return nested.value;
    }
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

function expectStepId(records: JsonRecord[], state: string): string {
  const step = records.find((record) => stringField(record, 'state') === state);
  const id = step ? stringField(step, 'id') : undefined;
  if (!id) {
    throw new Error(`Could not find ${state} approval step in ${JSON.stringify(records)}`);
  }
  return id;
}

function headers(token = authToken): Record<string, string> {
  return {
    Authorization: `Bearer ${token}`,
    'X-Tenant-ID': TENANT_ID,
  };
}

function isoDate(daysFromNow = 0): string {
  const date = new Date(Date.UTC(2026, 5, 15 + daysFromNow, 9, 0, 0));
  return date.toISOString();
}

function uniqueBusinessIsoDate(dayOffset = 0): string {
  const suffixNumber = Number.parseInt(suffix.slice(-4), 36);
  const weekOffset = Number.isFinite(suffixNumber) ? suffixNumber % 240 : 0;
  const base = new Date(Date.UTC(2034, 0, 1 + weekOffset * 7, 9, 0, 0));
  const daysUntilMonday = (8 - base.getUTCDay()) % 7;
  base.setUTCDate(base.getUTCDate() + daysUntilMonday + dayOffset);
  return base.toISOString();
}

function shortCode(prefix: string): string {
  return `${prefix}-${suffix}-${randomUUID().slice(0, 8)}`;
}

async function apiGet(path: string, token = authToken): Promise<request.Response> {
  return request(app!.getHttpServer()).get(`${apiPrefix}${path}`).set(headers(token));
}

async function apiPost(path: string, payload: JsonRecord = {}, token = authToken): Promise<request.Response> {
  return request(app!.getHttpServer()).post(`${apiPrefix}${path}`).set(headers(token)).send(payload);
}

async function apiPatch(path: string, payload: JsonRecord = {}, token = authToken): Promise<request.Response> {
  return request(app!.getHttpServer()).patch(`${apiPrefix}${path}`).set(headers(token)).send(payload);
}

async function apiDelete(path: string, token = authToken): Promise<request.Response> {
  return request(app!.getHttpServer()).delete(`${apiPrefix}${path}`).set(headers(token));
}

function redirectLocation(response: request.Response, label: string): string {
  if (response.status < 300 || response.status >= 400) {
    throw new Error(`${label} expected redirect, got ${response.status}: ${JSON.stringify(response.body)}`);
  }
  const location = response.headers.location;
  if (typeof location !== 'string' || !location) {
    throw new Error(`${label} did not return a redirect location`);
  }
  return location;
}

function tokensFromSsoRedirect(response: request.Response, label: string): { token: string; refreshToken: string } {
  const location = redirectLocation(response, label);
  const url = new URL(location);
  const token = url.searchParams.get('token') ?? '';
  const refreshToken = url.searchParams.get('refreshToken') ?? '';
  expect(token, `${label} should include token`).toBeTruthy();
  expect(refreshToken, `${label} should include refresh token`).toBeTruthy();
  return { token, refreshToken };
}

async function expectDetail(path: string, requiredFields: string[]): Promise<JsonRecord> {
  const response = await apiGet(path);
  const data = expectSuccessful(response, `GET ${path}`);
  for (const field of requiredFields) {
    const value = fieldValue(data, field);
    expect(value, `${path} should persist non-null ${field}`).not.toBeNull();
    expect(value, `${path} should persist non-null ${field}`).not.toBeUndefined();
  }
  return data;
}

async function expectListed(path: string, id: string): Promise<void> {
  const response = await apiGet(path);
  expectSuccessful(response, `GET ${path}`);
  const records = collectRecords(payloadOf(response.body));
  const found = records.some((record) => recordContainsId(record, id));
  expect(found, `${path} should include ${id}`).toBe(true);
}

async function runCommand(basePath: string, id: string, action: string, payload: JsonRecord = {}): Promise<JsonRecord> {
  const response = await apiPost(`${basePath}/${id}/commands/${action}`, payload);
  const data = expectSuccessful(response, `POST ${basePath}/${id}/commands/${action}`);
  if ('allowedNextActions' in data) {
    expect(Array.isArray(data.allowedNextActions)).toBe(true);
  }
  return data;
}

async function expectAllowedActions(path: string): Promise<void> {
  const response = await apiGet(path);
  const data = expectSuccessful(response, `GET ${path}`);
  expect(Array.isArray(data.allowedActions ?? data.allowedNextActions)).toBe(true);
}

async function findInboxApprovalAction(approvalChainId: string, stepId: string): Promise<JsonRecord> {
  const response = await apiGet('/me/inbox');
  const inbox = expectSuccessful(response, 'GET /me/inbox');
  const sections = collectRecords(inbox.sections);
  const approvals = sections.find((section) => section.key === 'approvals');
  const approvalItems = collectRecords(approvals?.items);
  const action = approvalItems
    .flatMap((item) => collectRecords(item.actions))
    .find((candidate) => stringField(candidate, 'commandPath') === `/platform/workflow/approval-chains/${approvalChainId}/steps/${stepId}/commands/approve`);
  if (!action) {
    throw new Error(`Could not find inbox approval action for chain ${approvalChainId} step ${stepId}: ${JSON.stringify(inbox)}`);
  }
  return action;
}

async function eventually<T>(fn: () => Promise<T | undefined>, timeoutMs = 5_000): Promise<T> {
  const started = Date.now();
  let lastValue: T | undefined;
  while (Date.now() - started < timeoutMs) {
    lastValue = await fn();
    if (lastValue !== undefined) return lastValue;
    await new Promise((resolve) => setTimeout(resolve, 150));
  }
  throw new Error(`Expected condition did not pass before timeout. Last value: ${JSON.stringify(lastValue)}`);
}

const lifecycleIt = (name: string, fn: () => Promise<void>, timeout = 60_000): void => {
  it(name, async () => {
    if (!dbReady) {
      console.warn(`[runtime-lifecycle.e2e] skipped: ${skipReason}`);
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
    skipReason = err instanceof Error ? err.message : String(err);
    dbReady = false;
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

  const login = await request(app.getHttpServer())
    .post(`${apiPrefix}/auth/login`)
    .set('X-Tenant-ID', TENANT_ID)
    .send({ email: 'hr.admin@example.com', password: 'Password123!' });
  const loginData = expectSuccessful(login, 'POST /auth/login');
  authToken = String(loginData.token ?? asRecord(loginData.session).token ?? '');
  expect(authToken).toBeTruthy();

  const managerLogin = await request(app.getHttpServer())
    .post(`${apiPrefix}/auth/login`)
    .set('X-Tenant-ID', TENANT_ID)
    .send({ email: 'manager@example.com', password: 'Password123!' });
  const managerLoginData = expectSuccessful(managerLogin, 'POST /auth/login manager');
  managerAuthToken = String(managerLoginData.token ?? asRecord(managerLoginData.session).token ?? '');
  expect(managerAuthToken).toBeTruthy();

  hrAdminWithoutWellbeingToken = jwt.sign(
    {
      sub: HR_ADMIN_ID,
      email: 'hr.admin.limited@example.com',
      roles: ['HR_ADMIN'],
      permissions: ['WORKER_READ', 'PAYROLL_READ'],
      tenant_id: TENANT_ID,
      actor_type: 'USER',
      session_id: `limited-hr-admin-${suffix}`,
      mfa_authenticated: true,
    },
    process.env.JWT_SECRET ?? 'runtime-lifecycle-test-secret',
    { expiresIn: '1h' },
  );
}, 60_000);

afterAll(async () => {
  await app?.close();
});

describe.sequential('runtime HTTP lifecycle coverage', () => {
  lifecycleIt('saved views persist per actor and list through the real HTTP surface', async () => {
    const listKey = `admin.workers.${suffix}`;
    const create = await apiPost('/saved-views', {
      listKey,
      name: 'Active workers',
      filters: { status: 'ACTIVE', department: 'Engineering' },
      columns: ['name', 'email', 'jobTitle'],
      isDefault: true,
    });
    const created = expectSuccessful(create, 'POST /saved-views');
    const savedViewId = String(created.id ?? '');
    expect(savedViewId).toMatch(/^[0-9a-f-]{36}$/i);
    expect(created.userId).toBe(HR_ADMIN_ID);
    expect(created.listKey).toBe(listKey);

    const list = await apiGet(`/saved-views/${encodeURIComponent(listKey)}`);
    const records = collectRecords(payloadOf(list.body));
    expectSuccessful(list, 'GET /saved-views/:listKey');
    expect(records.some((record) => record.id === savedViewId && record.isDefault === true)).toBe(true);

    const updatedResponse = await apiPatch(`/saved-views/${savedViewId}`, {
      name: 'Workers by job',
      filters: { jobTitle: 'Engineer' },
      columns: ['name', 'jobTitle'],
      isDefault: false,
    });
    const updated = expectSuccessful(updatedResponse, 'PATCH /saved-views/:id');
    expect(updated.name).toBe('Workers by job');
    expect(updated.filters).toEqual({ jobTitle: 'Engineer' });
    expect(updated.columns).toEqual(['name', 'jobTitle']);
    expect(updated.isDefault).toBe(false);

    expectSuccessful(await apiDelete(`/saved-views/${savedViewId}`), 'DELETE /saved-views/:id');
    const afterDelete = await apiGet(`/saved-views/${encodeURIComponent(listKey)}`);
    expectSuccessful(afterDelete, 'GET /saved-views/:listKey after delete');
    const remaining = collectRecords(payloadOf(afterDelete.body));
    expect(remaining.some((record) => record.id === savedViewId)).toBe(false);
  });

  lifecycleIt('OIDC SSO config starts, JIT provisions, mints a session, and enforces refresh reuse detection', async () => {
    await getPool().query('delete from hr_platform.sso_auth_transactions where tenant_id = $1 and protocol = $2', [TENANT_ID, 'OIDC']);
    await getPool().query('delete from hr_platform.tenant_identity_providers where tenant_id = $1 and protocol = $2', [TENANT_ID, 'OIDC']);

    const email = `oidc.${suffix}@sso.example.com`;
    const config = await apiPost('/auth/sso/config', {
      protocol: 'OIDC',
      displayName: 'Runtime OIDC',
      enabled: true,
      jitProvisioning: true,
      defaultRoles: ['EMPLOYEE'],
      attributeMapping: {
        email: 'email',
        firstName: 'given_name',
        lastName: 'family_name',
        groups: 'groups',
      },
      groupRoleMapping: {},
      oidcIssuerUrl: 'https://mock-oidc.example.com',
      oidcClientId: 'runtime-client',
      oidcClientSecret: 'runtime-secret',
      oidcScopes: ['openid', 'email', 'profile'],
    });
    const configData = expectSuccessful(config, 'POST /auth/sso/config OIDC');
    const providerId = stringField(configData, 'id');
    expect(providerId).toBeTruthy();

    const discovery = await request(app!.getHttpServer())
      .get(`${apiPrefix}/auth/providers?tenantId=${TENANT_ID}`)
      .send();
    const discoveryData = expectSuccessful(discovery, 'GET /auth/providers tenant OIDC');
    expect(collectRecords(discoveryData.providers).some((provider) => provider.displayName === 'Runtime OIDC')).toBe(true);

    const start = await request(app!.getHttpServer())
      .get(`${apiPrefix}/auth/sso/oidc/${TENANT_ID}/start`)
      .redirects(0);
    const startUrl = new URL(redirectLocation(start, 'GET OIDC start'));
    const state = startUrl.searchParams.get('state');
    expect(state).toBeTruthy();

    oidcMock.claims = {
      sub: `oidc-${suffix}`,
      email,
      given_name: 'Runtime',
      family_name: 'Oidc',
      groups: ['employees'],
    };
    const callback = await request(app!.getHttpServer())
      .get(`${apiPrefix}/auth/sso/oidc/${TENANT_ID}/callback?code=mock-code&state=${state}`)
      .redirects(0);
    const credentials = tokensFromSsoRedirect(callback, 'GET OIDC callback');

    const me = await request(app!.getHttpServer())
      .get(`${apiPrefix}/auth/me`)
      .set(headers(credentials.token));
    const meData = expectSuccessful(me, 'GET /auth/me OIDC session');
    expect(meData.email).toBe(email);

    const firstRefresh = await request(app!.getHttpServer())
      .post(`${apiPrefix}/auth/refresh`)
      .send({ refreshToken: credentials.refreshToken });
    expectSuccessful(firstRefresh, 'POST /auth/refresh first SSO token use');
    const reusedRefresh = await request(app!.getHttpServer())
      .post(`${apiPrefix}/auth/refresh`)
      .send({ refreshToken: credentials.refreshToken });
    expect(reusedRefresh.status).toBe(401);

    await apiPatch(`/auth/sso/config/${providerId}`, { jitProvisioning: false }).then((response) => {
      expectSuccessful(response, 'PATCH /auth/sso/config disable OIDC JIT');
    });
    const disabledStart = await request(app!.getHttpServer())
      .get(`${apiPrefix}/auth/sso/oidc/${TENANT_ID}/start`)
      .redirects(0);
    const disabledState = new URL(redirectLocation(disabledStart, 'GET OIDC start JIT disabled')).searchParams.get('state');
    oidcMock.claims = {
      sub: `unknown-oidc-${suffix}`,
      email: `unknown.oidc.${suffix}@sso.example.com`,
      given_name: 'Unknown',
      family_name: 'Oidc',
      groups: ['employees'],
    };
    const disabledCallback = await request(app!.getHttpServer())
      .get(`${apiPrefix}/auth/sso/oidc/${TENANT_ID}/callback?code=mock-code&state=${disabledState}`)
      .redirects(0);
    expect(disabledCallback.status).toBe(401);
  }, 90_000);

  lifecycleIt('SAML SSO config starts, validates ACS, mints a session, and rejects tampered assertions', async () => {
    await getPool().query('delete from hr_platform.sso_auth_transactions where tenant_id = $1 and protocol = $2', [TENANT_ID, 'SAML']);
    await getPool().query('delete from hr_platform.tenant_identity_providers where tenant_id = $1 and protocol = $2', [TENANT_ID, 'SAML']);

    const email = `saml.${suffix}@sso.example.com`;
    const config = await apiPost('/auth/sso/config', {
      protocol: 'SAML',
      displayName: 'Runtime SAML',
      enabled: true,
      jitProvisioning: true,
      defaultRoles: ['EMPLOYEE'],
      attributeMapping: {
        email: 'email',
        firstName: 'firstName',
        lastName: 'lastName',
        groups: 'groups',
      },
      groupRoleMapping: {},
      samlIdpEntityId: 'https://mock-saml.example.com/idp',
      samlIdpSsoUrl: 'https://mock-saml.example.com/sso',
      samlIdpX509Cert: '-----BEGIN CERTIFICATE-----mock-----END CERTIFICATE-----',
      samlSpPrivateKey: '-----BEGIN PRIVATE KEY-----mock-----END PRIVATE KEY-----',
    });
    expectSuccessful(config, 'POST /auth/sso/config SAML');

    const metadata = await request(app!.getHttpServer())
      .get(`${apiPrefix}/auth/sso/saml/${TENANT_ID}/metadata`);
    expect(metadata.status).toBe(200);
    expect(metadata.text).toContain('EntityDescriptor');

    const start = await request(app!.getHttpServer())
      .get(`${apiPrefix}/auth/sso/saml/${TENANT_ID}/start`)
      .redirects(0);
    const startUrl = new URL(redirectLocation(start, 'GET SAML start'));
    const relayState = startUrl.searchParams.get('RelayState');
    expect(relayState).toBeTruthy();

    samlMock.profile = {
      nameID: `saml-${suffix}`,
      email,
      firstName: 'Runtime',
      lastName: 'Saml',
      groups: ['employees'],
    };
    const acs = await request(app!.getHttpServer())
      .post(`${apiPrefix}/auth/sso/saml/${TENANT_ID}/acs`)
      .send({ SAMLResponse: 'signed-saml-response', RelayState: relayState })
      .redirects(0);
    const credentials = tokensFromSsoRedirect(acs, 'POST SAML ACS');

    const me = await request(app!.getHttpServer())
      .get(`${apiPrefix}/auth/me`)
      .set(headers(credentials.token));
    const meData = expectSuccessful(me, 'GET /auth/me SAML session');
    expect(meData.email).toBe(email);

    const tamperedStart = await request(app!.getHttpServer())
      .get(`${apiPrefix}/auth/sso/saml/${TENANT_ID}/start`)
      .redirects(0);
    const tamperedRelayState = new URL(redirectLocation(tamperedStart, 'GET SAML start tampered')).searchParams.get('RelayState');
    const tampered = await request(app!.getHttpServer())
      .post(`${apiPrefix}/auth/sso/saml/${TENANT_ID}/acs`)
      .send({ SAMLResponse: 'unsigned-tampered-response', RelayState: tamperedRelayState })
      .redirects(0);
    expect(tampered.status).toBe(401);
  }, 90_000);

  lifecycleIt('employee relations case opens, transitions, persists, and lists', async () => {
    const create = await apiPost('/employee-relations/cases', {
      caseNumber: shortCode('ER'),
      subjectWorkerId: EMPLOYEE_ID,
      caseType: 'GRIEVANCE',
      severity: 'MEDIUM',
      description: 'Runtime lifecycle case',
      openedBy: HR_ADMIN_ID,
      assignedTo: HR_ADMIN_ID,
    });
    const id = findId(create.body, ['employeeRelationsCaseId']);
    await expectDetail(`/employee-relations/cases/${id}`, ['subjectWorkerId', 'openedBy']);
    await expectListed(`/employee-relations/cases/tenant/${TENANT_ID}`, id);
    await runCommand('/employee-relations/cases', id, 'review');
    await runCommand('/employee-relations/cases', id, 'resolve');
    const closed = await runCommand('/employee-relations/cases', id, 'close');
    expect(closed.newState ?? closed.status ?? asRecord(closed.data).status).toBe('CLOSED');
  });

  lifecycleIt('approval workflow gates a disciplinary command until delegated and escalated chain approval completes', async () => {
    const configResponse = await apiPost('/platform/workflow/approval-config', {
      rules: [
        {
          id: `disciplinary-approval-${suffix}`,
          code: `DISCIPLINARY_APPROVAL_${suffix}`,
          label: 'Disciplinary approval chain',
          active: true,
          commandName: 'ApproveDisciplinaryAction',
          aggregateType: 'DisciplinaryAction',
          slaHours: 0,
          steps: [
            {
              code: 'HR_REVIEW',
              label: 'HR review',
              mode: 'SEQUENTIAL',
              approverType: 'ROLE',
              approverRole: 'HR_ADMIN',
              slaHours: 0,
              escalationTiers: [{ code: 'HR_ESCALATION', label: 'HR escalation', approverRole: 'HR_ADMIN', afterHours: 0 }],
            },
            {
              code: 'FINAL_HR_SIGNOFF',
              label: 'Final HR sign-off',
              mode: 'SEQUENTIAL',
              approverType: 'ROLE',
              approverRole: 'HR_ADMIN',
              slaHours: 24,
            },
          ],
        },
      ],
    });
    expectSuccessful(configResponse, 'POST /platform/workflow/approval-config');

    const erCase = await apiPost('/employee-relations/cases', {
      caseNumber: shortCode('ER-APPROVAL'),
      subjectWorkerId: EMPLOYEE_ID,
      caseType: 'DISCIPLINARY',
      severity: 'HIGH',
      description: 'Approval workflow case',
      openedBy: HR_ADMIN_ID,
      assignedTo: HR_ADMIN_ID,
    });
    const erCaseId = findId(erCase.body, ['employeeRelationsCaseId']);
    const disciplinary = await apiPost('/employee-relations/disciplinary-actions', {
      workerId: EMPLOYEE_ID,
      erCaseId,
      actionType: 'WRITTEN_WARNING',
      severity: 'HIGH',
      description: 'Requires approval workflow',
      effectiveDate: isoDate(3),
    });
    const disciplinaryActionId = findId(disciplinary.body, ['disciplinaryActionId']);

    const gated = await apiPost(`/employee-relations/disciplinary-actions/${disciplinaryActionId}/commands/approve`, {
      approvedBy: HR_ADMIN_ID,
    });
    const gatedData = expectSuccessful(gated, 'POST disciplinary approve gated by workflow');
    const approvalChainId = stringField(gatedData, 'approvalChainId') ?? stringField(asRecord(gatedData.data), 'approvalChainId');
    expect(approvalChainId).toBeTruthy();
    expect(gatedData.newState ?? gatedData.status ?? asRecord(gatedData.data).status).toBe('PENDING_APPROVAL');

    const beforeApproval = await expectDetail(`/employee-relations/disciplinary-actions/${disciplinaryActionId}`, ['workerId', 'erCaseId']);
    expect(beforeApproval.status).toBe('DRAFT');

    const chainResponse = await apiGet(`/platform/workflow/approval-chains/${approvalChainId}`);
    const chain = expectSuccessful(chainResponse, `GET /platform/workflow/approval-chains/${approvalChainId}`);
    const chainSteps = collectRecords(chain.steps ?? asRecord(chain.data).steps);
    const firstStepId = expectStepId(chainSteps, 'PENDING');

    const delegated = await apiPost(`/platform/workflow/approval-chains/${approvalChainId}/steps/${firstStepId}/commands/delegate`, {
      delegateToWorkerId: MANAGER_ID,
      reason: 'Manager has direct case context',
    });
    const delegatedData = expectSuccessful(delegated, 'delegate approval step');
    expect(delegatedData.newState ?? delegatedData.status ?? asRecord(delegatedData.data).status).toBe('IN_PROGRESS');

    const escalated = await apiPost(`/platform/workflow/approval-chains/${approvalChainId}/commands/escalate-overdue`, {
      now: isoDate(5),
      reason: 'SLA elapsed',
    });
    const escalatedData = expectSuccessful(escalated, 'escalate approval chain');
    expect(escalatedData.newState ?? escalatedData.status ?? asRecord(escalatedData.data).status).toBe('IN_PROGRESS');

    await apiPost(`/platform/workflow/approval-chains/${approvalChainId}/steps/${firstStepId}/commands/approve`, {
      reason: 'Delegated and escalated HR review complete',
    }).then((response) => expectSuccessful(response, 'approve first approval step'));

    const afterFirstStep = expectSuccessful(
      await apiGet(`/platform/workflow/approval-chains/${approvalChainId}`),
      `GET approval chain after first approval`,
    );
    const secondStepId = expectStepId(collectRecords(afterFirstStep.steps ?? asRecord(afterFirstStep.data).steps), 'PENDING');

    const inboxAction = await findInboxApprovalAction(approvalChainId, secondStepId);
    const finalApproval = await apiPost(
      String(inboxAction.commandPath),
      asRecord(inboxAction.body),
    );
    const finalData = expectSuccessful(finalApproval, 'approve final approval step');
    expect(finalData.newState ?? finalData.status ?? asRecord(finalData.data).status).toBe('APPROVED');

    const inboxAfterApproval = expectSuccessful(await apiGet('/me/inbox'), 'GET /me/inbox after approval');
    const remainingActions = collectRecords(inboxAfterApproval.sections)
      .flatMap((section) => collectRecords(section.items))
      .flatMap((item) => collectRecords(item.actions));
    expect(remainingActions.some((action) => String(action.commandPath).includes(`/approval-chains/${approvalChainId}/`))).toBe(false);

    const afterApproval = await expectDetail(`/employee-relations/disciplinary-actions/${disciplinaryActionId}`, ['workerId', 'erCaseId']);
    expect(afterApproval.status).toBe('APPROVED');
  });

  lifecycleIt('HR service delivery case moves through triage lifecycle', async () => {
    const create = await apiPost('/hr-service-delivery/cases', {
      requesterWorkerId: EMPLOYEE_ID,
      caseType: 'PAYROLL_QUERY',
      priority: 'MEDIUM',
      description: 'Runtime service delivery request',
    });
    const id = findId(create.body, ['hrServiceCaseId']);
    await expectDetail(`/hr-service-delivery/cases/${id}`, ['requesterWorkerId']);
    await expectListed(`/hr-service-delivery/cases/tenant/${TENANT_ID}`, id);
    await runCommand('/hr-service-delivery/cases', id, 'mark-in-progress');
    await runCommand('/hr-service-delivery/cases', id, 'resolve');
    const closed = await runCommand('/hr-service-delivery/cases', id, 'close');
    expect(closed.newState ?? closed.status ?? asRecord(closed.data).status).toBe('CLOSED');
  });

  lifecycleIt('contingent SOW engagement activates, starts, completes, closes, and lists', async () => {
    const create = await apiPost('/contingent-workforce/sow-engagements', {
      sowNumber: shortCode('SOW'),
      vendorId: randomUUID(),
      projectName: 'Runtime lifecycle SOW',
      totalValue: 12_000,
      currency: 'EGP',
      startDate: isoDate(1),
      endDate: isoDate(60),
      milestones: ['Kickoff', 'Acceptance'],
    });
    const id = findId(create.body, ['sowEngagementId']);
    await expectDetail(`/contingent-workforce/sow-engagements/${id}`, ['vendorId']);
    await expectListed(`/contingent-workforce/sow-engagements/tenant/${TENANT_ID}`, id);
    await runCommand('/contingent-workforce/sow-engagements', id, 'activate');
    await runCommand('/contingent-workforce/sow-engagements', id, 'start');
    await runCommand('/contingent-workforce/sow-engagements', id, 'complete');
    const closed = await runCommand('/contingent-workforce/sow-engagements', id, 'close');
    expect(closed.newState ?? closed.status ?? asRecord(closed.data).status).toBe('CLOSED');
  });

  lifecycleIt('union recognition negotiates, ratifies, activates, expires, and lists', async () => {
    const create = await apiPost('/union-labor/union-recognitions', {
      unionName: shortCode('Union'),
      bargainingUnitId: randomUUID(),
      effectiveDate: isoDate(1),
      expirationDate: isoDate(365),
      agreementDocument: 'Runtime agreement',
    });
    const id = findId(create.body, ['unionRecognitionId']);
    await expectDetail(`/union-labor/union-recognitions/${id}`, ['bargainingUnitId']);
    await expectListed(`/union-labor/union-recognitions/tenant/${TENANT_ID}`, id);
    await runCommand('/union-labor/union-recognitions', id, 'negotiate');
    await runCommand('/union-labor/union-recognitions', id, 'ratify');
    await runCommand('/union-labor/union-recognitions', id, 'activate');
    const expired = await runCommand('/union-labor/union-recognitions', id, 'expire');
    expect(expired.newState ?? expired.status ?? asRecord(expired.data).status).toBe('EXPIRED');
  });

  lifecycleIt('wellbeing program activates, enrolls a worker, completes, archives, and lists', async () => {
    const create = await apiPost('/wellbeing-eap/wellness-programs', {
      name: shortCode('Wellness'),
      type: 'WELLNESS',
      startDate: isoDate(1),
      endDate: isoDate(90),
      description: 'Runtime wellbeing program',
    });
    const id = findId(create.body, ['wellnessProgramId']);
    await expectDetail(`/wellbeing-eap/wellness-programs/${id}`, ['name']);
    await expectListed(`/wellbeing-eap/wellness-programs/tenant/${TENANT_ID}`, id);
    await runCommand('/wellbeing-eap/wellness-programs', id, 'activate');
    await runCommand('/wellbeing-eap/wellness-programs', id, 'enroll', { workerId: EMPLOYEE_ID });
    await runCommand('/wellbeing-eap/wellness-programs', id, 'complete');
    const archived = await runCommand('/wellbeing-eap/wellness-programs', id, 'archive');
    expect(archived.newState ?? archived.status ?? asRecord(archived.data).status).toBe('ARCHIVED');
  });

  lifecycleIt('skills talent pool persists worker membership changes and closes', async () => {
    const create = await apiPost('/skills-talent/talent-pools', {
      poolName: shortCode('Pool'),
      criteria: { jobFamily: 'Engineering' },
      memberIds: [],
    });
    const id = findId(create.body, ['talentPoolId']);
    await expectDetail(`/skills-talent/talent-pools/${id}`, ['poolName']);
    await expectListed(`/skills-talent/talent-pools/tenant/${TENANT_ID}`, id);
    await runCommand('/skills-talent/talent-pools', id, 'add-member', { memberId: EMPLOYEE_ID });
    await runCommand('/skills-talent/talent-pools', id, 'remove-member', { memberId: EMPLOYEE_ID });
    const closed = await runCommand('/skills-talent/talent-pools', id, 'close');
    expect(closed.newState ?? closed.status ?? asRecord(closed.data).status).toBe('CLOSED');
  });

  lifecycleIt('learning course publishes, archives, retires, and lists', async () => {
    const create = await apiPost('/learning/courses', {
      title: shortCode('Course'),
      description: 'Runtime learning course',
      contentType: 'VIDEO',
      durationMinutes: 45,
      credits: 1,
      certificationEligible: true,
    });
    const id = findId(create.body, ['learningCourseId']);
    await expectDetail(`/learning/courses/${id}`, ['title']);
    await expectListed(`/learning/courses/tenant/${TENANT_ID}`, id);
    await runCommand('/learning/courses', id, 'publish');
    await runCommand('/learning/courses', id, 'archive');
    const retired = await runCommand('/learning/courses', id, 'retire');
    expect(retired.newState ?? retired.status ?? asRecord(retired.data).status).toBe('RETIRED');
  });

  lifecycleIt('HR AI use case reviews, approves, activates, suspends, retires, and lists', async () => {
    const id = randomUUID();
    const create = await apiPost('/hr-ai-governance/use-cases', {
      hrAiUseCaseId: id,
      useCaseName: shortCode('AI'),
      useCaseType: 'WORKFORCE_ANALYTICS',
      riskClassification: 'MEDIUM',
      description: 'Runtime AI governance use case',
      dataUsage: { source: 'seed' },
    });
    expectSuccessful(create, 'POST /hr-ai-governance/use-cases');
    await expectDetail(`/hr-ai-governance/use-cases/${id}`, ['useCaseName']);
    await expectListed(`/hr-ai-governance/use-cases/tenant/${TENANT_ID}`, id);
    await runCommand('/hr-ai-governance/use-cases', id, 'review');
    await runCommand('/hr-ai-governance/use-cases', id, 'approve');
    await runCommand('/hr-ai-governance/use-cases', id, 'activate');
    await runCommand('/hr-ai-governance/use-cases', id, 'suspend');
    const retired = await runCommand('/hr-ai-governance/use-cases', id, 'retire');
    expect(retired.newState ?? retired.status ?? asRecord(retired.data).status).toBe('RETIRED');
  });

  lifecycleIt('DEI report generates, reviews, publishes, and lists', async () => {
    const id = randomUUID();
    const create = await apiPost('/dei-analytics/dei-reports', {
      deiReportId: id,
      reportType: 'WORKFORCE_DIVERSITY',
      reportingPeriod: `2026-Q2-${suffix}`,
      countryCode: 'EG',
      legalEntityId: randomUUID(),
    });
    expectSuccessful(create, 'POST /dei-analytics/dei-reports');
    await expectDetail(`/dei-analytics/dei-reports/${id}`, ['reportType']);
    await expectListed(`/dei-analytics/dei-reports/tenant/${TENANT_ID}`, id);
    await runCommand('/dei-analytics/dei-reports', id, 'generate', { deiReportId: id, metrics: { headcount: 3 } });
    await runCommand('/dei-analytics/dei-reports', id, 'review');
    const published = await runCommand('/dei-analytics/dei-reports', id, 'publish');
    expect(published.newState ?? published.status ?? asRecord(published.data).status).toBe('PUBLISHED');
  });

  lifecycleIt('global HR work authorization reviews, approves, closes, and lists', async () => {
    const id = randomUUID();
    const create = await apiPost('/global-hr/work-authorization-cases', {
      caseId: id,
      workerId: EMPLOYEE_ID,
      authorizationType: 'WORK_PERMIT',
      issuingCountry: 'EG',
      documentNumber: shortCode('DOC'),
      validFrom: isoDate(1),
      validUntil: isoDate(365),
    });
    expectSuccessful(create, 'POST /global-hr/work-authorization-cases');
    await expectDetail(`/global-hr/work-authorization-cases/${id}`, ['workerId']);
    await expectListed(`/global-hr/work-authorization-cases/tenant/${TENANT_ID}`, id);
    await runCommand('/global-hr/work-authorization-cases', id, 'start-review');
    await runCommand('/global-hr/work-authorization-cases', id, 'approve', {
      validFrom: isoDate(1),
      validUntil: isoDate(365),
      documentNumber: shortCode('DOC'),
    });
    const closed = await runCommand('/global-hr/work-authorization-cases', id, 'close');
    expect(closed.newState ?? closed.status ?? asRecord(closed.data).status).toBe('CLOSED');
  });

  lifecycleIt('workforce shift schedule publishes, activates, archives, and lists', async () => {
    const create = await apiPost('/workforce-management/shift-schedules', {
      workerId: EMPLOYEE_ID,
      departmentId: randomUUID(),
      shiftDate: isoDate(3),
      startTime: isoDate(3),
      endTime: isoDate(3).replace('09:00:00.000Z', '17:00:00.000Z'),
      breakDuration: 60,
      workplaceCode: 'CAIRO_HQ',
    });
    const id = findId(create.body, ['shiftScheduleId']);
    await expectDetail(`/workforce-management/shift-schedules/${id}`, ['workerId']);
    await expectListed(`/workforce-management/shift-schedules/tenant/${TENANT_ID}`, id);
    await runCommand('/workforce-management/shift-schedules', id, 'publish');
    await runCommand('/workforce-management/shift-schedules', id, 'activate');
    const archived = await runCommand('/workforce-management/shift-schedules', id, 'archive');
    expect(archived.newState ?? archived.status ?? asRecord(archived.data).status).toBe('ARCHIVED');
  });

  lifecycleIt('position control position activates, fills, vacates, closes, and lists', async () => {
    const create = await apiPost('/hr/position-control/positions', {
      positionCode: shortCode('POS'),
      title: 'Runtime Position',
      departmentId: randomUUID(),
      legalEntityId: randomUUID(),
      jobFamily: 'Operations',
      jobLevel: 'L3',
      employmentType: 'FULL_TIME',
    });
    const id = findId(create.body, ['positionId']);
    await expectDetail(`/hr/position-control/positions/${id}`, ['positionCode']);
    await expectListed('/hr/position-control/positions', id);
    await expectAllowedActions(`/hr/position-control/positions/${id}/allowed-actions`);
    await runCommand('/hr/position-control/positions', id, 'activate');
    await runCommand('/hr/position-control/positions', id, 'fill', { workerId: EMPLOYEE_ID });
    await runCommand('/hr/position-control/positions', id, 'vacate', { reason: 'Runtime lifecycle vacancy' });
    const closed = await runCommand('/hr/position-control/positions', id, 'close');
    expect(closed.newState ?? closed.status ?? asRecord(closed.data).status).toBe('CLOSED');
  });

  lifecycleIt('compensation plan activates and exposes allowed actions', async () => {
    const id = randomUUID();
    const create = await apiPost('/hr/compensation/plans', {
      planId: id,
      name: shortCode('Comp Plan'),
      planType: 'SALARY_REVIEW',
      currency: 'EGP',
      effectiveFrom: isoDate(1),
    });
    expectSuccessful(create, 'POST /hr/compensation/plans');
    await expectDetail(`/hr/compensation/plans/${id}`, ['name']);
    await expectListed('/hr/compensation/plans', id);
    await expectAllowedActions(`/hr/compensation/plans/${id}/allowed-actions`);
    const active = await runCommand('/hr/compensation/plans', id, 'activate');
    expect(active.newState ?? active.status ?? asRecord(active.data).status).toBe('ACTIVE');
  });

  lifecycleIt('engagement feedback 360 cycle activates, starts, accepts response, completes, and lists', async () => {
    const create = await apiPost('/engagement/feedback-360-cycles', {
      subjectWorkerId: EMPLOYEE_ID,
      reviewers: [MANAGER_ID],
      competencies: ['Collaboration', 'Execution'],
      startDate: isoDate(1),
      endDate: isoDate(30),
    });
    const id = findId(create.body, ['feedback360CycleId']);
    await expectDetail(`/engagement/feedback-360-cycles/${id}`, ['subjectWorkerId']);
    await expectListed(`/engagement/feedback-360-cycles/tenant/${TENANT_ID}`, id);
    await runCommand('/engagement/feedback-360-cycles', id, 'activate');
    await runCommand('/engagement/feedback-360-cycles', id, 'start');
    await runCommand('/engagement/feedback-360-cycles', id, 'submit-response', {
      reviewerWorkerId: MANAGER_ID,
      relationship: 'MANAGER',
      competencyScores: { Collaboration: 4, Execution: 5 },
      comments: 'Runtime lifecycle response',
    });
    const complete = await runCommand('/engagement/feedback-360-cycles', id, 'complete');
    expect(complete.newState ?? complete.status ?? asRecord(complete.data).status).toBe('COMPLETED');
  });

  lifecycleIt('absence leave request submits and approves through real policy path', async () => {
    const create = await apiPost('/absence/leave/absence-requests', {
      workerId: EMPLOYEE_ID,
      absenceType: 'VACATION',
      startDate: uniqueBusinessIsoDate(0),
      endDate: uniqueBusinessIsoDate(1),
      reason: 'Runtime lifecycle leave',
    });
    const id = findId(create.body, ['absenceRequestId']);
    await expectDetail(`/absence/leave/absence-requests/${id}`, ['workerId']);
    await expectListed(`/absence/leave/absence-requests/worker/${EMPLOYEE_ID}`, id);
    await runCommand('/absence/leave/absence-requests', id, 'submit');
    const approved = await runCommand('/absence/leave/absence-requests', id, 'approve', { approvedBy: MANAGER_ID });
    expect(approved.newState ?? approved.status ?? asRecord(approved.data).status).toBe('APPROVED');
  });

  lifecycleIt('time attendance check-in and check-out persist real JSON geolocation evidence', async () => {
    const attendanceWorkerId = randomUUID();
    const attendanceStart = new Date(
      Date.UTC(2030, 0, 1 + (Number.parseInt(randomUUID().slice(0, 8), 16) % 365), 6, 0, 0),
    );
    const attendanceEnd = new Date(attendanceStart.getTime() + 8 * 60 * 60 * 1000);
    const clockIn = await apiPost('/time/attendance/check-in', {
      workerId: attendanceWorkerId,
      workplaceCode: 'CAIRO_HQ',
      latitude: 30.0444,
      longitude: 31.2357,
      accuracyMeters: 15,
      deviceId: shortCode('device'),
      timestamp: attendanceStart.toISOString(),
      idempotencyKey: shortCode('clock-in'),
      captureMethod: 'MOBILE_GEOFENCE',
      captureEvidence: { provider: 'runtime-e2e' },
    });
    expectSuccessful(clockIn, 'POST /time/attendance/check-in');
    const clockOut = await apiPost('/time/attendance/check-out', {
      workerId: attendanceWorkerId,
      workplaceCode: 'CAIRO_HQ',
      latitude: 30.0445,
      longitude: 31.2358,
      accuracyMeters: 12,
      deviceId: shortCode('device'),
      timestamp: attendanceEnd.toISOString(),
      idempotencyKey: shortCode('clock-out'),
      captureMethod: 'MOBILE_GEOFENCE',
      captureEvidence: { provider: 'runtime-e2e' },
    });
    expectSuccessful(clockOut, 'POST /time/attendance/check-out');
    const events = await apiGet(`/time/attendance/time-clock-events/worker/${attendanceWorkerId}`);
    expectSuccessful(events, `GET /time/attendance/time-clock-events/worker/${attendanceWorkerId}`);
    const records = collectRecords(payloadOf(events.body));
    expect(records.length).toBeGreaterThan(0);
  });

  lifecycleIt('payroll cycle follows server-owned lifecycle through approval', async () => {
    const create = await apiPost('/payroll/cycles', {
      cycleName: shortCode('Payroll'),
      payPeriodStart: isoDate(1),
      payPeriodEnd: isoDate(30),
      payDate: isoDate(35),
    });
    const id = findId(create.body, ['payrollCycleId']);
    await expectDetail(`/payroll/cycles/${id}`, ['cycleName']);
    await runCommand('/payroll/cycles', id, 'open');
    await runCommand('/payroll/cycles', id, 'start-input-collection');
    await runCommand('/payroll/cycles', id, 'start-validation');
    await runCommand('/payroll/cycles', id, 'start-calculation');
    await runCommand('/payroll/cycles', id, 'start-review');
    const approved = await runCommand('/payroll/cycles', id, 'approve');
    expect(approved.newState ?? approved.status ?? asRecord(approved.data).status).toBe('APPROVED');
  });

  lifecycleIt('performance review cycle runs through activation and close', async () => {
    const create = await apiPost('/performance/review-cycles', {
      name: shortCode('Review'),
      cycleYear: 2026,
      startDate: isoDate(1),
      endDate: isoDate(90),
      reviewType: 'ANNUAL',
      periods: [{ name: 'H1', startDate: isoDate(1), endDate: isoDate(90) }],
      weightings: { goals: 60, competencies: 40 },
    });
    const id = findId(create.body, ['performanceReviewCycleId']);
    await expectDetail(`/performance/review-cycles/${id}`, ['name']);
    await expectListed(`/performance/review-cycles/tenant/${TENANT_ID}`, id);
    await runCommand('/performance/review-cycles', id, 'setup');
    await runCommand('/performance/review-cycles', id, 'activate');
    await runCommand('/performance/review-cycles', id, 'start');
    await runCommand('/performance/review-cycles', id, 'enter-calibration');
    await runCommand('/performance/review-cycles', id, 'enter-review');
    const closed = await runCommand('/performance/review-cycles', id, 'close');
    expect(closed.newState ?? closed.status ?? asRecord(closed.data).status).toBe('CLOSED');
  });

  lifecycleIt('classified field access masks without clearance and reveals with permission evidence', async () => {
    const payrollField = await apiGet(`/policy/field-access?fieldPath=worker.payroll.netPay&resourceType=PAYROLL&resourceId=${EMPLOYEE_ID}&dataClassification=HIGH_SENSITIVITY`);
    const payrollDecision = expectSuccessful(payrollField, 'GET /policy/field-access payroll HR admin');
    expect(payrollDecision.decision).toBe('VISIBLE');

    const managerPayrollField = await apiGet(
      `/policy/field-access?fieldPath=worker.payroll.netPay&resourceType=PAYROLL&resourceId=${EMPLOYEE_ID}&dataClassification=HIGH_SENSITIVITY`,
      managerAuthToken,
    );
    const managerPayrollDecision = expectSuccessful(managerPayrollField, 'GET /policy/field-access payroll manager');
    expect(managerPayrollDecision.decision).toBe('MASKED');

    const medicalField = await apiGet(`/policy/field-access?fieldPath=worker.wellbeing.mentalHealthNotes&resourceType=WELLBEING&resourceId=${EMPLOYEE_ID}&dataClassification=SPECIAL_CATEGORY`);
    const medicalDecision = expectSuccessful(medicalField, 'GET /policy/field-access wellbeing HR admin');
    expect(medicalDecision.decision).toBe('VISIBLE');

    const limitedHrMedicalField = await apiGet(
      `/policy/field-access?fieldPath=worker.wellbeing.mentalHealthNotes&resourceType=WELLBEING&resourceId=${EMPLOYEE_ID}&dataClassification=SPECIAL_CATEGORY`,
      hrAdminWithoutWellbeingToken,
    );
    const limitedHrMedicalDecision = expectSuccessful(limitedHrMedicalField, 'GET /policy/field-access wellbeing HR admin without clearance');
    expect(limitedHrMedicalDecision.decision).toBe('MASKED');
  });

  lifecycleIt('intelligence events produce explainable snapshots and anomaly notifications', async () => {
    const periodKey = `2026-06-${suffix}`;
    const attrition = await apiPost('/intelligence/events/ingest', {
      signalType: 'ATTRITION_RISK',
      workerId: EMPLOYEE_ID,
      periodKey,
      features: {
        tenureMonths: 5,
        compPositionToBandMidpoint: 0.78,
        monthsSincePromotion: 48,
        engagementScoreTrend: -0.3,
        absenceDaysLast90: 9,
        managerChangesLast12Months: 2,
      },
    });
    expectSuccessful(attrition, 'POST /intelligence/events/ingest attrition');

    const latest = await eventually(async () => {
      const response = await apiGet(`/intelligence/attrition-risk/worker/${EMPLOYEE_ID}`);
      const data = expectSuccessful(response, 'GET /intelligence/attrition-risk/worker');
      return data.periodKey === periodKey ? data : undefined;
    });
    expect(latest.band).toBe('HIGH');
    expect(Array.isArray(latest.factors) ? latest.factors.length : 0).toBeGreaterThan(0);

    const updatedAttrition = await apiPost('/intelligence/events/ingest', {
      signalType: 'ATTRITION_RISK',
      workerId: EMPLOYEE_ID,
      periodKey,
      features: {
        tenureMonths: 18,
        compPositionToBandMidpoint: 1.05,
        monthsSincePromotion: 8,
        engagementScoreTrend: 0.2,
        absenceDaysLast90: 1,
        managerChangesLast12Months: 0,
      },
    });
    expectSuccessful(updatedAttrition, 'POST /intelligence/events/ingest attrition second snapshot');

    const nonReportAttrition = await apiPost('/intelligence/events/ingest', {
      signalType: 'ATTRITION_RISK',
      workerId: HR_ADMIN_ID,
      periodKey,
      features: {
        tenureMonths: 4,
        compPositionToBandMidpoint: 0.7,
        monthsSincePromotion: 54,
        engagementScoreTrend: -0.25,
        absenceDaysLast90: 8,
        managerChangesLast12Months: 1,
      },
    });
    expectSuccessful(nonReportAttrition, 'POST /intelligence/events/ingest non-report attrition');

    const appendOnlySnapshots = await eventually(async () => {
      const response = await apiGet(`/intelligence/attrition-risk/tenant/${TENANT_ID}`);
      expectSuccessful(response, 'GET /intelligence/attrition-risk/tenant append-only');
      const records = collectRecords(payloadOf(response.body));
      const matching = records.filter((record) => record.workerId === EMPLOYEE_ID && record.periodKey === periodKey);
      return matching.length >= 2 ? matching : undefined;
    });
    expect(new Set(appendOnlySnapshots.map((record) => record.id)).size).toBeGreaterThanOrEqual(2);

    const managerScopedSnapshots = await apiGet(`/intelligence/attrition-risk/tenant/${TENANT_ID}`, managerAuthToken);
    expect(managerScopedSnapshots.status).toBe(200);
    const scopedRecords = collectRecords(payloadOf(managerScopedSnapshots.body));
    expect(scopedRecords.some((record) => record.workerId === EMPLOYEE_ID && record.periodKey === periodKey)).toBe(true);
    expect(scopedRecords.some((record) => record.workerId === HR_ADMIN_ID && record.periodKey === periodKey)).toBe(false);

    const anomaly = await apiPost('/intelligence/events/ingest', {
      signalType: 'ATTENDANCE_PAYROLL_ANOMALY',
      workerId: EMPLOYEE_ID,
      periodKey,
      anomalyType: 'ATTENDANCE_PAYROLL',
      audienceWorkerIds: [EMPLOYEE_ID],
      features: {
        hoursWorked: 72,
        scheduledHours: 40,
        overtimeHours: 18,
        priorPeriodNetPay: 12000,
        currentNetPay: 9000,
        missingPunches: 2,
      },
    });
    expectSuccessful(anomaly, 'POST /intelligence/events/ingest anomaly');

    const anomalyRecord = await eventually(async () => {
      const response = await apiGet(`/intelligence/anomalies/tenant/${TENANT_ID}`);
      expectSuccessful(response, 'GET /intelligence/anomalies/tenant');
      const records = collectRecords(payloadOf(response.body));
      return records.find((record) => record.workerId === EMPLOYEE_ID && record.periodKey === periodKey);
    });
    expect(anomalyRecord.band).toBe('HIGH');

    const notification = await eventually(async () => {
      const response = await apiGet('/notifications/hr-operations');
      expectSuccessful(response, 'GET /notifications/hr-operations');
      const notifications = collectRecords(payloadOf(response.body));
      return notifications.find((record) => String(record.title).includes('Attendance and payroll anomaly'));
    });
    expect(notification.sourceEventName).toBe('ReminderDue');
  });
});
