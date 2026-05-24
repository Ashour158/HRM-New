import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { AuditLedgerService } from '@hcm/platform-core';
import { Uuid } from '@hcm/shared-kernel';

const MUTATION_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

/**
 * Intercepts mutation requests and writes a lightweight audit record.
 * Attaches the generated auditRecordId to the response header.
 */
@Injectable()
export class AuditInterceptor implements NestInterceptor {
  constructor(private readonly auditLedger: AuditLedgerService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const ctx = context.switchToHttp();
    const request = ctx.getRequest<Request>();
    const response = ctx.getResponse<Response>();

    if (!MUTATION_METHODS.has(request.method)) {
      return next.handle();
    }

    const auditRecordId = Uuid.generate();
    const actor = request.actor;
    const tenantId = request.tenantId ?? 'unknown';
    const correlationId = request.correlationId ?? 'unknown';

    return next.handle().pipe(
      tap(async () => {
        response.setHeader('X-Audit-Record-Id', auditRecordId.value);
        try {
          await this.auditLedger.write({
            id: auditRecordId,
            tenantId: new Uuid(tenantId),
            actorType: actor?.actorType ?? 'UNKNOWN',
            actorId: new Uuid(actor?.actorId.value ?? Uuid.generate().value),
            action: `${request.method} ${request.route?.path ?? request.path}`,
            resourceType: context.getClass().name,
            resourceId: auditRecordId, // placeholder; real resource ID would come from handler result
            payload: { body: this.sanitizeBody(request.body) },
            occurredAt: new Date(),
            correlationId: new Uuid(correlationId),
            dataClassification: 'CONFIDENTIAL',
            legalHoldStatus: 'NONE',
            retentionClass: 'STANDARD',
          });
        } catch {
          // Audit failures are non-blocking for the request.
        }
      }),
    );
  }

  private sanitizeBody(body: unknown): Record<string, unknown> | undefined {
    if (typeof body !== 'object' || body === null) {
      return undefined;
    }
    const clone = JSON.parse(JSON.stringify(body)) as Record<string, unknown>;
    const sensitiveKeys = [
      'password',
      'ssn',
      'nationalId',
      'sin',
      'passportNumber',
      'biometric',
      'token',
    ];
    for (const key of sensitiveKeys) {
      if (key in clone) {
        clone[key] = '***REDACTED***';
      }
    }
    return clone;
  }
}
