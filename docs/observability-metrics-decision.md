# Decision: keep the hand-written Prometheus metrics (not prom-client)

Status: accepted (2026-06-28). Addresses the readiness-audit note "replace hand-rolled
metrics with prom-client."

## Context
`apps/hr-api/src/observability/observability-metrics.service.ts` maintains in-memory
counters/histograms and renders the Prometheus text exposition for `/metrics`
(`hcm_http_requests_total`, `hcm_http_request_duration_seconds_*`, `hcm_http_errors_total`,
`hcm_outbox_events_total`, `hcm_inbox_events_total`, `hcm_process_uptime_seconds`).

The audit flagged two concerns: (1) "hand-rolled histogram math" and (2) in-memory state
"lost on restart."

## Assessment
1. **The exposition is correct.** Buckets are cumulative by construction (each observation
   increments every bucket whose `le` ≥ the latency), `+Inf` equals the count, and `_sum`/
   `_count` are emitted per series. `observability-metrics.service.spec.ts` asserts the exact
   metric names, bounded label sets, and bucket/sum/count lines. Labels are bounded (route
   templates, status class) so cardinality is controlled.
2. **In-memory is the correct pattern here, not a defect.** Prometheus is the durable store:
   it scrapes each pod, aggregates across replicas, and natively handles counter resets on
   restart via `rate()`/`increase()`. Per-pod in-memory counters scraped by Prometheus is the
   textbook setup; durability does not belong in the app process.

## Decision
Keep the current implementation. Do **not** adopt `prom-client`.

Rationale:
- No correctness gap to fix — the exposition is valid and tested.
- A swap is a lateral move with real regression risk: `deploy/observability/prometheus-rules.yaml`
  and dashboards depend on the exact metric names/labels; any rename breaks alerting.
- It adds a runtime dependency for marginal benefit.

## Revisit if
- We need exemplars/native histograms (OpenTelemetry metrics), or
- Label/cardinality management becomes non-trivial enough that a library pays for itself.
  At that point prefer the OpenTelemetry metrics SDK (already used for tracing) over
  prom-client, migrating metric-by-metric while preserving names.
