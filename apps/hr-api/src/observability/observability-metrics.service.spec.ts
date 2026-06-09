import { describe, expect, it } from 'vitest';
import { ObservabilityMetricsService } from './observability-metrics.service.js';

describe('ObservabilityMetricsService', () => {
  it('renders Prometheus request latency and error metrics with bounded labels', () => {
    const metrics = new ObservabilityMetricsService();

    metrics.recordHttpRequest({
      method: 'GET',
      route: '/api/v1/hr/core/workers/00000000-0000-4000-8000-000000000123',
      statusCode: 500,
      durationMs: 125,
    });

    const output = metrics.renderPrometheus();

    expect(output).toContain('# HELP hcm_http_requests_total Total HTTP requests handled by the API.');
    expect(output).toContain('hcm_http_requests_total{method="GET",route="/api/v1/hr/core/workers/:uuid",status_class="5xx",status_code="500"} 1');
    expect(output).toContain('hcm_http_request_duration_seconds_sum{method="GET",route="/api/v1/hr/core/workers/:uuid",status_class="5xx"} 0.125');
    expect(output).toContain('hcm_http_errors_total{method="GET",route="/api/v1/hr/core/workers/:uuid",status_class="5xx",status_code="500"} 1');
    expect(output).toContain('hcm_process_uptime_seconds');
  });

  it('records outbox and inbox counters for event processing dashboards', () => {
    const metrics = new ObservabilityMetricsService();

    metrics.recordOutboxPublish({ eventName: 'LeaveRequestApproved', status: 'published' });
    metrics.recordInboxProcess({ consumerName: 'notification-bridge', eventName: 'LeaveRequestApproved', status: 'failed_retryable' });

    const output = metrics.renderPrometheus();

    expect(output).toContain('hcm_outbox_events_total{event_name="LeaveRequestApproved",status="published"} 1');
    expect(output).toContain('hcm_inbox_events_total{consumer_name="notification-bridge",event_name="LeaveRequestApproved",status="failed_retryable"} 1');
  });
});
