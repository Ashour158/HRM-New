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
import { Uuid } from '@hcm/shared-kernel';

interface JwtPayload {
  sub: string;
  email?: string;
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
  'system' | 'integration',
  Pick<HrActor, 'actorType' | 'actorId' | 'roles' | 'permissions'>
> = {
  system: {
    actorType: 'SYSTEM',
    actorId: new Uuid('00000000-0000-4000-8000-000000000001'),
    roles: ['SYSTEM_ACTOR'],
    permissions: [],
  },
  integration: {
    actorType: 'INTEGRATION',
    actorId: new Uuid('00000000-0000-4000-8000-000000000002'),
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
      const actorStub = this.resolveApiKeyActor(apiKey, config);
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
      (request.actor as HrActor & { email?: string }).email = payload.email;
      return true;
    } catch {
      throw new UnauthorizedException('Invalid or expired token');
    }
  }

  private resolveApiKeyActor(
    apiKey: string,
    config: ReturnType<typeof loadAppConfig>,
  ): Pick<HrActor, 'actorType' | 'actorId' | 'roles' | 'permissions'> | undefined {
    if (apiKey === config.systemApiKey) {
      return API_KEY_ACTORS.system;
    }
    if (apiKey === config.integrationApiKey) {
      return API_KEY_ACTORS.integration;
    }
    return undefined;
  }

  private buildActor(
    stub: Pick<HrActor, 'actorType' | 'actorId' | 'roles' | 'permissions'>,
    _apiKey: string,
  ): HrActor {
    return {
      actorType: stub.actorType,
      actorId: stub.actorId,
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
