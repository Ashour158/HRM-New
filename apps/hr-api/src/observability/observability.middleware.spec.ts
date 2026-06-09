import { EventEmitter } from 'node:events';
import { describe, expect, it, vi } from 'vitest';
import { ObservabilityMetricsService } from './observability-metrics.service.js';
import { ObservabilityMiddleware } from './observability.middleware.js';
import { StructuredLoggerService, type StructuredLogEntry } from './structured-logger.service.js';

class CapturingLogger extends StructuredLoggerService {
  entries: StructuredLogEntry[] = [];

  override info(entry: StructuredLogEntry): void {
    this.entries.push(this.format('info', entry));
  }
}

describe('ObservabilityMiddleware', () => {
  it('adds correlation and trace headers, then records latency and structured request logs', () => {
    const metrics = new ObservabilityMetricsService();
    const logger = new CapturingLogger();
    const middleware = new ObservabilityMiddleware(metrics, logger);
    const response = new EventEmitter() as EventEmitter & {
      statusCode: number;
      setHeader: (name: string, value: string) => void;
      headers: Record<string, string>;
    };
    response.statusCode = 201;
    response.headers = {};
    response.setHeader = (name, value) => {
      response.headers[name] = value;
    };
    const request = {
      method: 'POST',
      path: '/api/v1/employee/absences/requests',
      originalUrl: '/api/v1/employee/absences/requests',
      headers: {
        'x-correlation-id': '00000000-0000-4000-8000-000000000099',
      },
      route: { path: '/employee/absences/requests' },
    };
    const next = vi.fn();

    middleware.use(request as never, response as never, next);
    response.emit('finish');

    expect(next).toHaveBeenCalledOnce();
    expect(request).toMatchObject({
      correlationId: '00000000-0000-4000-8000-000000000099',
    });
    expect(response.headers['X-Correlation-Id']).toBe('00000000-0000-4000-8000-000000000099');
    expect(response.headers.traceparent).toMatch(/^00-[a-f0-9]{32}-[a-f0-9]{16}-01$/);
    expect(metrics.renderPrometheus()).toContain('hcm_http_requests_total{method="POST",route="/employee/absences/requests",status_class="2xx",status_code="201"} 1');
    expect(logger.entries[0]).toMatchObject({
      level: 'info',
      eventType: 'HTTP_REQUEST',
      method: 'POST',
      route: '/employee/absences/requests',
      statusCode: 201,
      correlationId: '00000000-0000-4000-8000-000000000099',
    });
  });
});
