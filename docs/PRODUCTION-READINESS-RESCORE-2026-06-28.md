# Production Readiness Re-Score — 2026-06-28

Re-score of the 2026-06-25 baseline audit (`PRODUCTION-READINESS-AUDIT-2026-06-25.md`,
verdict **CONDITIONALLY READY, 62/100**) after the remediation program. Every landed fix
was **independently re-audited** (separate verifier agents, evidence-only, no self-approval)
before this re-score; see the reaudit findings summarized below.

## 1. What changed since the baseline (by PR)

| Area | Change | PRs |
|---|---|---|
| Dependency CVEs | full-tree `pnpm audit` **11 high + 2 crit → 0/0** (dev/test toolchain bumped; prod already clean) | #26, #35 |
| Tenant RLS | runtime fail-closed guard + fail-closed pool + migration in chain; reaudited | #27 |
| Backup / restore | automated backup + **restore drill executed live (PASS)** + cronjobs | #28 |
| Secrets | strong-secret enforcement in production (length/markers/entropy) | #29 |
| Load / perf | dependency-free load+SLO-gating harness (validated: real percentiles, fails on breach) | #30 |
| Integration DLQ | durable `integration_dead_letters` persistence + CI-gated e2e | #32, #40 |
| SRE infra | HPA + PodDisruptionBudget (selectors verified), Alertmanager routing, migration-rollback policy, PITR config | #33 |
| Event bus | **fail fast in prod** when `KAFKA_BROKERS` unset (was silent in-memory fallback) | #34 |
| CORS / Swagger | reject wildcard CORS in prod; gate OpenAPI docs out of prod | #36 |
| Recruiting UI | native `/admin/recruiting` wired to real APIs (endpoint-verified) | #37 |
| Module catalog | **all 27 commercial modules native-ui** (13 mislabeled flipped + benefits/engagement built); 0 workbench | #38, #41 |
| Offer contract | declare `applicationId` candidate linkage on CreateOffer DTO | #39 |
| Metrics | documented decision to keep correct hand-written Prometheus exposition over prom-client | #40 |

## 2. Re-scored scorecard (16 categories, 0–5, weighted /100)

| # | Category | Was | Now | Weight | Wtd | Basis for change |
|---|---|---|---|---|---|---|
| 1 | Product completeness / business logic | 4 | 4 | 8 | 6.4 | unchanged — already 0 stubs |
| 2 | Critical user journeys | 4 | 4 | 8 | 6.4 | golden e2e still green |
| 3 | UX / usability | 3 | **5** | 5 | 5.0 | **0 workbench-fallback; all 27 modules native**, recruiting bespoke |
| 4 | Accessibility / i18n | 4 | 4 | 4 | 3.2 | a11y coverage broadened + heading-order defect fixed; EN/AR parity |
| 5 | Architecture / integration | 4 | **5** | 7 | 7.0 | silent Kafka fallback removed; DLQ durable |
| 6 | Data governance / classification | 5 | 5 | 5 | 5.0 | unchanged |
| 7 | Data integrity (PK/FK/migration) | 3 | 3 | 6 | 3.6 | **unchanged — FK thinness (DATA-3) still open** |
| 8 | Security — authN / authZ | 3 | **4** | 7 | 5.6 | strong secrets, CORS prod-reject, Swagger gated |
| 9 | Tenant isolation (defense-in-depth) | 2 | **4** | 8 | 6.4 | RLS mechanism complete + runtime guard + reaudited; activation ops-gated |
| 10 | Secrets / dependency hygiene | 2 | **5** | 6 | 6.0 | **0 high/critical CVEs**, prod secret enforcement |
| 11 | Testing (unit/integration/e2e) | 4 | 4 | 8 | 6.4 | DLQ e2e now CI-gated; contract + a11y tests added |
| 12 | Performance / load | 0 | **3** | 6 | 3.6 | real load+SLO harness landed & validated (no CI baseline yet) |
| 13 | CI/CD | 4 | 4 | 5 | 4.0 | DLQ e2e added to DB-backed job |
| 14 | Observability | 3 | **4** | 5 | 4.0 | Alertmanager routing; metrics correctness documented |
| 15 | Backup / restore / DR | 2 | **4** | 7 | 5.6 | automated + **drilled live**; PITR documented (not yet enabled) |
| 16 | Deployment / rollback / scaling | 3 | **4** | 5 | 4.0 | HPA + PDB landed; migration-rollback policy |
| | **TOTAL** | | | **100** | **82.2** | |

**Weighted readiness: ~82 / 100** (up from 62).

## 3. Independent reaudit result
8 landed fixes were verified by separate agents on evidence only. **7/8 PASS (5/5)** on first
pass; the 8th (CVEs) was PARTIAL until #35 took the full tree to 0 high/0 critical — now PASS.
No fix was self-approved.

## 4. Verdict — **READY**, gated on a short operator go-live checklist

The baseline's hard blockers are cleared and independently verified:
- ✅ No open **P0**; the **P1** set (secrets, load tooling) is closed.
- ✅ No failed critical journey (golden e2e green on live DB).
- ✅ Tenant isolation **verified** (app-layer active; DB-layer RLS proven + fail-closed pool +
  boot guard that refuses to start mis-scoped).
- ✅ Restore **drilled live** (169 tables / 74 migrations, PASS).
- ✅ Rollback path defined (expand/contract forward-only policy; app rollback proven safe).

The platform now **enforces** its own go-live preconditions at boot, so these are operator
deployment steps, not code gaps:
1. **Enable RLS**: set `DB_RLS_ENABLED=true`, point `DATABASE_URL` at a restricted (non-superuser)
   role, set `SYSTEM_DATABASE_URL`. The boot guard refuses to start if RLS is on while connected
   as a superuser/BYPASSRLS role.
2. **Secrets / env**: `NODE_ENV=production`, strong `JWT_SECRET`/`SYSTEM_API_KEY`/`INTEGRATION_API_KEY`,
   explicit non-wildcard `CORS_ORIGINS`, real `KAFKA_BROKERS`. Boot fails fast otherwise.
3. **PITR**: enable managed Postgres PITR (or wal-g) per `docs/postgres-pitr.md` to meet the 15-min RPO.

## 5. Remaining non-blocking backlog (P2/P3)
- DATA-3: thin FK coverage (71/168) — integrity hardening.
- Performance: record an app-under-load SLO baseline in CI/staging using the landed harness.
- HPA requires `metrics-server` verified in the target cluster; drill a live PITR restore.
- Per-route authZ: confirm all sensitive routes carry dynamic permission requirements.

**Bottom line:** code and infrastructure are **production-ready (82/100)**; go-live is gated only
on the operator checklist in §4, which the application now enforces rather than assumes.
