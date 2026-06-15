import { BadRequestException, ConflictException, UnauthorizedException } from '@nestjs/common';
import { Uuid } from '@hcm/shared-kernel';
import bcrypt from 'bcrypt';
import { generate } from 'otplib';
import { describe, expect, it } from 'vitest';
import { AuthService, type AuthSession, type AuthTokenNotification } from './auth.service.js';
import type { AuthTokenRecord, AuthTokenType } from './auth-token.repository.js';
import type { AuthSessionStoreLike } from './auth-session.store.js';
import type { CreateAuthUserInput, StoredAuthUser } from './users.repository.js';
import type { AppConfig } from '../config/app.config.js';
import { randomUUID } from 'node:crypto';

const tenantId = '00000000-0000-0000-0000-000000000001';
const employeeId = '00000000-0000-0000-0000-000000000012';
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
  mfaRequired: true,
  bcryptCost: 10,
  loginMaxAttempts: 5,
  lockoutMinutes: 15,
  apiKeyHeader: 'X-API-Key',
  corsOrigins: [],
  logLevel: 'silent',
  otelEnabled: false,
  otelServiceName: 'hr-api-test',
};

describe('AuthService persisted users', () => {
  it('registers a tenant-scoped employee and rejects duplicate email', async () => {
    const { service } = await buildService();

    const user = await service.register({
      tenantId,
      email: 'new.employee@example.com',
      password: 'Password123!',
      firstName: 'New',
      lastName: 'Employee',
    });

    expect(user.email).toBe('new.employee@example.com');
    expect(user.roles).toContain('EMPLOYEE');
    await expect(
      service.register({
        tenantId,
        email: 'NEW.employee@example.com',
        password: 'Password123!',
      }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('rejects weak registration passwords', async () => {
    const { service } = await buildService();

    await expect(
      service.register({
        tenantId,
        email: 'weak@example.com',
        password: 'short',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('invites a user with a set-password token and notification', async () => {
    const notifications: AuthTokenNotification[] = [];
    const { service } = await buildService({ notifications });

    const result = await service.invite(hrActor(), {
      tenantId,
      email: 'invitee@example.com',
      firstName: 'Invited',
    });

    expect(result.user.email).toBe('invitee@example.com');
    expect(result.setPasswordToken).toBeTruthy();
    expect(notifications).toEqual([
      expect.objectContaining({ email: 'invitee@example.com', tokenType: 'SET_PASSWORD' }),
    ]);
  });

  it('locks an account after configured failed login attempts', async () => {
    const { service, users } = await buildService();

    for (let attempt = 0; attempt < testConfig.loginMaxAttempts; attempt += 1) {
      await expect(
        service.validateCredentials('employee@example.com', 'WrongPassword123!', tenantId),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    }

    const stored = await users.findByEmail(tenantId, 'employee@example.com');
    expect(stored?.failedLoginCount).toBe(testConfig.loginMaxAttempts);
    expect(stored?.lockedUntil).toBeTruthy();
    await expect(
      service.validateCredentials('employee@example.com', 'Password123!', tenantId),
    ).rejects.toThrow('Account is temporarily locked');
  });

  it('issues and refreshes durable session tokens across service instances', async () => {
    const sharedSessions = new InMemorySessionStore();
    const sharedUsers = new InMemoryUsersRepository(await demoUsers());
    const sharedTokens = new InMemoryTokenRepository();
    const service = AuthService.createForTest({
      users: sharedUsers,
      sessions: sharedSessions,
      tokens: sharedTokens,
      config: testConfig,
    });
    const user = await service.validateCredentials('employee@example.com', 'Password123!', tenantId);
    const credentials = await service.createSession(user);

    const restartedService = AuthService.createForTest({
      users: sharedUsers,
      sessions: sharedSessions,
      tokens: sharedTokens,
      config: testConfig,
    });
    const refreshed = await restartedService.refreshSession(credentials.refreshToken);

    expect(refreshed.session.sessionId).toBe(credentials.session.sessionId);
    expect(refreshed.session.userId).toBe(user.id);
    expect(refreshed.token).toBeTruthy();
  });

  it('detects refresh-token reuse and revokes the session', async () => {
    const sharedSessions = new InMemorySessionStore();
    const service = AuthService.createForTest({
      users: new InMemoryUsersRepository(await demoUsers()),
      sessions: sharedSessions,
      tokens: new InMemoryTokenRepository(),
      config: testConfig,
    });
    const user = await service.validateCredentials('employee@example.com', 'Password123!', tenantId);
    const credentials = await service.createSession(user);

    // First refresh rotates the token id; the original refresh token is now superseded.
    const rotated = await service.refreshSession(credentials.refreshToken);
    expect(rotated.refreshToken).not.toBe(credentials.refreshToken);

    // Replaying the original (stolen) refresh token must be rejected as reuse...
    await expect(service.refreshSession(credentials.refreshToken)).rejects.toThrow(/reuse/i);
    // ...and the whole session is revoked, so even the rotated token no longer works.
    await expect(service.refreshSession(rotated.refreshToken)).rejects.toThrow();
  });

  it('provisions and verifies real TOTP MFA', async () => {
    const { service, users } = await buildService();
    const user = await service.validateCredentials('employee@example.com', 'Password123!', tenantId);
    const credentials = await service.createSession(user, { mfaAuthenticated: false });

    const setup = await service.setupMfa(actorFor(user.id, user.roles, user.permissions, credentials.session.sessionId));
    const secret = new URL(setup.provisioningUri).searchParams.get('secret');
    expect(secret).toBeTruthy();
    expect(setup.qrCodeDataUrl).toMatch(/^data:image\/png;base64,/);

    const code = await generate({ secret: secret! });
    const upgraded = await service.verifyMfa(
      actorFor(user.id, user.roles, user.permissions, credentials.session.sessionId),
      code,
    );

    expect((await users.findById(user.id))?.mfaSecret).toBe(secret);
    expect(upgraded.session.sessionId).toBe(credentials.session.sessionId);
    expect(upgraded.session.mfaAuthenticated).toBe(true);
  });

  it('requests and confirms password reset tokens', async () => {
    const { service } = await buildService();
    const request = await service.requestPasswordReset(tenantId, 'employee@example.com');

    expect(request.ok).toBe(true);
    expect(request.resetToken).toBeTruthy();

    await service.confirmPasswordReset(request.resetToken!, 'NewPassword123!');
    const user = await service.validateCredentials('employee@example.com', 'NewPassword123!', tenantId);

    expect(user.id).toBe(employeeId);
  });
});

async function buildService(options: { notifications?: AuthTokenNotification[] } = {}) {
  const users = new InMemoryUsersRepository(await demoUsers());
  const sessions = new InMemorySessionStore();
  const tokens = new InMemoryTokenRepository();
  const service = AuthService.createForTest({
    users,
    sessions,
    tokens,
    config: testConfig,
    tokenNotifier: {
      sendToken: async (notification) => {
        options.notifications?.push(notification);
      },
    },
  });
  return { service, users, sessions, tokens };
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
      permissions: ['WORKER_CREATE'],
      failedLoginCount: 0,
    },
    {
      id: employeeId,
      email: 'employee@example.com',
      firstName: 'Regular',
      lastName: 'Employee',
      passwordHash,
      tenantId,
      status: 'ACTIVE',
      roles: ['EMPLOYEE'],
      permissions: ['SELF_READ'],
      failedLoginCount: 0,
    },
  ];
}

function hrActor() {
  return {
    actorType: 'USER' as const,
    actorId: new Uuid(hrAdminId),
    tenantId: new Uuid(tenantId),
    roles: ['HR_ADMIN'],
    permissions: ['WORKER_CREATE'],
    mfaAuthenticated: true,
  };
}

function actorFor(userId: string, roles: string[], permissions: string[], sessionId: string) {
  return {
    actorType: 'USER' as const,
    actorId: new Uuid(userId),
    tenantId: new Uuid(tenantId),
    roles,
    permissions,
    sessionId,
    mfaAuthenticated: false,
  };
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
    };
    this.byId.set(user.id, user);
    return user;
  }

  async updateMfaSecret(userId: string, mfaSecret: string): Promise<void> {
    const user = this.byId.get(userId);
    if (user) user.mfaSecret = mfaSecret;
  }

  async resetFailedLoginState(userId: string): Promise<void> {
    const user = this.byId.get(userId);
    if (user) {
      user.failedLoginCount = 0;
      user.lockedUntil = undefined;
      user.status = 'ACTIVE';
    }
  }

  async recordFailedLogin(userId: string, failedLoginCount: number, lockedUntil?: string): Promise<void> {
    const user = this.byId.get(userId);
    if (user) {
      user.failedLoginCount = failedLoginCount;
      user.lockedUntil = lockedUntil;
      if (lockedUntil) user.status = 'LOCKED';
    }
  }

  async updatePassword(userId: string, passwordHash: string): Promise<void> {
    const user = this.byId.get(userId);
    if (user) {
      user.passwordHash = passwordHash;
      user.status = 'ACTIVE';
      user.failedLoginCount = 0;
      user.lockedUntil = undefined;
    }
  }
}

class InMemorySessionStore implements AuthSessionStoreLike {
  private readonly sessions = new Map<string, AuthSession>();

  async create(session: AuthSession): Promise<void> {
    this.sessions.set(session.sessionId, { ...session });
  }

  async get(sessionId: string): Promise<AuthSession | undefined> {
    const session = this.sessions.get(sessionId);
    return session ? { ...session } : undefined;
  }

  async save(session: AuthSession): Promise<void> {
    this.sessions.set(session.sessionId, { ...session });
  }

  async revoke(sessionId: string): Promise<void> {
    this.sessions.delete(sessionId);
  }
}

class InMemoryTokenRepository {
  private readonly tokens = new Map<string, AuthTokenRecord>();

  async create(input: {
    tenantId: string;
    userId: string;
    tokenHash: string;
    tokenType: AuthTokenType;
    email?: string;
    expiresAt: string;
    createdBy?: string;
  }): Promise<AuthTokenRecord> {
    const record: AuthTokenRecord = {
      id: randomUUID(),
      tenantId: input.tenantId,
      userId: input.userId,
      tokenHash: input.tokenHash,
      tokenType: input.tokenType,
      email: input.email,
      expiresAt: input.expiresAt,
      createdBy: input.createdBy,
    };
    this.tokens.set(record.id, record);
    return record;
  }

  async findActiveByHash(tokenHash: string, tokenType: AuthTokenType): Promise<AuthTokenRecord | undefined> {
    const now = Date.now();
    return Array.from(this.tokens.values()).find(
      (token) =>
        token.tokenHash === tokenHash
        && token.tokenType === tokenType
        && !token.consumedAt
        && Date.parse(token.expiresAt) > now,
    );
  }

  async consume(id: string): Promise<void> {
    const token = this.tokens.get(id);
    if (token) token.consumedAt = new Date().toISOString();
  }
}
