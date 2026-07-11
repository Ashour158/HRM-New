import { createHash } from 'node:crypto';
import {
  Injectable,
  CanActivate,
  ExecutionContext,
  Logger,
  Optional,
  UnauthorizedException,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';
import jwt from 'jsonwebtoken';
import { createKyselyInstance, getPool, type Database } from '@hcm/database';
import type { Kysely } from 'kysely';
import { loadAppConfig } from '../config/app.config.js';
import type { HrActor } from '@hcm/command-contracts';
import { Uuid } from '@hcm/shared-kernel';
import { PUBLIC_ROUTE_KEY } from '../decorators/public.decorator.js';
import { loadAppConfigOrUndefined } from './load-app-config-safely.js';

const ACTIVE_SERVICE_ACCOUNT_STATUSES = new Set(['ACTIVE', 'ROTATION_DUE']);

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
  private readonly logger = new Logger(AuthGuard.name);
  private readonly db: Kysely<Database>;

  constructor(
    private readonly reflector: Reflector = new Reflector(),
    @Optional() db?: Kysely<Database>,
  ) {
    this.db = db ?? createKyselyInstance(getPool());
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.isPublicRoute(context);
    if (isPublic) return true;

    const request = context.switchToHttp().getRequest<Request>();
    if (request.actor) return true;

    // In production a missing/weak system credential makes loadAppConfig() throw
    // (strong-secret guard). That must DENY the request (403), not surface as an
    // unhandled 500 — a misconfigured or demo key never grants access.
    const config = loadAppConfigOrUndefined(this.logger, request.path, request.method);
    if (!config) {
      throw new ForbiddenException('Server authentication is not properly configured');
    }

    // 1. Try API key first (for SERVICE_ACCOUNT / SYSTEM / INTEGRATION actors).
    const apiKey =
      (request.headers[config.apiKeyHeader.toLowerCase()] as string | undefined) ??
      (request.headers[config.apiKeyHeader] as string | undefined);

    if (apiKey) {
      // Tenant-bound service-account credentials (HCM-P0-4) take priority: they
      // carry their own tenantId, unlike the legacy static SYSTEM/INTEGRATION
      // keys below, which are a single secret shared across every tenant.
      const serviceAccountActor = await this.resolveServiceAccountActor(apiKey);
      if (serviceAccountActor) {
        const actor = this.buildActor(serviceAccountActor, apiKey);
        (actor as HrActor & { tenantId?: string }).tenantId = serviceAccountActor.tenantId;
        request.actor = actor;
        return true;
      }

      const actorStub = this.resolveApiKeyActor(apiKey, config);
      if (!actorStub) {
        this.logger.warn({ eventType: 'AUTH_DENIED', reason: 'INVALID_API_KEY', route: request.path, method: request.method });
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
      this.logger.warn({ eventType: 'AUTH_DENIED', reason: 'MISSING_AUTH_HEADER', route: request.path, method: request.method });
      throw new UnauthorizedException('Missing Authorization header');
    }

    const token = authHeader.replace(/^Bearer\s+/i, '');
    if (!token) {
      this.logger.warn({ eventType: 'AUTH_DENIED', reason: 'EMPTY_BEARER_TOKEN', route: request.path, method: request.method });
      throw new UnauthorizedException('Empty Bearer token');
    }

    try {
      const payload = jwt.verify(token, config.jwtSecret, {
        clockTolerance: 30,
      }) as JwtPayload;

      request.actor = this.buildActorFromJwt(payload);
      (request.actor as HrActor & { email?: string; tenantId?: string }).email = payload.email;
      (request.actor as HrActor & { email?: string; tenantId?: string }).tenantId = payload.tenant_id;
      return true;
    } catch {
      this.logger.warn({ eventType: 'AUTH_DENIED', reason: 'INVALID_OR_EXPIRED_TOKEN', route: request.path, method: request.method });
      throw new UnauthorizedException('Invalid or expired token');
    }
  }

  private isPublicRoute(context: ExecutionContext): boolean {
    if (typeof context.getHandler !== 'function' || typeof context.getClass !== 'function') {
      return false;
    }
    return this.reflector.getAllAndOverride<boolean>(PUBLIC_ROUTE_KEY, [
      context.getHandler(),
      context.getClass(),
    ]) === true;
  }

  /**
   * Looks up the presented API key against tenant-bound service-account
   * credentials (issued via the Access Governance console) rather than the
   * single, tenant-unbound static SYSTEM_API_KEY/INTEGRATION_API_KEY secret.
   * Returns the tenant the credential is actually authorized for, so the
   * caller can never assert a different tenant via X-Tenant-ID (HCM-P0-4).
   */
  private async resolveServiceAccountActor(
    apiKey: string,
  ): Promise<(Pick<HrActor, 'actorType' | 'actorId' | 'roles' | 'permissions'> & { tenantId: string }) | undefined> {
    const secretHash = createHash('sha256').update(apiKey).digest('hex');
    const row = await this.db
      .selectFrom('service_account_credentials as cred')
      .innerJoin('service_accounts as account', 'account.id', 'cred.service_account_id')
      .select([
        'account.id as serviceAccountId',
        'account.tenant_id as tenantId',
        'account.status as accountStatus',
        'cred.scopes as scopes',
        'cred.expires_at as expiresAt',
      ])
      .where('cred.secret_hash', '=', secretHash)
      .where('cred.status', '=', 'ACTIVE')
      .executeTakeFirst();

    if (!row) return undefined;
    if (!ACTIVE_SERVICE_ACCOUNT_STATUSES.has(row.accountStatus)) return undefined;
    if (row.expiresAt && new Date(row.expiresAt).getTime() <= Date.now()) return undefined;

    const scopes = Array.isArray(row.scopes)
      ? row.scopes.filter((scope): scope is string => typeof scope === 'string')
      : [];

    return {
      actorType: 'SERVICE_ACCOUNT',
      actorId: new Uuid(row.serviceAccountId),
      roles: ['SERVICE_ACCOUNT'],
      permissions: scopes,
      tenantId: row.tenantId,
    };
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
