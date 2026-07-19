/**
 * Tenant resolution strategies for the HR/HCM platform.
 */

import { createHmac, timingSafeEqual } from 'node:crypto';
import { Uuid, Result, Ok, Err } from '@hcm/shared-kernel';
import { DomainError } from '@hcm/shared-kernel';

const DEV_DEFAULT_JWT_SECRET = 'change-me-in-production';

/**
 * Error raised when tenant resolution fails.
 */
export class TenantResolutionError extends DomainError {
  readonly code = 'TENANT_RESOLUTION_ERROR';
  readonly terminal: boolean;

  constructor(message: string, details?: Record<string, unknown>, terminal = false) {
    super(message, details);
    this.terminal = terminal;
  }
}

/**
 * Strategy for resolving a tenant identifier from an incoming request.
 */
export interface TenantResolver {
  /**
   * Attempt to extract a tenant UUID from the request.
   * @param request - The incoming request object.
   * @returns A Result containing the tenant UUID or a resolution error.
   */
  resolve(request: unknown): Promise<Result<Uuid, TenantResolutionError>>;
}

/**
 * Resolves the tenant from a JWT claim.
 *
 * Expects the request to expose `headers.authorization` as a Bearer token.
 * The decoded JWT payload must contain a `tenant_id` claim.
 */
export class JwtTenantResolver implements TenantResolver {
  private readonly jwtSecret: string;

  /**
   * @param jwtSecret - The secret used to verify the JWT signature.
   */
  constructor(jwtSecret: string) {
    this.jwtSecret = jwtSecret;
  }

  async resolve(request: unknown): Promise<Result<Uuid, TenantResolutionError>> {
    try {
      const headers = (request as Record<string, unknown>)?.headers as
        | Record<string, string>
        | undefined;
      const authHeader = headers?.authorization ?? headers?.Authorization;
      if (!authHeader) {
        return new Err(new TenantResolutionError('Missing Authorization header'));
      }

      const token = authHeader.replace(/^Bearer\s+/i, '');
      if (!token) {
        return new Err(new TenantResolutionError('Empty Bearer token', undefined, true));
      }

      if (!this.jwtSecret) {
        return new Err(
          new TenantResolutionError('JWT secret is not configured', undefined, true)
        );
      }

      const parts = token.split('.');
      if (parts.length !== 3) {
        return new Err(new TenantResolutionError('Malformed JWT', undefined, true));
      }

      const [encodedHeader, encodedPayload, encodedSignature] = parts;
      const headerJson = Buffer.from(encodedHeader, 'base64url').toString('utf-8');
      const header = JSON.parse(headerJson) as Record<string, unknown>;
      if (header.alg !== 'HS256') {
        return new Err(
          new TenantResolutionError('Unsupported JWT signing algorithm', { alg: header.alg }, true)
        );
      }

      const expectedSignature = createHmac('sha256', this.jwtSecret)
        .update(`${encodedHeader}.${encodedPayload}`)
        .digest();
      const actualSignature = Buffer.from(encodedSignature, 'base64url');
      if (
        expectedSignature.length !== actualSignature.length ||
        !timingSafeEqual(expectedSignature, actualSignature)
      ) {
        return new Err(new TenantResolutionError('Invalid JWT signature', undefined, true));
      }

      const payloadJson = Buffer.from(encodedPayload, 'base64url').toString('utf-8');
      const payload = JSON.parse(payloadJson) as Record<string, unknown>;
      const now = Math.floor(Date.now() / 1000);
      if (typeof payload.exp === 'number' && now - 30 >= payload.exp) {
        return new Err(new TenantResolutionError('Expired JWT', undefined, true));
      }
      if (typeof payload.nbf === 'number' && now + 30 < payload.nbf) {
        return new Err(new TenantResolutionError('JWT is not active yet', undefined, true));
      }

      const tenantIdClaim = payload.tenant_id as string | undefined;

      if (!tenantIdClaim || !Uuid.isValid(tenantIdClaim)) {
        return new Err(
          new TenantResolutionError('JWT missing valid tenant_id claim', { payload })
        );
      }

      return new Ok(new Uuid(tenantIdClaim));
    } catch (cause) {
      return new Err(
        new TenantResolutionError(
          'JWT tenant resolution failed',
          { cause: String(cause) },
          true,
        )
      );
    }
  }
}

