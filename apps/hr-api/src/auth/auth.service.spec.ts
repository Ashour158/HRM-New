import { UnauthorizedException } from '@nestjs/common';
import { Uuid } from '@hcm/shared-kernel';
import { describe, expect, it } from 'vitest';
import { AuthService } from './auth.service.js';

describe('AuthService demo users', () => {
  it('does not expose a terminated employee demo login', async () => {
    const service = new AuthService();

    await expect(
      service.validateCredentials('terminated.employee@example.com', 'Password123!'),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('issues and refreshes session tokens for a valid user', async () => {
    const service = new AuthService();
    const user = await service.validateCredentials('employee@example.com', 'Password123!');

    const credentials = service.createSession(user);
    const refreshed = service.refreshSession(credentials.refreshToken);

    expect(credentials.token).toBeTruthy();
    expect(credentials.refreshToken).toBeTruthy();
    expect(refreshed.token).toBeTruthy();
    expect(refreshed.refreshToken).toBeTruthy();
    expect(refreshed.session.sessionId).toBe(credentials.session.sessionId);
    expect(refreshed.session.userId).toBe(user.id);
  });

  it('upgrades a session with MFA evidence', async () => {
    const service = new AuthService();
    const user = await service.validateCredentials('employee@example.com', 'Password123!');
    const credentials = service.createSession(user, { mfaAuthenticated: false });

    const upgraded = service.verifyMfa(
      {
        actorType: 'USER',
        actorId: new Uuid(user.id),
        roles: user.roles,
        permissions: user.permissions,
        sessionId: credentials.session.sessionId,
        mfaAuthenticated: false,
      },
      '123456',
    );

    expect(upgraded.session.sessionId).toBe(credentials.session.sessionId);
    expect(upgraded.session.mfaAuthenticated).toBe(true);
  });
});
