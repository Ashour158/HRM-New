# Go-Live Runbook — HRM-New

Status at 2026-07-01: **Conditionally Ready**. All code-level audit blockers are resolved
and re-verified, including a second production-readiness audit pass on 2026-07-01 that
found and fixed: a CI secret-scan false positive that had left `main` red for 10+ days
(PR #56), two pre-existing test regressions that break had gone undetected behind that CI
break (also #56), a 15-repository jsonb-array serialization defect class (#58, same root
cause as PROD-2 below), a stale/inaccurate skip-reason comment on the payroll e2e (#57), a
dev-DB migration-ledger drift (reconciled directly), a latent SEC-1-class bug in
`OptionalAuthGuard` (#59), stale Kysely types for the payroll artifact tables (#60), missing
structured logging on the command bus and auth guard (#61), and an undersized/undocumented
DB connection-pool budget for production autoscale (this change). Branch protection on
`main` is now active, requiring the 5 real CI jobs to pass before merge — previously nothing
enforced this, and several PRs (including the payroll fixes below) had merged while CI was
red without anyone noticing.

The remaining items to reach **Ready** are operational actions that require the production
environment — they cannot be executed or proven from the repo. Each is turnkey below with
its acceptance evidence. Mark the audit checkpoint RESOLVED only after the acceptance
evidence is captured in the release record.

---

## 1. Activate RLS in production (closes SEC-2 cutover)
Code is shipped on (`DB_RLS_ENABLED=true` in configmap; DSNs point at `hcm_app`/`hcm_system`)
and **proven** by CI job `rls-enforcement-e2e`. Production cutover:

1. Provision the restricted roles once, as a superuser:
   `psql "$ADMIN_DATABASE_URL" -v app_password="'<strong-pw>'" -f infra/rls/provision-app-role.sql`
2. Put the real `hcm_app` / `hcm_system` credentials into the `hcm-platform-secrets`
   `DATABASE_URL` / `SYSTEM_DATABASE_URL`.
3. Deploy. The boot guard (`rls-runtime-check.ts`) refuses to start if RLS is on while
   connected as a superuser/BYPASSRLS role — so a misconfigured cutover fails fast, safe.

**Acceptance:** as `hcm_app` with the flag on, `SELECT` across tenants returns only the
caller's tenant rows; cross-tenant `INSERT` is rejected. (Mirrors the green `rls-enforcement-e2e` job.)

## 2. Wire Alertmanager receivers (closes SRE-1)
Routing is committed (`deploy/observability/alertmanager-config.yaml`); receivers read
secrets from files.

1. Provision `slack_webhook_url` and `pagerduty_routing_key` as mounted secrets.
2. Fire a synthetic critical alert (e.g. force `HcmOutboxPublishFailures` in staging).

**Acceptance:** on-call receives the page; capture the PagerDuty incident id + Slack message in the release record.

## 3. Enable WAL archiving / PITR (closes SRE-2, 15-min RPO)
Logical backup + restore drill logic is implemented and has been **proven manually**: the
standalone script (`scripts/backup/pg-restore-drill.mjs`, `pnpm db:restore-drill`), run by
hand against the live database on 2026-06-25 with an admin/superuser connection, restored
168 hr_* tables + 73 migrations → PASS (see `docs/disaster-recovery.md`).

The in-cluster automation of the same drill (`restore-drill-cronjob`, a weekly CronJob) is
newer and has **not yet had a successful live run**: as shipped, it authenticated as the
RLS-restricted `hcm_system` role, which lacked the `CREATEDB` privilege its own `CREATE
DATABASE`/`DROP DATABASE` steps need — a permission-denied bug that this repo's SQL grant
fix (`infra/rls/provision-app-role.sql`, `hcm_system` now has `CREATEDB`) resolves. That
fix unblocks the CronJob; it does not itself constitute a passing drill. Before crediting
this item's "logical backup + restore drill" half as proven for the in-cluster path, run
`hcm-db-restore-drill` for real (e.g. `kubectl create job --from=cronjob/hcm-db-restore-drill
hcm-db-restore-drill-manual-verify -n <namespace>`) and confirm it exits 0 with `RESTORE
DRILL PASS` in its logs.

PITR is configured at the Postgres layer per `docs/postgres-pitr.md`:

1. Enable managed-PG PITR (or `wal-g` `archive_command`) with ≥7-day retention.
2. Drill a restore to an arbitrary timestamp.

**Acceptance:** `pg_stat_archiver.failed_count = 0`, recent `last_archived_time`; a PITR
restore to a chosen timestamp succeeds; a live run of the in-cluster `hcm-db-restore-drill`
CronJob exits 0 with `RESTORE DRILL PASS` logged. Record achieved RPO/RTO.

## 4. Record a staging load baseline (extends PERF-1)
`load-smoke` CI job runs a health-endpoint smoke on every push (see `docs/perf-baseline.md`).
For go-live, run the harness in **staging** against representative data + authenticated
business endpoints, and add soak + spike profiles (PERF-2).

**Acceptance:** committed staging load report (p95/RPS/error-rate) within SLO; soak run shows no leak/latency creep.

## 5. Verify the payroll payout journey end-to-end (closes PROD-1)
The multi-domain fixture referenced by the previous version of this item was built
(`golden-workflow.e2e.test.ts`, PR #53) and, in building it, surfaced two real production
defects that are now fixed and re-verified: PROD-2 (the command bus's version-lock SELECT
errored on the payroll artifact tables and the error was misclassified/swallowed, silently
poisoning the transaction — PR #54) and a jsonb-array serialization bug (node-postgres
renders a JS array as an invalid Postgres array literal for jsonb columns — PR #55, and the
same defect class in 15 further repositories, PR #58). With those fixed, close-to-pay now
runs the full pipeline end-to-end with no transaction abort and no serialization error.

A third theory (PROD-3, connection-pool exhaustion) was investigated and did **not**
reproduce under measurement — see the corrected comment in `golden-workflow.e2e.test.ts`
for the full account; it was a stale/incorrect skip reason, not a real defect.

The e2e test (`it.skip`'d one case: "closes payroll, approves + exports the payment batch,
and exports the cycle") remains skipped for one reason only: the seeded worker fixture has
no compensation or tax-id data, so `ClosePayrollCycle`'s own readiness gate correctly
rejects it (`MISSING_PAYROLL_COMPENSATION` / `ZERO_OR_NEGATIVE_NET_PAY` /
`MISSING_TAX_IDENTIFIER`) before ever reaching payment-batch approval, export, or GL
posting — this is correct business behavior, not a code defect, but it means the
approve/export/GL-posting code paths still have zero positive end-to-end test evidence.

**Action:** extend the fixture to seed compensation + tax-id data for the test worker, then
unskip and assert close → payment-batch approve/export → GL posting → cycle export.
**Acceptance:** golden suite green with 0 skips.

## 6. Verify the production DB connection-pool budget before scaling (new, closes an audit P1)
Every `hcm-api` pod opens up to two Postgres pools once `SYSTEM_DATABASE_URL` is set (item 1
above) — the request pool (`DATABASE_URL`/`hcm_app`, sized by `DB_POOL_MAX`) and the
background-job pool (`SYSTEM_DATABASE_URL`/`hcm_system`, sized independently by
`DB_SYSTEM_POOL_MAX`). `deploy/k8s/base/configmap.yaml` now ships explicit, conservative
defaults (`DB_POOL_MAX=6`, `DB_SYSTEM_POOL_MAX=2`) sized against `hpa.yaml`'s
`maxReplicas: 10` for a worst-case budget of `10 × (6 + 2) = 80` connections, leaving
headroom under Postgres's own out-of-the-box `max_connections=100` — but no PgBouncer or
other connection pooler is deployed, and the repo doesn't commit to a specific managed-
Postgres instance size or its actual `max_connections`.

**Action:** before go-live, confirm the real `max_connections` on the provisioned production
Postgres instance and verify `maxReplicas × (DB_POOL_MAX + DB_SYSTEM_POOL_MAX)` plus
migration-job/admin headroom stays comfortably under it. If the instance is smaller than
this budget assumes, either lower `maxReplicas`, lower the pool sizes, or deploy a connection
pooler (PgBouncer) — this runbook doesn't prescribe which, since it depends on the actual
provisioned Postgres tier. **Acceptance:** the computed worst-case connection count is
recorded against the actual instance's `max_connections` in the release record, with margin.

---

## Definition of Ready
All six acceptance blocks captured in the release record. At that point the verdict moves
from **Conditionally Ready** to **Ready** — no code-level blockers remain (all resolved +
CI-gated, and CI is now genuinely enforced via branch protection); these are deployment/
operations gates by design.