/**
 * Resolves the tenant from the `X-Tenant-ID` HTTP header.
 */
export class HeaderTenantResolver implements TenantResolver {
  async resolve(request: unknown): Promise<Result<Uuid, TenantResolutionError>> {
    const req = request as Record<string, unknown>;
    const headers = req?.headers as Record<string, string> | undefined;
    const actor = req?.actor as { actorType?: string; tenantId?: string } | undefined;

    // SYSTEM/INTEGRATION/SERVICE_ACCOUNT actors authenticate with an API key
    // rather than a per-tenant JWT (HCM-P0-4). A caller-supplied X-Tenant-ID
    // header must never be trusted for them: a single leaked/shared
    // SYSTEM_API_KEY or INTEGRATION_API_KEY would otherwise let the holder
    // read or write ANY tenant's data just by naming it. Only a credential
    // that is itself bound to a tenant (a SERVICE_ACCOUNT credential --
    // see AuthGuard.resolveServiceAccountActor) may resolve a tenant here,
    // and that binding always wins over whatever header the client sent.
    if (actor?.actorType === 'SYSTEM' || actor?.actorType === 'INTEGRATION' || actor?.actorType === 'SERVICE_ACCOUNT') {
      if (actor.tenantId && Uuid.isValid(actor.tenantId)) {
        return new Ok(new Uuid(actor.tenantId));
      }
      return new Err(
        new TenantResolutionError(
          'This credential is not bound to a tenant and cannot access tenant-scoped resources',
          { actorType: actor.actorType },
          true,
        ),
      );
    }

    const headerValue = headers?.['x-tenant-id'] ?? headers?.['X-Tenant-ID'];

    if (!headerValue) {
      return new Err(new TenantResolutionError('Missing X-Tenant-ID header'));
    }

    if (!Uuid.isValid(headerValue)) {
      return new Err(
        new TenantResolutionError('Invalid X-Tenant-ID header value', { headerValue })
      );
    }

    return new Ok(new Uuid(headerValue));
  }
}

/**
 * Chains multiple resolvers and returns the first successful result.
 */
export class ChainTenantResolver implements TenantResolver {
  /**
   * @param resolvers - Ordered list of resolvers to try.
   */
  constructor(private readonly resolvers: TenantResolver[]) {}

  async resolve(request: unknown): Promise<Result<Uuid, TenantResolutionError>> {
    const errors: TenantResolutionError[] = [];

    for (const resolver of this.resolvers) {
      const result = await resolver.resolve(request);
      if (result.isOk()) {
        return result;
      }
      const shouldStop = result.match(
        () => false,
        (err) => err.terminal,
      );
      if (shouldStop) {
        return new Err(
          new TenantResolutionError('JWT tenant resolution failed', undefined, true)
        );
      }
      result.match(
        () => {},
        (err) => errors.push(err)
      );
    }

    return new Err(
      new TenantResolutionError('All tenant resolvers failed', {
        errors: errors.map((e) => ({ message: e.message, code: e.code })),
      })
    );
  }
}

function resolveTenantJwtSecretFromEnv(): string {
  const jwtSecret = process.env.JWT_SECRET ?? DEV_DEFAULT_JWT_SECRET;
  if (process.env.NODE_ENV === 'production' && jwtSecret === DEV_DEFAULT_JWT_SECRET) {
    return '';
  }
  return jwtSecret;
}

/**
 * Default tenant resolver singleton.
 *
 * Tries JWT first, then falls back to the `X-Tenant-ID` header.
 * Uses `JWT_SECRET` from the environment for JWT verification.
 */
export const tenantResolver: TenantResolver = new ChainTenantResolver([
  new JwtTenantResolver(resolveTenantJwtSecretFromEnv()),
  new HeaderTenantResolver(),
]);
