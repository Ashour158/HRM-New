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
    const config = loadAppConfig();

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
      return true;
    } catch {
      // Invalid token — let the request proceed without an actor.
      // Strict endpoints should use AuthGuard instead.
      return true;
    }
  }
}
