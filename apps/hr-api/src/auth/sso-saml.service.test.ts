import bcrypt from 'bcrypt';
import { describe, expect, it } from 'vitest';
import { AuthService, type AuthSession } from './auth.service.js';
import type { AuthSessionStoreLike } from './auth-session.store.js';
import type { AuthTokenRecord } from './auth-token.repository.js';
import type { SsoAuthTransactionRepositoryLike, SsoAuthTransactionRecord } from './sso-auth-transaction.repository.js';
import { SsoSamlService, type SamlClientLike } from './sso-saml.service.js';
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

describe('SsoSamlService', () => {
  it('starts a SAML transaction and redirects to the IdP', async () => {
    const harness = await buildHarness();

    const result = await harness.service.start(tenantId, 'http://localhost:3001');

    expect(result.redirectUrl).toContain('https://idp.example.com/saml/login');
    expect(harness.transactions.records[0]).toEqual(
      expect.objectContaining({
        tenantId,
        protocol: 'SAML',
        state: expect.any(String),
        relayState: expect.any(String),
      }),
    );
  });

  it('validates ACS response, JIT provisions a SAML user, and rejects unsigned assertions', async () => {
    const harness = await buildHarness();
    const start = await harness.service.start(tenantId, 'http://localhost:3001');
    const relayState = new URL(start.redirectUrl).searchParams.get('RelayState')!;

    harness.saml.profile = {
      nameID: 'saml-user-1',
      email: 'saml.user@example.com',
      firstName: 'Saml',
      lastName: 'User',
      groups: ['employees'],
    };
    const credentials = await harness.service.acs(tenantId, { SAMLResponse: 'signed-response', RelayState: relayState });

    expect(credentials.token).toBeTruthy();
    expect(await harness.users.findByExternalId(tenantId, 'SAML', 'saml-user-1')).toEqual(
      expect.objectContaining({ email: 'saml.user@example.com', idpProvider: 'SAML' }),
    );

    const unsignedStart = await harness.service.start(tenantId, 'http://localhost:3001');
    const unsignedRelayState = new URL(unsignedStart.redirectUrl).searchParams.get('RelayState')!;
    await expect(
      harness.service.acs(tenantId, { SAMLResponse: 'unsigned-response', RelayState: unsignedRelayState }),
    ).rejects.toThrow(/unsigned/i);
  });
});

async function buildHarness() {
  const users = new InMemoryUsersRepository(await demoUsers());
  const sessions = new InMemorySessionStore();
  const auth = AuthService.createForTest({
    users,
    sessions,
    tokens: new InMemoryTokenRepository(),
    config: testConfig,
    tokenNotifier: { sendToken: async () => undefined },
  });
  const providerRepo = new InMemoryProviderRepository();
  const transactions = new InMemorySsoTransactionRepository();
  const saml = new FakeSamlClient();
  return { users, sessions, transactions, saml, service: new SsoSamlService(providerRepo, transactions, auth, saml) };
}

async function demoUsers(): Promise<StoredAuthUser[]> {
  const passwordHash = await bcrypt.hash('Password123!', 10);
  return [{
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
  }];
}

class InMemoryProviderRepository {
  readonly provider: TenantIdentityProviderRecord = {
    id: 'idp-saml',
    tenantId,
    protocol: 'SAML',
    displayName: 'Sign in with SAML',
    enabled: true,
    jitProvisioning: true,
    defaultRoles: ['EMPLOYEE'],
    attributeMapping: {},
    groupRoleMapping: {},
    oidcScopes: [],
    samlIdpEntityId: 'urn:idp',
    samlIdpSsoUrl: 'https://idp.example.com/saml/login',
    samlIdpX509Cert: 'CERT',
    aggregateVersion: 0,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  async findEnabledByProtocol(inputTenantId: string, protocol: string) {
    return inputTenantId === tenantId && protocol === 'SAML' ? this.provider : undefined;
  }
}

class InMemorySsoTransactionRepository implements SsoAuthTransactionRepositoryLike {
  readonly records: SsoAuthTransactionRecord[] = [];
  async create(input: Omit<SsoAuthTransactionRecord, 'id' | 'createdAt' | 'consumedAt'>): Promise<SsoAuthTransactionRecord> {
    const record = { id: randomUUID(), createdAt: new Date().toISOString(), consumedAt: undefined, ...input };
    this.records.push(record);
    return record;
  }
  async findByState(inputTenantId: string, state: string): Promise<SsoAuthTransactionRecord | undefined> {
    return this.records.find((item) => item.tenantId === inputTenantId && item.state === state && !item.consumedAt);
  }
  async consumeByState(inputTenantId: string, state: string): Promise<SsoAuthTransactionRecord | undefined> {
    const record = await this.findByState(inputTenantId, state);
    if (record) record.consumedAt = new Date().toISOString();
    return record;
  }
}

class FakeSamlClient implements SamlClientLike {
  profile: Record<string, unknown> = {};
  async loginUrl(input: { relayState: string }): Promise<string> {
    const url = new URL('https://idp.example.com/saml/login');
    url.searchParams.set('RelayState', input.relayState);
    return url.toString();
  }
  async validatePostResponse(input: { samlResponse: string }): Promise<Record<string, unknown>> {
    if (input.samlResponse.includes('unsigned')) throw new Error('unsigned SAML assertion rejected');
    return this.profile;
  }
  metadata(): string { return '<EntityDescriptor />'; }
}

class InMemoryUsersRepository {
  private readonly byId = new Map<string, StoredAuthUser>();
  constructor(seed: StoredAuthUser[]) { seed.forEach((user) => this.byId.set(user.id, { ...user })); }
  async findByEmail(inputTenantId: string, email: string): Promise<StoredAuthUser | undefined> {
    return Array.from(this.byId.values()).find((user) => user.tenantId === inputTenantId && user.email === email.toLowerCase());
  }
  async findById(id: string): Promise<StoredAuthUser | undefined> { return this.byId.get(id); }
  async findByExternalId(inputTenantId: string, idpProvider: string, externalId: string): Promise<StoredAuthUser | undefined> {
    return Array.from(this.byId.values()).find((user) => user.tenantId === inputTenantId && user.idpProvider === idpProvider && user.externalId === externalId);
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
