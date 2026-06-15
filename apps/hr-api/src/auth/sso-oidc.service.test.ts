import bcrypt from 'bcrypt';
import { describe, expect, it } from 'vitest';
import { AuthService, type AuthSession } from './auth.service.js';
import type { AuthSessionStoreLike } from './auth-session.store.js';
import type { AuthTokenRecord } from './auth-token.repository.js';
import { SsoOidcService, type OidcClientLike } from './sso-oidc.service.js';
import type { SsoAuthTransactionRepositoryLike, SsoAuthTransactionRecord } from './sso-auth-transaction.repository.js';
import type { TenantIdentityProviderRecord } from './tenant-identity-provider.repository.js';
import type { CreateAuthUserInput, StoredAuthUser } from './users.repository.js';
import type { AppConfig } from '../config/app.config.js';
import { randomUUID } from 'node:crypto';

const tenantId = '00000000-0000-0000-0000-000000000001';
const hrAdminId = '00000000-0000-0000-0000-000000000010';

const testConfig: AppConfig = {
  port: 3001,
  nodeEnv: 'test',
  databaseUrl: 'postgresql://localhost/test',
  redisUrl: '',
  kafkaBrokers: [],
  jwtSecret: 'test-secret-that-is-long-enough',
  jwtExpiresIn: '1h',
  refreshTokenExpiresIn: '7d',
  mfaRequired: false,
  bcryptCost: 10,
  loginMaxAttempts: 5,
  lockoutMinutes: 15,
  apiKeyHeader: 'X-API-Key',
  corsOrigins: [],
  logLevel: 'silent',
  otelEnabled: false,
  otelServiceName: 'hr-api-test',
};

describe('SsoOidcService', () => {
  it('starts an OIDC authorization transaction with PKCE, state, and nonce', async () => {
    const harness = await buildHarness();

    const result = await harness.service.start(tenantId, 'http://localhost:3001');

    expect(result.redirectUrl).toContain('https://idp.example.com/authorize');
    expect(result.redirectUrl).toContain('state=');
    expect(result.redirectUrl).toContain('nonce=');
    expect(result.redirectUrl).toContain('code_challenge=');
    expect(harness.transactions.records[0]).toEqual(
      expect.objectContaining({
        tenantId,
        protocol: 'OIDC',
        pkceVerifier: expect.any(String),
        nonce: expect.any(String),
      }),
    );
  });

  it('validates callback claims, JIT provisions an IdP user, and mints an HRM session', async () => {
    const harness = await buildHarness();
    const start = await harness.service.start(tenantId, 'http://localhost:3001');
    const state = new URL(start.redirectUrl).searchParams.get('state')!;
    harness.oidc.claims = {
      sub: 'okta-subject-1',
      email: 'new.sso@example.com',
      given_name: 'New',
      family_name: 'Sso',
      groups: ['employees'],
    };

    const credentials = await harness.service.callback(
      tenantId,
      new URL(`http://localhost:3001/api/v1/auth/sso/oidc/${tenantId}/callback?code=abc&state=${state}`),
    );

    expect(credentials.token).toBeTruthy();
    expect(credentials.session.mfaAuthenticated).toBe(true);
    expect(await harness.users.findByExternalId(tenantId, 'OIDC', 'okta-subject-1')).toEqual(
      expect.objectContaining({
        email: 'new.sso@example.com',
        roles: ['EMPLOYEE'],
        idpProvider: 'OIDC',
        externalId: 'okta-subject-1',
      }),
    );
  });
});

async function buildHarness() {
  const users = new InMemoryUsersRepository(await demoUsers());
  const sessions = new InMemorySessionStore();
  const tokens = new InMemoryTokenRepository();
  const auth = AuthService.createForTest({
    users,
    sessions,
    tokens,
    config: testConfig,
    tokenNotifier: { sendToken: async () => undefined },
  });
  const providerRepo = new InMemoryProviderRepository();
  const transactions = new InMemorySsoTransactionRepository();
  const oidc = new FakeOidcClient();
  return {
    users,
    sessions,
    transactions,
    oidc,
    service: new SsoOidcService(providerRepo, transactions, auth, oidc),
  };
}

async function demoUsers(): Promise<StoredAuthUser[]> {
  const passwordHash = await bcrypt.hash('Password123!', 10);
  return [
    {
      id: hrAdminId,
      email: 'hr.admin@example.com',
      firstName: 'HR',
      lastName: 'Admin',
      passwordHash,
      tenantId,
      status: 'ACTIVE',
      roles: ['HR_ADMIN'],
      permissions: ['SSO_MANAGE'],
      failedLoginCount: 0,
    },
  ];
}

