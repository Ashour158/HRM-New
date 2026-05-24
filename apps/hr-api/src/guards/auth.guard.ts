import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
  ForbiddenException,
} from '@nestjs/common';
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
  session_id?: string;
  mfa_authenticated?: boolean;
  iat?: number;
  exp?: number;
}

const API_KEY_ACTORS: Record<
  string,
  Pick<HrActor, 'actorType' | 'roles' | 'permissions'>
> = {
  'system-api-key': {
    actorType: 'SYSTEM',
    roles: ['SYSTEM_ACTOR'],
    permissions: [],
  },
  'integration-api-key': {
    actorType: 'INTEGRATION',
    roles: ['INTEGRATION_ACTOR'],
    permissions: [],
  },
};

/**
 * Validates the incoming request via JWT Bearer token or API key.
 * Attaches a fully populated {@link HrActor} to the request object.
 */
@Injectable()
export class AuthGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    const config = loadAppConfig();

    // 1. Try API key first (for SYSTEM / INTEGRATION actors).
    const apiKey =
      (request.headers[config.apiKeyHeader.toLowerCase()] as string | undefined) ??
      (request.headers[config.apiKeyHeader] as string | undefined);

    if (apiKey) {
      const actorStub = API_KEY_ACTORS[apiKey];
      if (!actorStub) {
        throw new ForbiddenException('Invalid API key');
      }
      request.actor = this.buildActor(actorStub, apiKey);
      return true;
    }

    // 2. Fall back to JWT Bearer token.
    const authHeader =
      (request.headers.authorization as string | undefined) ??
      (request.headers.Authorization as string | undefined);

    if (!authHeader) {
      throw new UnauthorizedException('Missing Authorization header');
    }

    const token = authHeader.replace(/^Bearer\s+/i, '');
    if (!token) {
      throw new UnauthorizedException('Empty Bearer token');
    }

    try {
      const payload = jwt.verify(token, config.jwtSecret, {
        clockTolerance: 30,
      }) as JwtPayload;

      request.actor = this.buildActorFromJwt(payload);
      return true;
    } catch {
      throw new UnauthorizedException('Invalid or expired token');
    }
  }

  private buildActor(
    stub: Pick<HrActor, 'actorType' | 'roles' | 'permissions'>,
    actorId: string,
  ): HrActor {
    return {
      actorType: stub.actorType,
      actorId: { value: actorId } as unknown as HrActor['actorId'],
      roles: stub.roles,
      permissions: stub.permissions,
      mfaAuthenticated: true,
    };
  }

  private buildActorFromJwt(payload: JwtPayload): HrActor {
    return {
      actorType: (payload.actor_type as HrActor['actorType']) ?? 'USER',
      actorId: { value: payload.sub } as unknown as HrActor['actorId'],
      roles: payload.roles ?? [],
      permissions: payload.permissions ?? [],
      sessionId: payload.session_id,
      mfaAuthenticated: payload.mfa_authenticated ?? false,
    };
  }
}
