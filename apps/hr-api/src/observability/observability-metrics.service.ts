import { Injectable } from '@nestjs/common';

export interface HttpRequestMetricInput {
  method: string;
  route: string;
  statusCode: number;
  durationMs: number;
}

export interface OutboxMetricInput {
  eventName: string;
  status: 'scheduled' | 'published' | 'failed' | 'skipped';
}

export interface InboxMetricInput {
  consumerName: string;
  eventName: string;
  status: 'success' | 'failed_retryable' | 'failed_non_retryable' | 'deduplicated' | 'skipped';
}

type HttpMetric = {
  count: number;
  sumSeconds: number;
  buckets: number[];
  labels: {
    method: string;
    route: string;
    statusClass: string;
    statusCode: string;
  };
};

const DURATION_BUCKETS_SECONDS = [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10];

@Injectable()
export class ObservabilityMetricsService {
  private readonly startedAt = Date.now();
  private readonly httpRequests = new Map<string, HttpMetric>();
  private readonly outboxEvents = new Map<string, { count: number; eventName: string; status: string }>();
  private readonly inboxEvents = new Map<string, { count: number; consumerName: string; eventName: string; status: string }>();

  recordHttpRequest(input: HttpRequestMetricInput): void {
    const statusClass = `${Math.floor(input.statusCode / 100)}xx`;
    const route = normalizeRoute(input.route);
    const labels = {
      method: input.method.toUpperCase(),
      route,
      statusClass,
      statusCode: String(input.statusCode),
    };
    const key = [
      labels.method,
      labels.route,
      labels.statusClass,
      labels.statusCode,
    ].join('|');
    const metric = this.httpRequests.get(key) ?? {
      count: 0,
      sumSeconds: 0,
      buckets: DURATION_BUCKETS_SECONDS.map(() => 0),
      labels,
    };
    const seconds = Math.max(0, input.durationMs / 1000);
    metric.count += 1;
    metric.sumSeconds += seconds;
    DURATION_BUCKETS_SECONDS.forEach((bucket, index) => {
      if (seconds <= bucket) metric.buckets[index] += 1;
    });
    this.httpRequests.set(key, metric);
  }

  recordOutboxPublish(input: OutboxMetricInput): void {
    const eventName = sanitizeLabelValue(input.eventName);
    const key = `${eventName}|${input.status}`;
    const current = this.outboxEvents.get(key) ?? { count: 0, eventName, status: input.status };
    current.count += 1;
    this.outboxEvents.set(key, current);
  }

  recordInboxProcess(input: InboxMetricInput): void {
    const consumerName = sanitizeLabelValue(input.consumerName);
    const eventName = sanitizeLabelValue(input.eventName);
    const key = `${consumerName}|${eventName}|${input.status}`;
    const current = this.inboxEvents.get(key) ?? {
      count: 0,
      consumerName,
      eventName,
      status: input.status,
    };
    current.count += 1;
    this.inboxEvents.set(key, current);
  }

  renderPrometheus(): string {
    const lines: string[] = [];
    lines.push('# HELP hcm_observability_info Static metadata for the HRM Nexus API observability endpoint.');
    lines.push('# TYPE hcm_observability_info gauge');
    lines.push('hcm_observability_info{service="hr-api"} 1');
    lines.push('# HELP hcm_process_uptime_seconds Process uptime in seconds.');
    lines.push('# TYPE hcm_process_uptime_seconds gauge');
    lines.push(`hcm_process_uptime_seconds ${seconds(Date.now() - this.startedAt)}`);

    lines.push('# HELP hcm_http_requests_total Total HTTP requests handled by the API.');
    lines.push('# TYPE hcm_http_requests_total counter');
    for (const metric of this.httpRequests.values()) {
      lines.push(`hcm_http_requests_total{${httpRequestLabels(metric)}} ${metric.count}`);
    }

    lines.push('# HELP hcm_http_request_duration_seconds HTTP request latency in seconds.');
    lines.push('# TYPE hcm_http_request_duration_seconds histogram');
    for (const metric of this.httpRequests.values()) {
      let previous = 0;
      DURATION_BUCKETS_SECONDS.forEach((bucket, index) => {
        previous = Math.max(previous, metric.buckets[index] ?? 0);
        lines.push(`hcm_http_request_duration_seconds_bucket{${httpDurationLabels(metric)},le="${bucket}"} ${previous}`);
      });
      lines.push(`hcm_http_request_duration_seconds_bucket{${httpDurationLabels(metric)},le="+Inf"} ${metric.count}`);
      lines.push(`hcm_http_request_duration_seconds_sum{${httpDurationLabels(metric)}} ${seconds(metric.sumSeconds * 1000)}`);
      lines.push(`hcm_http_request_duration_seconds_count{${httpDurationLabels(metric)}} ${metric.count}`);
    }

    lines.push('# HELP hcm_http_errors_total Total HTTP error responses handled by the API.');
    lines.push('# TYPE hcm_http_errors_total counter');
    for (const metric of this.httpRequests.values()) {
      if (metric.labels.statusClass === '4xx' || metric.labels.statusClass === '5xx') {
        lines.push(`hcm_http_errors_total{${httpRequestLabels(metric)}} ${metric.count}`);
      }
    }

    lines.push('# HELP hcm_outbox_events_total Transactional outbox event processing counts.');
    lines.push('# TYPE hcm_outbox_events_total counter');
    for (const metric of this.outboxEvents.values()) {
      lines.push(`hcm_outbox_events_total{event_name="${metric.eventName}",status="${metric.status}"} ${metric.count}`);
    }

    lines.push('# HELP hcm_inbox_events_total Transactional inbox consumer processing counts.');
    lines.push('# TYPE hcm_inbox_events_total counter');
    for (const metric of this.inboxEvents.values()) {
      lines.push(`hcm_inbox_events_total{consumer_name="${metric.consumerName}",event_name="${metric.eventName}",status="${metric.status}"} ${metric.count}`);
    }

    return `${lines.join('\n')}\n`;
  }
}

function httpRequestLabels(metric: HttpMetric): string {
  return [
    `method="${metric.labels.method}"`,
    `route="${escapePrometheusLabel(metric.labels.route)}"`,
    `status_class="${metric.labels.statusClass}"`,
    `status_code="${metric.labels.statusCode}"`,
  ].join(',');
}

function httpDurationLabels(metric: HttpMetric): string {
  return [
    `method="${metric.labels.method}"`,
    `route="${escapePrometheusLabel(metric.labels.route)}"`,
    `status_class="${metric.labels.statusClass}"`,
  ].join(',');
}

export function normalizeRoute(route: string): string {
  const withoutQuery = route.split('?')[0] || '/';
  return withoutQuery
    .replace(/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/gi, ':uuid')
    .replace(/\/\d+(?=\/|$)/g, '/:number');
}

function sanitizeLabelValue(value: string): string {
  return escapePrometheusLabel(value.trim() || 'unknown');
}

function escapePrometheusLabel(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n');
}

function seconds(ms: number): string {
  return (ms / 1000).toFixed(3).replace(/\.?0+$/, '') || '0';
}
