/**
 * Optional authentication guard.
 * Validates Bearer tokens when present, but does not require them.
 * Populates req.actor for downstream use when a valid token is provided.
 */

import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { Request } from 'express';
import jwt from 'jsonwebtoken';
import { loadAppConfig } from '../config/app.config.js';
import type { HrActor } from '@hcm/command-contracts';

interface JwtPayload {
  sub: string;
  email?: string;
  roles?: string[];
  permissions?: string[];
  tenant_id?: string;
  actor_type?: string;
  mfa_authenticated?: boolean;
}

@Injectable()
export class OptionalAuthGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();

    // A production config error (e.g. a missing/weak SYSTEM_API_KEY tripping the
    // strong-secret guard) must not surface as an unhandled 500 on a route that's
    // supposed to work anonymously — proceed without an actor, same as an invalid
    // token below. Strict endpoints use AuthGuard, which denies on this same failure.
    let config: ReturnType<typeof loadAppConfig>;
    try {
      config = loadAppConfig();
    } catch {
      return true;
    }

    const authHeader =
      (request.headers.authorization as string | undefined) ??
      (request.headers.Authorization as string | undefined);

    if (!authHeader) {
      return true;
    }

    const token = authHeader.replace(/^Bearer\s+/i, '');
    if (!token) {
      return true;
    }

    try {
      const payload = jwt.verify(token, config.jwtSecret, {
        clockTolerance: 30,
      }) as JwtPayload;

      request.actor = {
        actorType: (payload.actor_type as HrActor['actorType']) ?? 'USER',
        actorId: { value: payload.sub } as unknown as HrActor['actorId'],
        roles: payload.roles ?? [],
        permissions: payload.permissions ?? [],
        mfaAuthenticated: payload.mfa_authenticated ?? false,
      };
      (request.actor as HrActor & { email?: string }).email = payload.email;
      return true;
    } catch {
      // Invalid token — let the request proceed without an actor.
      // Strict endpoints should use AuthGuard instead.
      return true;
    }
  }
}
