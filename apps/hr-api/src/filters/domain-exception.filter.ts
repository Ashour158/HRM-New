import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpStatus,
  HttpException,
  Logger,
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
 * Global exception filter producing a uniform error envelope.
 *
 * Precedence: framework `HttpException`s (incl. guard/pipe errors like
 * Forbidden/NotFound/validation) keep their own status and message; domain
 * errors map to their semantic HTTP status; anything else is a 500 and is
 * logged with its correlation id. Registered via `APP_FILTER`.
 */
@Catch()
export class DomainExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(DomainExceptionFilter.name);

  catch(error: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const correlationId =
      request.correlationId ??
      (request.headers['x-correlation-id'] as string | undefined) ??
      'unknown';

    const { status, errorCode, errorMessage, errorDetails } = this.describe(error);

    if (status >= HttpStatus.INTERNAL_SERVER_ERROR) {
      this.logger.error(
        { correlationId, errorCode, path: request.path, method: request.method },
        error instanceof Error ? error.stack : String(error),
      );
    }

    const body: ErrorResponse = {
      success: false,
      errorCode,
      errorMessage,
      errorDetails,
      correlationId,
      timestamp: new Date().toISOString(),
    };

    response.status(status).json(body);
  }

  private describe(error: unknown): {
    status: number;
    errorCode: string;
    errorMessage: string;
    errorDetails?: Record<string, unknown>;
  } {
    // Framework exceptions (guards, pipes, explicit throws) own their status.
    if (error instanceof HttpException) {
      const res = error.getResponse();
      const detail = typeof res === 'object' && res !== null ? (res as Record<string, unknown>) : undefined;
      const message = detail && 'message' in detail ? detail.message : error.message;
      return {
        status: error.getStatus(),
        errorCode: (detail?.error as string) ?? error.name ?? 'HTTP_EXCEPTION',
        errorMessage: Array.isArray(message) ? message.join('; ') : String(message ?? error.message),
        errorDetails: detail,
      };
    }
    if (error instanceof DomainError) {
      return {
        status: this.resolveDomainStatus(error),
        errorCode: error.code,
        errorMessage: error.message,
        errorDetails: error.details ?? undefined,
      };
    }
    return {
      status: HttpStatus.INTERNAL_SERVER_ERROR,
      errorCode: 'INTERNAL_ERROR',
      errorMessage: error instanceof Error ? error.message : 'Internal server error',
    };
  }

  private resolveDomainStatus(error: DomainError): number {
    if (error instanceof BadRequestError) return HttpStatus.BAD_REQUEST;
    if (error instanceof UnauthorizedError) return HttpStatus.UNAUTHORIZED;
    if (error instanceof ForbiddenError) return HttpStatus.FORBIDDEN;
    if (error instanceof NotFoundError) return HttpStatus.NOT_FOUND;
    if (error instanceof ConflictError) return HttpStatus.CONFLICT;
    if (error instanceof ValidationError) return HttpStatus.UNPROCESSABLE_ENTITY;
    return HttpStatus.INTERNAL_SERVER_ERROR;
  }
}
