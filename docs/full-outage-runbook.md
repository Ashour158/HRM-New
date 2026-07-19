# HRM Nexus Full-Outage / Whole-Cluster Runbook

The existing [observability runbook](observability-runbook.md) assumes the
cluster and control plane are up and only one service is degraded. This
runbook covers the scenario where that assumption is false: total cluster
loss, region outage, control-plane unreachability, or a catastrophic
multi-service failure.

## Detection

A full-outage is distinct from a single-service degradation when **two or
more** of the following are true simultaneously:

- The API health endpoint (`GET /api/v1/health`) is unreachable, not just
  slow or erroring.
- The observability stack itself (Prometheus/Grafana or equivalent) is also
  unreachable -- if you can't see dashboards, treat that as a signal, not an
  observability outage to fix first.
- `kubectl get nodes` (or the equivalent for the deployed cluster) times out
  or shows all nodes `NotReady`.
- The database is unreachable from outside the cluster, not just from the
  app tier.

If only the app tier is down but the cluster/control-plane/database are
healthy, use the observability runbook's per-service procedures instead --
this runbook is for the case where those procedures themselves are
unreachable.

## Declaring the incident

1. The first responder to confirm 2+ of the detection signals above declares
   a **SEV-1 full outage**, not a routine incident.
2. Do not wait for automated paging to confirm this -- if Alertmanager
   itself may be down, assume it did not fire and page the on-call chain
   directly through a channel that does not depend on the affected
   infrastructure (phone, SMS, a status-page tool hosted outside this
   cluster).
3. Post a holding statement on the status page (or equivalent customer
   communication channel) within 15 minutes of declaration, even if the
   root cause is unknown: "We are investigating a service disruption."

## Triage order

1. **Confirm scope.** Is this one region/AZ or the whole deployment? Is it
   the app tier, the database, or the underlying cluster/cloud provider?
2. **Check the cloud provider's own status page first** if using a managed
   Kubernetes/database service -- a provider-side outage has a different
   response (wait + communicate) than an application-side one (act).
3. **If the control plane is reachable but nodes are not:** check for a
   cluster-autoscaler or node-pool exhaustion event before assuming total
   loss.
4. **If the database is unreachable:** do not attempt an unplanned failover
   or restore without confirming via the provider's own status/health
   tooling first -- see [disaster-recovery.md](disaster-recovery.md) for the
   backup/restore procedure and its current RPO/RTO evidence.

## Recovery

1. Once the underlying infrastructure (cluster/network/database
   connectivity) is confirmed restored, redeploy the application tier from
   the last known-good image tag (`deploy/k8s/base/kustomization.yaml`'s
   pinned image tag) rather than assuming in-place pods will self-heal.
2. Run migrations (`pnpm db:migrate`) only if the incident involved a
   database restore -- do not re-run migrations against a database that
   never lost state, since some migrations are not idempotent by design.
3. Verify with the same health checks used in
   [GO-LIVE-RUNBOOK.md](GO-LIVE-RUNBOOK.md) before declaring recovery:
   `GET /api/v1/health/live`, `GET /api/v1/health/ready`, and one real
   end-to-end command (e.g. a read-only list endpoint) per tenant-critical
   domain (payroll, hr-core, time-attendance).
4. Only after health checks pass, update the status page to "resolved" and
   downgrade the incident severity.

## Post-incident

1. Capture a timeline: detection time, declaration time, first customer
   communication time, root cause identified time, recovery time.
2. If the observability stack was part of the outage (couldn't see
   dashboards), that is itself a finding to fix -- observability should not
   share a single point of failure with the service it monitors, and if it
   currently does, that architecture gap should be tracked as its own
   remediation item, not re-discovered in the next outage.
3. If Alertmanager did not page anyone (untested paging path, see
   [GO-LIVE-RUNBOOK.md](GO-LIVE-RUNBOOK.md) item on Alertmanager wiring),
   that is a blocking finding for the next go-live gate review, not a
   footnote.

## Known gaps (as of this runbook's authoring)

- No multi-region or multi-cluster failover exists today -- recovery from a
  full regional outage means waiting for the region to recover, not failing
  over to a standby. If business requirements demand a lower RTO than
  "wait for the primary region," that is a structural infrastructure
  decision, not something this runbook can route around.
- This runbook has not yet been exercised as a drill (a "game day"). Treat
  the procedure above as the best current documented plan, not a
  proven-by-rehearsal one, until a drill is run and this section is updated
  with the result.
