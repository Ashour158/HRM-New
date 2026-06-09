import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { generateCorrelationId } from '@hcm/platform-core';

/**
 * Ensures every request carries a correlation ID (from header or
 * auto-generated) and echoes it back on the response.
 */
@Injectable()
export class CorrelationInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const ctx = context.switchToHttp();
    const request = ctx.getRequest<Request>();
    const response = ctx.getResponse<Response>();

    const correlationId =
      (request.headers['x-correlation-id'] as string | undefined) ??
      request.correlationId ??
      generateCorrelationId().value;

    request.correlationId = correlationId;

    return next.handle().pipe(
      tap(() => {
        response.setHeader('X-Correlation-Id', correlationId);
      }),
    );
  }
}
