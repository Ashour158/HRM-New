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

Scheduler runs by status:

```promql
sum(rate(hcm_scheduler_job_runs_total[15m])) by (job_name, status)
```

Scheduler p95 duration:

```promql
quantile_over_time(0.95, hcm_scheduler_job_duration_seconds_sum[30m] / clamp_min(hcm_scheduler_job_duration_seconds_count[30m], 1))
```

Scheduler items processed:

```promql
max_over_time(hcm_scheduler_job_items_processed[30m]) by (job_name)
```

Scheduler failed on multiple tenants:

```promql
sum(increase(hcm_scheduler_job_runs_total{status="FAILED"}[30m])) by (job_name) > 3
```

Scheduler did not run within expected window:

```promql
time() - max by (job_name) (timestamp(hcm_scheduler_job_runs_total{status=~"SUCCEEDED|FAILED|SKIPPED"})) > 7200
```

Stuck running detection:

```sql
select tenant_id, job_name, period_key, started_at
from hr_platform.scheduler_job_runs
where status = 'RUNNING'
  and started_at < now() - interval '30 minutes';
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

## Scheduler Automation Failures

1. Open `Admin Panel -> Automation`.
2. Filter by `FAILED`, inspect the last error, items processed, period key, and finished time.
3. Check whether the failure is tenant-specific or affects multiple tenants with the failed-on-multiple-tenants alert.
4. Confirm the job is enabled for the tenant and that the tenant cron override matches the expected business window.
5. For stale `RUNNING` rows, inspect the stuck-running query, API logs, and the command/outbox traces for the same `job_name` and `period_key`.
6. Fix the upstream blocker, then use `Run now` from the Automation page. The manual run uses the same job ledger, tenant context, command bus, audit, and outbox path as scheduled runs.
7. If a job must be paused, disable it for the tenant from Automation and record the operator reason in the incident.

## Scheduler Dashboard Panel

Recommended panel set:

- Runs by status, grouped by job and tenant.
- Failure count over 30 minutes, with an alert when a job fails on more than `N` tenants.
- Duration p95 by job.
- Items processed by job.
- Jobs not run within their expected window.
- Stuck `RUNNING` ledger rows older than the configured maximum duration.

Alert thresholds should start conservative:

- Critical: any payroll, policy, access, notification, or reporting job failed on more than three tenants in 30 minutes.
- Warning: any job has not run within twice its expected window.
- Warning: any `RUNNING` row older than 30 minutes.
- Warning: items processed is zero for a job that normally processes records during an active business period.

## Node Not Ready

1. Confirm scope: is this one node or several? `kubectl get nodes` and check `kube_node_status_condition{condition="Ready"}` for the affected node(s).
2. If several nodes are affected simultaneously, treat this as a possible full outage -- see [full-outage-runbook.md](full-outage-runbook.md), not a single-node repair.
3. For a single node: check `kubectl describe node <name>` for the reported condition (disk pressure, memory pressure, network unavailable, kubelet not posting status).
4. If the node is unrecoverable, cordon and drain it (`kubectl cordon` / `kubectl drain`) so the scheduler moves pods elsewhere, then investigate/replace the node per the cluster provider's runbook.

## Node Disk Pressure

1. Identify the affected node and filesystem from the alert labels.
2. Check what is consuming space -- container image cache, log volumes, or PVCs (including the backup/restore-drill PVCs) are the most common causes on this deployment.
3. Clear reclaimable space (unused images via `crictl rmi`/`docker system prune`, rotated logs) before resizing storage.
4. If backup retention (`deploy/k8s/base/backup-cronjob.yaml`, currently 35 days) is the cause, confirm the PVC size is provisioned for the documented retention window before shrinking retention as a workaround.

## Pod Crash Looping

1. `kubectl logs <pod> --previous` to see the last crash's output before it restarted.
2. `kubectl describe pod <pod>` for the exact `CrashLoopBackOff` reason and recent events.
3. Cross-reference with the [High API Error Rate](#high-api-error-rate) and [High API Latency](#high-api-latency) sections if the crashing pod is `hcm-api` -- a bad deploy or a downstream dependency outage are the most common causes.
4. If a recent deploy is the cause, roll back to the previous image tag (`deploy/k8s/base/kustomization.yaml`) rather than debugging forward under production load.

## Migration Job Failed

1. `kubectl logs job/hcm-database-migrate` for the failing migration's exact error.
2. Do not re-run the migration Job blindly -- confirm from the log whether it failed before or after any DDL was applied, since partial migrations can leave the schema in an inconsistent state.
3. See [migration-rollback-policy.md](migration-rollback-policy.md) for how to handle a partially-applied migration.
4. Once fixed, re-run via the same path CI uses (`pnpm --filter @hcm/database migrate`) rather than applying DDL by hand, so the migration ledger stays authoritative.

## Database Connection Pool Near Exhaustion

1. Check which service is consuming connections -- `pg_stat_activity` grouped by `application_name` (the pool's `appName`, see `packages/hr-database/src/connection/pool.ts`) identifies the caller.
2. Compare current replica count against the connection-pool budget documented in [GO-LIVE-RUNBOOK.md](GO-LIVE-RUNBOOK.md) (`maxReplicas × (DB_POOL_MAX + DB_SYSTEM_POOL_MAX)` against Postgres's `max_connections`) -- an unplanned HPA scale-out is the most common cause of this alert.
3. If a specific query/transaction is holding connections open (long-running report, stuck migration), terminate it via `pg_terminate_backend` after confirming it is safe to do so.
4. If sustained, this is a capacity-planning signal, not just an incident -- raise `DB_POOL_MAX`/`max_connections` or reduce `maxReplicas` deliberately rather than repeatedly firefighting the alert.

## Alert Rules

Prometheus alert rules are provided in:

```text
deploy/observability/prometheus-rules.yaml
```

Import them into the tenant's Prometheus or Grafana Mimir/Loki/Tempo stack together with a dashboard using the queries above.
