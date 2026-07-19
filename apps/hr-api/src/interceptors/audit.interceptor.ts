import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  InternalServerErrorException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request, Response } from 'express';
import { Observable } from 'rxjs';
import { mergeMap } from 'rxjs/operators';
import { AuditLedgerService, redactSensitiveFields } from '@hcm/platform-core';
import { Uuid } from '@hcm/shared-kernel';
import { PUBLIC_ROUTE_KEY } from '../decorators/public.decorator.js';

const MUTATION_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

/**
 * Intercepts non-command mutation requests and writes an authoritative HTTP
 * fallback audit record. CommandBus results already include audit evidence, so
 * this interceptor only propagates their audit id to the response header.
 */
@Injectable()
export class AuditInterceptor implements NestInterceptor {
  constructor(
    private readonly auditLedger: AuditLedgerService,
    private readonly reflector: Reflector,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const ctx = context.switchToHttp();
    const request = ctx.getRequest<Request>();
    const response = ctx.getResponse<Response>();

    if (!MUTATION_METHODS.has(request.method)) {
      return next.handle();
    }

    const isPublic = this.reflector.getAllAndOverride<boolean>(PUBLIC_ROUTE_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) {
      return next.handle();
    }

    return next.handle().pipe(
      mergeMap(async (result) => {
        const commandAuditRecordId = this.auditRecordIdFromResult(result);
        if (commandAuditRecordId) {
          response.setHeader('X-Audit-Record-Id', commandAuditRecordId.value);
          return result;
        }

        const auditRecordId = Uuid.generate();
        const actor = request.actor;
        const tenantId = this.requireUuid(request.tenantId, 'tenant');
        const actorId = this.requireUuid(actor?.actorId?.value, 'actor');
        const correlationId = this.requireUuid(
          request.correlationId ?? (request.headers?.['x-correlation-id'] as string | undefined),
          'correlation',
        );
        const resource = this.resolveResourceId(request, result, tenantId);

        await this.auditLedger.write({
          id: auditRecordId,
          tenantId,
          actorType: actor?.actorType ?? 'UNKNOWN',
          actorId,
          action: `${request.method} ${request.route?.path ?? request.path}`,
          resourceType: context.getClass().name,
          resourceId: resource.id,
          payload: {
            body: this.sanitizeBody(request.body),
            resourceIdSource: resource.source,
          },
          occurredAt: new Date(),
          correlationId,
          dataClassification: 'CONFIDENTIAL',
          legalHoldStatus: 'NONE',
          retentionClass: 'STANDARD',
        });
        response.setHeader('X-Audit-Record-Id', auditRecordId.value);
        return result;
      }),
    );
  }

  private auditRecordIdFromResult(result: unknown): Uuid | undefined {
    const value = this.valueAt(result, ['auditRecordId']) ?? this.valueAt(result, ['data', 'auditRecordId']);
    return this.uuidFromUnknown(value);
  }

  private resolveResourceId(
    request: Request,
    result: unknown,
    tenantId: Uuid,
  ): { id: Uuid; source: string } {
    const routeId = this.uuidFromUnknown((request.params as Record<string, unknown> | undefined)?.id);
    if (routeId) return { id: routeId, source: 'route.params.id' };

    const responseId = this.uuidFromUnknown(this.valueAt(result, ['id']));
    if (responseId) return { id: responseId, source: 'response.id' };

    const responseDataId = this.uuidFromUnknown(this.valueAt(result, ['data', 'id']));
    if (responseDataId) return { id: responseDataId, source: 'response.data.id' };

    return { id: tenantId, source: 'tenant' };
  }

  private requireUuid(value: unknown, label: string): Uuid {
    const uuid = this.uuidFromUnknown(value);
    if (!uuid) {
      throw new InternalServerErrorException(`Mutation audit requires a valid ${label} UUID`);
    }
    return uuid;
  }

  private uuidFromUnknown(value: unknown): Uuid | undefined {
    if (value instanceof Uuid) return value;
    if (typeof value === 'string' && Uuid.isValid(value)) return new Uuid(value);
    if (
      typeof value === 'object' &&
      value !== null &&
      'value' in value &&
      typeof (value as { value?: unknown }).value === 'string' &&
      Uuid.isValid((value as { value: string }).value)
    ) {
      return new Uuid((value as { value: string }).value);
    }
    return undefined;
  }

  private valueAt(source: unknown, path: string[]): unknown {
    let current = source;
    for (const segment of path) {
      if (typeof current !== 'object' || current === null || !(segment in current)) return undefined;
      current = (current as Record<string, unknown>)[segment];
    }
    return current;
  }

  private sanitizeBody(body: unknown): unknown {
    if (typeof body !== 'object' || body === null) {
      return undefined;
    }
    return redactSensitiveFields(body);
  }
}
