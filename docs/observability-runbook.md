# HRM Nexus Observability Runbook

## Signals

The API exposes Prometheus metrics at:

```text
GET /api/v1/metrics
```

Every HTTP request receives:

- `X-Correlation-Id`
- `traceparent`

Set these variables to export OpenTelemetry traces to an OTLP collector:

```text
OTEL_ENABLED=true
OTEL_SERVICE_NAME=hr-api
OTEL_EXPORTER_OTLP_ENDPOINT=http://otel-collector:4318/v1/traces
```

Structured JSON logs include:

- `eventType`
- `correlationId`
- `traceId`
- `method`
- `route`
- `statusCode`
- `durationMs`
- `tenantId`
- `actorType`

## Dashboard Queries

API request volume:

```promql
sum(rate(hcm_http_requests_total[5m])) by (method, route, status_class)
```

API error rate:

```promql
sum(rate(hcm_http_errors_total[5m])) / clamp_min(sum(rate(hcm_http_requests_total[5m])), 1)
```

API p95 latency:

```promql
histogram_quantile(0.95, sum(rate(hcm_http_request_duration_seconds_bucket[5m])) by (le, route))
```

Transactional outbox processing:

```promql
sum(rate(hcm_outbox_events_total[5m])) by (event_name, status)
```

Transactional inbox processing:

```promql
sum(rate(hcm_inbox_events_total[5m])) by (consumer_name, event_name, status)
```

## High API Error Rate

1. Filter logs by `eventType="HTTP_REQUEST"` and `statusCode >= 400`.
2. Group by `route`, `tenantId`, and `actorType`.
3. Use `correlationId` and `traceId` to inspect the request path.
4. If failures are `401/403`, verify auth/permission configuration.
5. If failures are `5xx`, inspect the matching handler logs and recent deployment changes.

## High API Latency

1. Check the p95 latency dashboard by route.
2. Compare slow routes with database, outbox, and inbox activity.
3. Confirm whether the latency is isolated to one tenant or global.
4. If a queue backlog is present, pause non-critical batch jobs and recover queues from the dead-letter console.

## Outbox Or Inbox Failures

1. Open the System Console dead-letter operations screen.
2. Inspect failed inbox/outbox rows by event name and consumer.
3. Retry retryable rows after confirming the target service is healthy.
4. Skip only orphaned legacy rows or operator-approved non-replayable rows.
5. Export evidence for critical payroll, policy, compliance, or access events.

## Alert Rules

Prometheus alert rules are provided in:

```text
deploy/observability/prometheus-rules.yaml
```

Import them into the tenant's Prometheus or Grafana Mimir/Loki/Tempo stack together with a dashboard using the queries above.
