import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import type { AppConfig } from '../config/app.config.js';
import { loadAppConfig } from '../config/app.config.js';
import type { HrActor } from '@hcm/command-contracts';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { generateSecret, generateURI, verify } from 'otplib';
import * as QRCode from 'qrcode';
import { getRoleDefinition } from '@hcm/access-control';
import { AuthSessionStore, type AuthSessionStoreLike } from './auth-session.store.js';
import { AuthTokenRepository, type AuthTokenRecord, type AuthTokenType } from './auth-token.repository.js';
import { UsersRepository, type StoredAuthUser } from './users.repository.js';
import { EmailNotificationAdapter, isEmailNotificationConfigured } from '../integrations/adapters/email-notification.adapter.js';

export interface AuthUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  tenantId: string;
  roles: string[];
  permissions: string[];
}

export interface AuthSession {
  sessionId: string;
  userId: string;
  tenantId: string;
  createdAt: string;
  expiresAt: string;
  mfaAuthenticated: boolean;
  /** Current refresh-token id (jti). Rotated on every refresh; reuse of a prior id
   *  signals token theft and revokes the session. */
  refreshTokenId?: string;
}

export interface AuthTokenPair {
  token: string;
  refreshToken: string;
  session: AuthSession;
}

export interface SsoUserResolutionInput {
  tenantId: string;
  idpProvider: 'OIDC' | 'SAML';
  externalId: string;
  email: string;
  firstName?: string;
  lastName?: string;
  groups?: string[];
  jitProvisioning: boolean;
  defaultRoles: string[];
  groupRoleMapping: Record<string, string[]>;
  mfaAuthenticated?: boolean;
}

export interface RegisterAuthUserInput {
  tenantId: string;
  email: string;
  password: string;
  firstName?: string;
  lastName?: string;
}

export interface InviteAuthUserInput {
  tenantId: string;
  email: string;
  firstName?: string;
  lastName?: string;
}

export interface AuthTokenNotification {
  tokenType: AuthTokenType;
  email: string;
  tenantId: string;
  token: string;
  expiresAt: string;
}

export interface AuthTokenNotifierLike {
  sendToken(notification: AuthTokenNotification): Promise<void>;
}

export interface AuthServiceDependencies {
  users?: Pick<
    UsersRepository,
    | 'findByEmail'
    | 'findById'
    | 'create'
    | 'updateMfaSecret'
    | 'resetFailedLoginState'
    | 'recordFailedLogin'
    | 'updatePassword'
    | 'findByExternalId'
    | 'linkIdentityProvider'
    | 'createWithIdentityProvider'
  >;
  sessions?: AuthSessionStoreLike;
  tokens?: Pick<AuthTokenRepository, 'create' | 'findActiveByHash' | 'consume'>;
  tokenNotifier?: AuthTokenNotifierLike;
  config?: AppConfig;
}

type AuthUsersPort = NonNullable<AuthServiceDependencies['users']>;
type AuthTokensPort = NonNullable<AuthServiceDependencies['tokens']>;

interface RefreshPayload {
  sub: string;
  tenant_id: string;
  session_id: string;
  token_type: 'refresh';
  rtid?: string;
}

class EmailTokenNotifier implements AuthTokenNotifierLike {
  private readonly adapter = new EmailNotificationAdapter();

  async sendToken(notification: AuthTokenNotification): Promise<void> {
    if (!isEmailNotificationConfigured()) {
      return undefined;
    }

    await this.adapter.send({
      to: notification.email,
      subject: notification.tokenType === 'SET_PASSWORD' ? 'Set your HRM Nexus password' : 'Reset your HRM Nexus password',
      bodyText: [
        notification.tokenType === 'SET_PASSWORD'
          ? 'An HR administrator created your HRM Nexus account.'
          : 'A password reset was requested for your HRM Nexus account.',
        '',
        `Token: ${notification.token}`,
        `Expires at: ${notification.expiresAt}`,
      ].join('\n'),
      correlationId: `auth-${notification.tenantId}`,
    });
    return undefined;
  }
}

@Injectable()
export class AuthService {
  private config = loadAppConfig();
  private users: AuthUsersPort = new UsersRepository();
  private sessions: AuthSessionStoreLike = new AuthSessionStore();
  private tokens: AuthTokensPort = new AuthTokenRepository();
  private tokenNotifier: AuthTokenNotifierLike = new EmailTokenNotifier();

