import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Request } from 'express';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { generateCorrelationId } from '@hcm/platform-core';

/**
 * Wraps successful HTTP responses in the standard ApiResponse envelope
 * { success: true, data: <payload>, correlationId: string }.
 *
 * Skips wrapping if the payload already carries a `success` field
 * (e.g. CommandOutcome objects returned by the CommandBus).
 */
@Injectable()
export class TransformInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const ctx = context.switchToHttp();
    const request = ctx.getRequest<Request>();
    const correlationId =
      (request.headers['x-correlation-id'] as string | undefined) ??
      generateCorrelationId().value;

    return next.handle().pipe(
      map((data: unknown) => {
        if (
          data !== null &&
          typeof data === 'object' &&
          'success' in data
        ) {
          // Already wrapped or is a CommandOutcome — pass through.
          return data;
        }
        return {
          success: true,
          data,
          correlationId,
        };
      }),
    );
  }
}
