import { randomBytes, randomUUID } from 'node:crypto';
import { Injectable, NestMiddleware } from '@nestjs/common';
import { NextFunction, Request, Response } from 'express';
import { ObservabilityMetricsService } from './observability-metrics.service.js';
import { StructuredLoggerService } from './structured-logger.service.js';

@Injectable()
export class ObservabilityMiddleware implements NestMiddleware {
  constructor(
    private readonly metrics: ObservabilityMetricsService,
    private readonly logger: StructuredLoggerService,
  ) {}

  use(request: Request, response: Response, next: NextFunction): void {
    const startedAt = process.hrtime.bigint();
    const correlationId = this.correlationId(request);
    const trace = this.traceContext(request);

    request.correlationId = correlationId;
    request.traceId = trace.traceId;
    request.spanId = trace.spanId;
    response.setHeader('X-Correlation-Id', correlationId);
    response.setHeader('traceparent', `00-${trace.traceId}-${trace.spanId}-01`);

    response.on('finish', () => {
      const durationMs = Number(process.hrtime.bigint() - startedAt) / 1_000_000;
      const route = this.routeFor(request);
      this.metrics.recordHttpRequest({
        method: request.method,
        route,
        statusCode: response.statusCode,
        durationMs,
      });
      this.logger.info({
        eventType: 'HTTP_REQUEST',
        method: request.method,
        route,
        path: request.originalUrl ?? request.url,
        statusCode: response.statusCode,
        durationMs: Math.round(durationMs * 100) / 100,
        correlationId,
        traceId: trace.traceId,
        tenantId: request.tenantId,
        actorType: request.actor?.actorType,
      });
    });

    next();
  }

  private correlationId(request: Request): string {
    const header = request.headers['x-correlation-id'];
    if (typeof header === 'string' && header.trim()) return header.trim();
    return randomUUID();
  }

  private traceContext(request: Request): { traceId: string; spanId: string } {
    const traceparent = request.headers.traceparent;
    if (typeof traceparent === 'string') {
      const match = /^00-([a-f0-9]{32})-([a-f0-9]{16})-[a-f0-9]{2}$/i.exec(traceparent);
      if (match?.[1] && match?.[2]) {
        return {
          traceId: match[1].toLowerCase(),
          spanId: randomBytes(8).toString('hex'),
        };
      }
    }
    return {
      traceId: randomBytes(16).toString('hex'),
      spanId: randomBytes(8).toString('hex'),
    };
  }

  private routeFor(request: Request): string {
    const routePath = request.route?.path;
    if (typeof routePath === 'string' && routePath.trim()) return routePath;
    return request.path || request.originalUrl || request.url || 'unknown';
  }
}