  static createForTest(dependencies: AuthServiceDependencies): AuthService {
    const service = new AuthService();
    service.config = dependencies.config ?? service.config;
    service.users = dependencies.users ?? service.users;
    service.sessions = dependencies.sessions ?? service.sessions;
    service.tokens = dependencies.tokens ?? service.tokens;
    service.tokenNotifier = dependencies.tokenNotifier ?? service.tokenNotifier;
    return service;
  }

  async register(input: RegisterAuthUserInput): Promise<AuthUser> {
    const email = normalizeEmail(input.email);
    validateEmail(email);
    validatePasswordPolicy(input.password);

    const existing = await this.users.findByEmail(input.tenantId, email);
    if (existing) throw new ConflictException('A user with this email already exists for this tenant');

    const passwordHash = await bcrypt.hash(input.password, this.bcryptCost());
    const user = await this.users.create({
      tenantId: input.tenantId,
      email,
      firstName: input.firstName,
      lastName: input.lastName,
      passwordHash,
      status: 'ACTIVE',
      roles: ['EMPLOYEE'],
      permissions: ['SELF_READ', 'SELF_UPDATE', 'TIME_ATTENDANCE_READ', 'TIME_ATTENDANCE_WRITE', 'BENEFITS_READ', 'PAYSLIP_READ'],
    });

    return this.toAuthUser(user);
  }

  async invite(actor: HrActor, input: InviteAuthUserInput): Promise<{ user: AuthUser; setPasswordToken?: string; expiresAt: string }> {
    if (!actor.roles.includes('HR_ADMIN')) {
      throw new ForbiddenException('Only HR administrators can invite users');
    }

    const email = normalizeEmail(input.email);
    validateEmail(email);
    const existing = await this.users.findByEmail(input.tenantId, email);
    if (existing) throw new ConflictException('A user with this email already exists for this tenant');

    const randomPasswordHash = await bcrypt.hash(randomUUID(), this.bcryptCost());
    const user = await this.users.create({
      tenantId: input.tenantId,
      email,
      firstName: input.firstName,
      lastName: input.lastName,
      passwordHash: randomPasswordHash,
      status: 'INVITED',
      roles: ['EMPLOYEE'],
      permissions: ['SELF_READ', 'SELF_UPDATE'],
    });
    const token = await this.issueUserToken(user, 'SET_PASSWORD', actor.actorId.value);
    await this.tokenNotifier.sendToken({ tokenType: 'SET_PASSWORD', email, tenantId: input.tenantId, token: token.token, expiresAt: token.expiresAt });

    return {
      user: this.toAuthUser(user),
      setPasswordToken: this.config.nodeEnv === 'production' ? undefined : token.token,
      expiresAt: token.expiresAt,
    };
  }

  async requestPasswordReset(tenantId: string, emailInput: string): Promise<{ ok: true; resetToken?: string; expiresAt?: string }> {
    const email = normalizeEmail(emailInput);
    validateEmail(email);
    const user = await this.users.findByEmail(tenantId, email);
    if (!user) return { ok: true };

    const token = await this.issueUserToken(user, 'PASSWORD_RESET');
    await this.tokenNotifier.sendToken({ tokenType: 'PASSWORD_RESET', email, tenantId, token: token.token, expiresAt: token.expiresAt });
    return {
      ok: true,
      resetToken: this.config.nodeEnv === 'production' ? undefined : token.token,
      expiresAt: token.expiresAt,
    };
  }

  async confirmPasswordReset(token: string, password: string): Promise<{ ok: true }> {
    validatePasswordPolicy(password);
    const record = await this.findActiveToken(token, 'PASSWORD_RESET')
      ?? await this.findActiveToken(token, 'SET_PASSWORD');
    if (!record) throw new UnauthorizedException('Invalid or expired password reset token');

    const passwordHash = await bcrypt.hash(password, this.bcryptCost());
    await this.users.updatePassword(record.userId, passwordHash, 'ACTIVE');
    await this.tokens.consume(record.id);
    return { ok: true };
  }

  async validateCredentials(emailInput: string, password: string, tenantId: string): Promise<AuthUser> {
    const email = normalizeEmail(emailInput);
    const user = await this.users.findByEmail(tenantId, email);
    if (!user) throw new UnauthorizedException('Invalid email or password');

    if (user.lockedUntil && Date.parse(user.lockedUntil) > Date.now()) {
      throw new UnauthorizedException('Account is temporarily locked');
    }
    if (user.status !== 'ACTIVE') {
      throw new UnauthorizedException('Account is not active');
    }
    if (user.idpProvider) {
      throw new UnauthorizedException('Use SSO to sign in to this account');
    }

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      await this.recordFailedLogin(user);
      throw new UnauthorizedException('Invalid email or password');
    }

