import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpStatus,
} from '@nestjs/common';
import { Request, Response } from 'express';
import {
  DomainError,
  BadRequestError,
  UnauthorizedError,
  ForbiddenError,
  NotFoundError,
  ConflictError,
  ValidationError,
} from '@hcm/shared-kernel';

interface ErrorResponse {
  success: false;
  errorCode: string;
  errorMessage: string;
  errorDetails?: Record<string, unknown>;
  correlationId?: string;
  timestamp: string;
}

/**
 * Maps domain errors to appropriate HTTP status codes and returns a
 * uniform error payload.
 */
@Catch(DomainError, Error)
export class DomainExceptionFilter implements ExceptionFilter {
  catch(error: DomainError | Error, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const status = this.resolveStatus(error);
    const correlationId =
      request.correlationId ??
      (request.headers['x-correlation-id'] as string | undefined) ??
      'unknown';

    const body: ErrorResponse = {
      success: false,
      errorCode: error instanceof DomainError ? error.code : 'INTERNAL_ERROR',
      errorMessage: error.message,
      errorDetails:
        error instanceof DomainError
          ? (error.details ?? undefined)
          : undefined,
      correlationId,
      timestamp: new Date().toISOString(),
    };

    response.status(status).json(body);
  }

  private resolveStatus(error: Error): number {
    if (error instanceof BadRequestError) return HttpStatus.BAD_REQUEST;
    if (error instanceof UnauthorizedError) return HttpStatus.UNAUTHORIZED;
    if (error instanceof ForbiddenError) return HttpStatus.FORBIDDEN;
    if (error instanceof NotFoundError) return HttpStatus.NOT_FOUND;
    if (error instanceof ConflictError) return HttpStatus.CONFLICT;
    if (error instanceof ValidationError) return HttpStatus.UNPROCESSABLE_ENTITY;
    return HttpStatus.INTERNAL_SERVER_ERROR;
  }
}