class InMemoryProviderRepository {
  readonly provider: TenantIdentityProviderRecord = {
    id: 'idp-oidc',
    tenantId,
    protocol: 'OIDC',
    displayName: 'Sign in with Okta',
    enabled: true,
    jitProvisioning: true,
    defaultRoles: ['EMPLOYEE'],
    attributeMapping: {},
    groupRoleMapping: {},
    oidcIssuerUrl: 'https://idp.example.com',
    oidcClientId: 'hrm-client',
    oidcClientSecretEnc: undefined,
    oidcScopes: ['openid', 'email', 'profile'],
    aggregateVersion: 0,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  async findEnabledByProtocol(inputTenantId: string, protocol: string) {
    return inputTenantId === tenantId && protocol === 'OIDC' ? this.provider : undefined;
  }
}

class InMemorySsoTransactionRepository implements SsoAuthTransactionRepositoryLike {
  readonly records: SsoAuthTransactionRecord[] = [];

  async create(input: Omit<SsoAuthTransactionRecord, 'id' | 'createdAt' | 'consumedAt'>): Promise<SsoAuthTransactionRecord> {
    const record: SsoAuthTransactionRecord = {
      id: randomUUID(),
      createdAt: new Date().toISOString(),
      consumedAt: undefined,
      ...input,
    };
    this.records.push(record);
    return record;
  }

  async consumeByState(inputTenantId: string, state: string): Promise<SsoAuthTransactionRecord | undefined> {
    const record = this.records.find((item) => item.tenantId === inputTenantId && item.state === state && !item.consumedAt);
    if (record) record.consumedAt = new Date().toISOString();
    return record;
  }
}

class FakeOidcClient implements OidcClientLike {
  claims: Record<string, unknown> = {};

  async authorizationUrl(input: { state: string; nonce: string; codeChallenge: string }): Promise<string> {
    const url = new URL('https://idp.example.com/authorize');
    url.searchParams.set('state', input.state);
    url.searchParams.set('nonce', input.nonce);
    url.searchParams.set('code_challenge', input.codeChallenge);
    return url.toString();
  }

  async exchangeAuthorizationCode(): Promise<Record<string, unknown>> {
    return this.claims;
  }
}

class InMemoryUsersRepository {
  private readonly byId = new Map<string, StoredAuthUser>();

  constructor(seed: StoredAuthUser[]) {
    seed.forEach((user) => this.byId.set(user.id, { ...user }));
  }

  async findByEmail(inputTenantId: string, email: string): Promise<StoredAuthUser | undefined> {
    return Array.from(this.byId.values()).find(
      (user) => user.tenantId === inputTenantId && user.email === email.toLowerCase(),
    );
  }

  async findById(id: string): Promise<StoredAuthUser | undefined> {
    return this.byId.get(id);
  }

  async findByExternalId(inputTenantId: string, idpProvider: string, externalId: string): Promise<StoredAuthUser | undefined> {
    return Array.from(this.byId.values()).find(
      (user) => user.tenantId === inputTenantId && user.idpProvider === idpProvider && user.externalId === externalId,
    );
  }

  async create(input: CreateAuthUserInput): Promise<StoredAuthUser> {
    const user: StoredAuthUser = {
      id: input.id ?? randomUUID(),
      email: input.email.toLowerCase(),
      firstName: input.firstName ?? '',
      lastName: input.lastName ?? '',
      passwordHash: input.passwordHash,
      tenantId: input.tenantId,
      status: input.status ?? 'ACTIVE',
      roles: input.roles ?? [],
      permissions: input.permissions ?? [],
      failedLoginCount: 0,
      idpProvider: input.idpProvider,
      externalId: input.externalId,
    };
    this.byId.set(user.id, user);
    return user;
  }

  async createWithIdentityProvider(input: Omit<CreateAuthUserInput, 'passwordHash'> & { idpProvider: string; externalId: string }): Promise<StoredAuthUser> {
    return this.create({ ...input, passwordHash: '!', status: 'ACTIVE' });
  }

  async linkIdentityProvider(userId: string, idpProvider: string, externalId: string): Promise<StoredAuthUser | undefined> {
    const user = this.byId.get(userId);
    if (!user) return undefined;
    user.idpProvider = idpProvider;
    user.externalId = externalId;
    return user;
  }

  async updateMfaSecret(): Promise<void> {}
  async resetFailedLoginState(): Promise<void> {}
  async recordFailedLogin(): Promise<void> {}
  async updatePassword(): Promise<void> {}
}

class InMemorySessionStore implements AuthSessionStoreLike {
  private readonly sessions = new Map<string, AuthSession>();
  async create(session: AuthSession): Promise<void> { this.sessions.set(session.sessionId, { ...session }); }
  async get(sessionId: string): Promise<AuthSession | undefined> { return this.sessions.get(sessionId); }
  async save(session: AuthSession): Promise<void> { this.sessions.set(session.sessionId, { ...session }); }
  async revoke(sessionId: string): Promise<void> { this.sessions.delete(sessionId); }
}

class InMemoryTokenRepository {
  async create(): Promise<AuthTokenRecord> { throw new Error('not used'); }
  async findActiveByHash(): Promise<AuthTokenRecord | undefined> { return undefined; }
  async consume(): Promise<void> {}
}
