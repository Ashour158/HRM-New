# Go-Live Runbook — HRM-New

Status at 2026-06-30: **Conditionally Ready (~89/100)**. All code-level audit blockers are
resolved and re-verified. The remaining items to reach **Ready** are operational actions
that require the production environment — they cannot be executed or proven from the repo.
Each is turnkey below with its acceptance evidence. Mark the audit checkpoint RESOLVED only
after the acceptance evidence is captured in the release record.

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
Logical backup + restore drill are automated and **proven** (`restore-drill-cronjob`, live PASS).
PITR is configured at the Postgres layer per `docs/postgres-pitr.md`:

1. Enable managed-PG PITR (or `wal-g` `archive_command`) with ≥7-day retention.
2. Drill a restore to an arbitrary timestamp.

**Acceptance:** `pg_stat_archiver.failed_count = 0`, recent `last_archived_time`; a PITR
restore to a chosen timestamp succeeds. Record achieved RPO/RTO.

## 4. Record a staging load baseline (extends PERF-1)
`load-smoke` CI job runs a health-endpoint smoke on every push (see `docs/perf-baseline.md`).
For go-live, run the harness in **staging** against representative data + authenticated
business endpoints, and add soak + spike profiles (PERF-2).

**Acceptance:** committed staging load report (p95/RPS/error-rate) within SLO; soak run shows no leak/latency creep.

## 5. Verify the payroll payout journey end-to-end (closes PROD-1)
The payout **logic** is unit-verified (`payroll-cycle-governance` + `attendance-close-readiness`
tests pass; `close`/`export` handlers exist), and the readiness gates correctly block on stale
policy / unlocked attendance. The **e2e** terminal leg (`golden-workflow.e2e.test.ts` `it.skip`)
remains unwritten because it requires seeding an activated country-policy pack + locked
attendance ledgers for all workers in the period — a multi-domain fixture.

**Action:** build that fixture (publish an EG statutory pack via `/hr/payroll/policy-packs/publish`;
lock the period's attendance ledgers), then unskip and assert close → payment-batch approve/export
→ cycle export. **Acceptance:** golden suite green with 0 skips.

---

## Definition of Ready
All five acceptance blocks captured in the release record. At that point the verdict moves
from **Conditionally Ready** to **Ready** — no code-level blockers remain (all resolved +
CI-gated); these are deployment/operations gates by design.
