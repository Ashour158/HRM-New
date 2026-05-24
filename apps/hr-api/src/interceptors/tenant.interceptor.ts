import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  UnauthorizedException,
  ForbiddenException,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { Observable } from 'rxjs';
import {
  tenantResolver,
  runWithTenant,
  TenantValidator,
} from '@hcm/platform-core';
import { getPool } from '@hcm/database';
import { createKyselyInstance } from '@hcm/database';

/**
 * Resolves the tenant from the incoming request, validates that it is
 * active, and runs the remainder of the request inside a tenant
 * AsyncLocalStorage context.
 */
@Injectable()
export class TenantInterceptor implements NestInterceptor {
  async intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Promise<Observable<unknown>> {
    const ctx = context.switchToHttp();
    const request = ctx.getRequest<Request>();
    const response = ctx.getResponse<Response>();

    // Skip tenant resolution for public health and documentation routes.
    const path = request.path ?? request.url;
    if (typeof path === 'string' &&
      (path === '/health' || path === '/health/ready' || path === '/health/live' ||
       path.endsWith('/health') || path.endsWith('/health/ready') || path.endsWith('/health/live') ||
       path === '/api/docs' || path.startsWith('/api/docs') ||
       path === '/api/v1/auth/login' || path === '/api/v1/auth/logout' ||
       path.startsWith('/api/v1/auth/'))) {
      return next.handle();
    }

    const result = await tenantResolver.resolve(request);

    const tenantId = result.match(
      (id) => id,
      (err) => {
        throw new UnauthorizedException(
          err.message ?? 'Tenant resolution failed',
        );
      },
    );

    // Validate tenant is active.
    const pool = getPool();
    const db = createKyselyInstance(pool);
    const validator = new TenantValidator(db);
    const validation = await validator.validateTenantActive(tenantId);

    if (validation.isErr()) {
      throw new ForbiddenException(`Tenant ${tenantId.value} is inactive`);
    }

    request.tenantId = tenantId.value;
    response.setHeader('X-Tenant-ID', tenantId.value);

    return new Observable((subscriber) => {
      runWithTenant(tenantId, async () => {
        try {
          const observable = await next.handle().toPromise();
          subscriber.next(observable);
          subscriber.complete();
        } catch (err) {
          subscriber.error(err);
        }
      }).catch((err: unknown) => {
        subscriber.error(err);
      });
    });
  }
}