    if (user.failedLoginCount > 0 || user.lockedUntil) {
      await this.users.resetFailedLoginState(user.id);
    }

    return this.toAuthUser(user);
  }

  async createSessionForSsoUser(input: SsoUserResolutionInput): Promise<AuthTokenPair> {
    const email = normalizeEmail(input.email);
    validateEmail(email);
    const existingByExternalId = await this.users.findByExternalId(input.tenantId, input.idpProvider, input.externalId);
    if (existingByExternalId) {
      return this.createSession(this.toAuthUser(existingByExternalId), { mfaAuthenticated: input.mfaAuthenticated ?? true });
    }

    const existingByEmail = await this.users.findByEmail(input.tenantId, email);
    if (existingByEmail) {
      if (
        existingByEmail.idpProvider
        && (existingByEmail.idpProvider !== input.idpProvider || existingByEmail.externalId !== input.externalId)
      ) {
        throw new UnauthorizedException('SSO account is linked to a different identity provider');
      }
      const linked = await this.users.linkIdentityProvider(existingByEmail.id, input.idpProvider, input.externalId);
      if (!linked) throw new UnauthorizedException('Unable to link SSO account');
      return this.createSession(this.toAuthUser(linked), { mfaAuthenticated: input.mfaAuthenticated ?? true });
    }

    if (!input.jitProvisioning) {
      throw new UnauthorizedException('No local account exists for this SSO user; contact your administrator');
    }

    const roles = rolesFromSsoGroups(input.groups ?? [], input.defaultRoles, input.groupRoleMapping);
    const created = await this.users.createWithIdentityProvider({
      tenantId: input.tenantId,
      email,
      firstName: input.firstName,
      lastName: input.lastName,
      status: 'ACTIVE',
      roles,
      permissions: permissionsForRoles(roles),
      idpProvider: input.idpProvider,
      externalId: input.externalId,
    });

    return this.createSession(this.toAuthUser(created), { mfaAuthenticated: input.mfaAuthenticated ?? true });
  }

  async createSession(user: AuthUser, options?: { mfaAuthenticated?: boolean }): Promise<AuthTokenPair> {
    const sessionId = randomUUID();
    const mfaAuthenticated = options?.mfaAuthenticated ?? !this.config.mfaRequired;
    const session: AuthSession = {
      sessionId,
      userId: user.id,
      tenantId: user.tenantId,
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + this.durationMs(this.config.refreshTokenExpiresIn)).toISOString(),
      mfaAuthenticated,
      refreshTokenId: randomUUID(),
    };
    await this.sessions.create(session);

    return {
      token: this.generateToken(user, session),
      refreshToken: this.generateRefreshToken(user, session),
      session,
    };
  }

  async refreshSession(refreshToken: string): Promise<AuthTokenPair> {
    const payload = this.verifyRefreshToken(refreshToken);
    const session = await this.sessions.get(payload.session_id);
    if (!session || session.userId !== payload.sub || session.tenantId !== payload.tenant_id) {
      throw new UnauthorizedException('Invalid or revoked refresh session');
    }
    if (Date.parse(session.expiresAt) <= Date.now()) {
      await this.sessions.revoke(session.sessionId);
      throw new UnauthorizedException('Refresh session expired');
    }

    // Refresh-token reuse detection: a valid-but-superseded token id means the token was
    // rotated already (likely stolen/replayed). Revoke the whole session as a theft signal.
    if (session.refreshTokenId && payload.rtid !== session.refreshTokenId) {
      await this.sessions.revoke(session.sessionId);
      throw new UnauthorizedException('Refresh token reuse detected');
    }

    const storedUser = await this.users.findById(session.userId);
    if (
      !storedUser
      || storedUser.status !== 'ACTIVE'
      || (storedUser.lockedUntil && Date.parse(storedUser.lockedUntil) > Date.now())
    ) {
      await this.sessions.revoke(session.sessionId);
      throw new UnauthorizedException('Authenticated user is not active');
    }
    const user = this.toAuthUser(storedUser);

    const rotatedSession: AuthSession = {
      ...session,
      expiresAt: new Date(Date.now() + this.durationMs(this.config.refreshTokenExpiresIn)).toISOString(),
      // Rotate the refresh-token id so the just-presented token cannot be replayed.
      refreshTokenId: randomUUID(),
    };
    await this.sessions.save(rotatedSession);

    return {
      token: this.generateToken(user, rotatedSession),
      refreshToken: this.generateRefreshToken(user, rotatedSession),
      session: rotatedSession,
    };
  }

  async revokeSession(sessionId: string | undefined): Promise<void> {
    if (sessionId) await this.sessions.revoke(sessionId);
  }

  async setupMfa(actor: HrActor): Promise<{ provisioningUri: string; qrCodeDataUrl: string }> {
    const user = await this.users.findById(actor.actorId.value);
    if (!user) throw new UnauthorizedException('Authenticated user no longer exists');
    const secret = generateSecret();
    await this.users.updateMfaSecret(user.id, secret);
    const provisioningUri = generateURI({ issuer: 'HRM Nexus', label: user.email, secret });
    const qrCodeDataUrl = await QRCode.toDataURL(provisioningUri);
    return { provisioningUri, qrCodeDataUrl };
  }

  async verifyMfa(actor: HrActor, code: string): Promise<AuthTokenPair> {
    const stored = await this.users.findById(actor.actorId.value);
    if (!stored?.mfaSecret) {
      throw new UnauthorizedException('MFA is not configured for this user');
    }
    const result = await verify({ token: code, secret: stored.mfaSecret });
    if (!result.valid) {
      throw new UnauthorizedException('Invalid MFA verification code');
    }

    const user = this.toAuthUser(stored);
    const existingSession = actor.sessionId ? await this.sessions.get(actor.sessionId) : undefined;
    const session: AuthSession = existingSession
      ? { ...existingSession, mfaAuthenticated: true }
      : {
          sessionId: randomUUID(),
          userId: user.id,
          tenantId: user.tenantId,
          createdAt: new Date().toISOString(),
          expiresAt: new Date(Date.now() + this.durationMs(this.config.refreshTokenExpiresIn)).toISOString(),
          mfaAuthenticated: true,
        };

    if (existingSession) {
      await this.sessions.save(session);
    } else {
      await this.sessions.create(session);
    }

    return {
      token: this.generateToken(user, session),
      refreshToken: this.generateRefreshToken(user, session),
      session,
    };
  }

  authProviders(): {
    local: { enabled: boolean };
    oidc: { enabled: boolean; issuerUrl?: string; clientId?: string; redirectUri?: string };
    saml: { enabled: boolean; metadataUrl?: string; entityId?: string };
    mfa: { required: boolean };
    session: { accessTokenTtl: string; refreshTokenTtl: string };
  } {
    return {
      local: { enabled: true },
      oidc: {
        enabled: Boolean(this.config.oidcIssuerUrl && this.config.oidcClientId && this.config.oidcRedirectUri),
        issuerUrl: this.config.oidcIssuerUrl,
        clientId: this.config.oidcClientId,
        redirectUri: this.config.oidcRedirectUri,
      },
      saml: {
        enabled: Boolean(this.config.samlMetadataUrl && this.config.samlEntityId),
        metadataUrl: this.config.samlMetadataUrl,
        entityId: this.config.samlEntityId,
      },
      mfa: {
        required: this.config.mfaRequired,
      },
      session: {
        accessTokenTtl: this.config.jwtExpiresIn,
        refreshTokenTtl: this.config.refreshTokenExpiresIn,
      },
    };
  }

  generateToken(user: AuthUser, session?: AuthSession): string {
    return jwt.sign(
      {
        sub: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        roles: user.roles,
        permissions: user.permissions,
        tenant_id: user.tenantId,
        actor_type: 'USER',
        session_id: session?.sessionId,
        mfa_authenticated: session?.mfaAuthenticated ?? !this.config.mfaRequired,
      },
      this.config.jwtSecret,
      { expiresIn: this.config.jwtExpiresIn as `${number}${'s'|'m'|'h'|'d'|'w'|'y'}` },
    );
  }

  verifyToken(token: string): AuthUser {
    try {
      const payload = jwt.verify(token, this.config.jwtSecret, {
        clockTolerance: 30,
      }) as Record<string, unknown>;

      return {
        id: payload.sub as string,
        email: payload.email as string,
        firstName: payload.firstName as string,
        lastName: payload.lastName as string,
        tenantId: payload.tenant_id as string,
        roles: (payload.roles as string[]) ?? [],
        permissions: (payload.permissions as string[]) ?? [],
      };
    } catch {
      throw new UnauthorizedException('Invalid or expired token');
    }
  }

  async findById(id: string): Promise<AuthUser | undefined> {
    const user = await this.users.findById(id);
    return user ? this.toAuthUser(user) : undefined;
  }

  private async recordFailedLogin(user: StoredAuthUser): Promise<void> {
    const failedLoginCount = user.failedLoginCount + 1;
    const lockedUntil =
      failedLoginCount >= this.config.loginMaxAttempts
        ? new Date(Date.now() + this.config.lockoutMinutes * 60_000).toISOString()
        : undefined;
    await this.users.recordFailedLogin(user.id, failedLoginCount, lockedUntil);
  }

  private async issueUserToken(user: StoredAuthUser, tokenType: AuthTokenType, createdBy?: string): Promise<{ token: string; expiresAt: string }> {
    const token = randomBytes(32).toString('base64url');
    const expiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString();
    await this.tokens.create({
      tenantId: user.tenantId,
      userId: user.id,
      tokenHash: hashToken(token),
      tokenType,
      email: user.email,
      expiresAt,
      createdBy,
    });
    return { token, expiresAt };
  }

  private async findActiveToken(token: string, type: AuthTokenType): Promise<AuthTokenRecord | undefined> {
    return this.tokens.findActiveByHash(hashToken(token), type);
  }

  private generateRefreshToken(user: AuthUser, session: AuthSession): string {
    return jwt.sign(
      {
        sub: user.id,
        tenant_id: user.tenantId,
        session_id: session.sessionId,
        token_type: 'refresh',
        rtid: session.refreshTokenId,
      },
      this.config.jwtSecret,
      { expiresIn: this.config.refreshTokenExpiresIn as `${number}${'s'|'m'|'h'|'d'|'w'|'y'}` },
    );
  }

  private verifyRefreshToken(refreshToken: string): RefreshPayload {
    try {
      const payload = jwt.verify(refreshToken, this.config.jwtSecret, {
        clockTolerance: 30,
      }) as Partial<RefreshPayload>;
      if (payload.token_type !== 'refresh' || !payload.sub || !payload.tenant_id || !payload.session_id) {
        throw new Error('Invalid refresh token payload');
      }
      return payload as RefreshPayload;
    } catch {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }
  }

  private durationMs(value: string): number {
    const match = /^(\d+)([smhdwy])$/.exec(value.trim());
    if (!match) return 7 * 24 * 60 * 60 * 1000;
    const amount = Number(match[1]);
    const unit = match[2];
    const multipliers: Record<string, number> = {
      s: 1000,
      m: 60 * 1000,
      h: 60 * 60 * 1000,
      d: 24 * 60 * 60 * 1000,
      w: 7 * 24 * 60 * 60 * 1000,
      y: 365 * 24 * 60 * 60 * 1000,
    };
    return amount * multipliers[unit];
  }

  private bcryptCost(): number {
    const cost = Number.isFinite(this.config.bcryptCost) ? this.config.bcryptCost : 12;
    return Math.min(Math.max(cost, 10), 15);
  }

  private toAuthUser(user: StoredAuthUser): AuthUser {
    return {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      tenantId: user.tenantId,
      roles: user.roles,
      permissions: user.permissions,
    };
  }
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function validateEmail(email: string): void {
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new BadRequestException('A valid email address is required');
  }
}

function validatePasswordPolicy(password: string): void {
  const valid =
    password.length >= 12 &&
    /[a-z]/.test(password) &&
    /[A-Z]/.test(password) &&
    /\d/.test(password) &&
    /[^A-Za-z0-9]/.test(password);
  if (!valid) {
    throw new BadRequestException('Password must be at least 12 characters and include upper, lower, digit, and symbol');
  }
}

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

function rolesFromSsoGroups(groups: string[], defaultRoles: string[], groupRoleMapping: Record<string, string[]>): string[] {
  const roles = new Set(defaultRoles.length > 0 ? defaultRoles : ['EMPLOYEE']);
  for (const group of groups) {
    for (const role of groupRoleMapping[group] ?? []) roles.add(role);
  }
  return Array.from(roles);
}

function permissionsForRoles(roles: string[]): string[] {
  const permissions = new Set<string>();
  for (const role of roles) {
    try {
      getRoleDefinition(role as Parameters<typeof getRoleDefinition>[0]).defaultPermissions.forEach((permission) => permissions.add(permission));
    } catch {
      // Ignore unknown IdP mapped roles instead of granting broad access.
    }
  }
  return Array.from(permissions);
}
