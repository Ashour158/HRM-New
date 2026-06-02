import { UnauthorizedException } from '@nestjs/common';
import { describe, expect, it } from 'vitest';
import { AuthService } from './auth.service.js';

describe('AuthService demo users', () => {
  it('does not expose a terminated employee demo login', async () => {
    const service = new AuthService();

    await expect(
      service.validateCredentials('terminated.employee@example.com', 'Password123!'),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });
});
