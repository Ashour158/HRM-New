/**
 * Local development authentication service.
 * Provides demo user accounts and JWT token management.
 */

import { Injectable, UnauthorizedException } from '@nestjs/common';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import { randomUUID } from 'node:crypto';
import { loadAppConfig } from '../config/app.config.js';
import type { HrActor } from '@hcm/command-contracts';

export interface DemoUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  passwordHash: string;
  tenantId: string;
  roles: string[];
  permissions: string[];
}

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
}

export interface AuthTokenPair {
  token: string;
  refreshToken: string;
  session: AuthSession;
}

interface RefreshPayload {
  sub: string;
  tenant_id: string;
  session_id: string;
  token_type: 'refresh';
}

const DEMO_USERS: DemoUser[] = [
  {
    id: '00000000-0000-0000-0000-000000000010',
    email: 'hr.admin@example.com',
    firstName: 'HR',
    lastName: 'Admin',
    passwordHash: '$2b$10$XOturYAwdImT.TMp4gkc7u0j3ZwAWzMbJViENs0C0QP5c5TYKDRF.', // Password123!
    tenantId: '00000000-0000-0000-0000-000000000001',
    roles: ['HR_ADMIN', 'COMPENSATION_ADMIN', 'BENEFITS_ADMIN'],
    permissions: [
      'WORKER_CREATE', 'WORKER_READ', 'WORKER_UPDATE', 'WORKER_TERMINATE',
      'ORGANIZATION_MANAGE', 'REPORTING_READ', 'COMPLIANCE_MANAGE',
      'PAYROLL_MANAGE', 'BENEFITS_MANAGE', 'PERFORMANCE_MANAGE',
      'LEARNING_MANAGE', 'RECRUITING_MANAGE', 'ONBOARDING_MANAGE',
      'COMPENSATION_READ', 'COMPENSATION_CHANGE', 'COMPENSATION_APPROVE',
      'BENEFITS_READ', 'BENEFITS_ENROLL', 'BENEFITS_APPROVE',
    ],
  },
  {
    id: '00000000-0000-0000-0000-000000000011',
    email: 'manager@example.com',
    firstName: 'Line',
    lastName: 'Manager',
    passwordHash: '$2b$10$XOturYAwdImT.TMp4gkc7u0j3ZwAWzMbJViENs0C0QP5c5TYKDRF.', // Password123!
    tenantId: '00000000-0000-0000-0000-000000000001',
    roles: ['MANAGER'],
    permissions: [
      'WORKER_READ', 'WORKER_UPDATE',
      'PERFORMANCE_READ', 'PERFORMANCE_WRITE',
      'TIME_ATTENDANCE_MANAGE', 'APPROVAL_MANAGE',
    ],
  },
  {
    id: '00000000-0000-0000-0000-000000000012',
    email: 'employee@example.com',
    firstName: 'Regular',
    lastName: 'Employee',
    passwordHash: '$2b$10$XOturYAwdImT.TMp4gkc7u0j3ZwAWzMbJViENs0C0QP5c5TYKDRF.', // Password123!
    tenantId: '00000000-0000-0000-0000-000000000001',
    roles: ['EMPLOYEE'],
    permissions: [
      'SELF_READ', 'SELF_UPDATE',
      'TIME_ATTENDANCE_READ', 'TIME_ATTENDANCE_WRITE',
      'BENEFITS_READ', 'PAYSLIP_READ',
    ],
  },
];

@Injectable()
export class AuthService {
  private readonly config = loadAppConfig();
  private readonly sessions = new Map<string, AuthSession>();

  async validateCredentials(email: string, password: string): Promise<AuthUser> {
    const user = DEMO_USERS.find((u) => u.email === email);
    if (!user) {
      throw new UnauthorizedException('Invalid email or password');
    }

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      throw new UnauthorizedException('Invalid email or password');
    }

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

  createSession(user: AuthUser, options?: { mfaAuthenticated?: boolean }): AuthTokenPair {
    const sessionId = randomUUID();
    const mfaAuthenticated = options?.mfaAuthenticated ?? !this.config.mfaRequired;
    const session: AuthSession = {
      sessionId,
      userId: user.id,
      tenantId: user.tenantId,
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + this.durationMs(this.config.refreshTokenExpiresIn)).toISOString(),
      mfaAuthenticated,
    };
    this.sessions.set(sessionId, session);

    return {
      token: this.generateToken(user, session),
      refreshToken: this.generateRefreshToken(user, session),
      session,
    };
  }

  refreshSession(refreshToken: string): AuthTokenPair {
    const payload = this.verifyRefreshToken(refreshToken);
    const session = this.sessions.get(payload.session_id);
    if (!session || session.userId !== payload.sub || session.tenantId !== payload.tenant_id) {
      throw new UnauthorizedException('Invalid or revoked refresh session');
    }
    if (Date.parse(session.expiresAt) <= Date.now()) {
      this.sessions.delete(session.sessionId);
      throw new UnauthorizedException('Refresh session expired');
    }

    const user = this.findById(session.userId);
    if (!user) throw new UnauthorizedException('Authenticated user no longer exists');

    const rotatedSession: AuthSession = {
      ...session,
      expiresAt: new Date(Date.now() + this.durationMs(this.config.refreshTokenExpiresIn)).toISOString(),
    };
    this.sessions.set(rotatedSession.sessionId, rotatedSession);

    return {
      token: this.generateToken(user, rotatedSession),
      refreshToken: this.generateRefreshToken(user, rotatedSession),
      session: rotatedSession,
    };
  }

  revokeSession(sessionId: string | undefined): void {
    if (sessionId) this.sessions.delete(sessionId);
  }

  verifyMfa(actor: HrActor, code: string): AuthTokenPair {
    if (!this.config.mfaDemoCode || code !== this.config.mfaDemoCode) {
      throw new UnauthorizedException('Invalid MFA verification code');
    }

    const user = this.findById(actor.actorId.value);
    if (!user) throw new UnauthorizedException('Authenticated user no longer exists');

    const session: AuthSession = {
      sessionId: actor.sessionId ?? randomUUID(),
      userId: user.id,
      tenantId: user.tenantId,
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + this.durationMs(this.config.refreshTokenExpiresIn)).toISOString(),
      mfaAuthenticated: true,
    };
    this.sessions.set(session.sessionId, session);

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
    mfa: { required: boolean; demoCodeEnabled: boolean };
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
        demoCodeEnabled: Boolean(this.config.mfaDemoCode),
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

  private generateRefreshToken(user: AuthUser, session: AuthSession): string {
    return jwt.sign(
      {
        sub: user.id,
        tenant_id: user.tenantId,
        session_id: session.sessionId,
        token_type: 'refresh',
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

  findById(id: string): AuthUser | undefined {
    const user = DEMO_USERS.find((u) => u.id === id);
    if (!user) return undefined;
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
