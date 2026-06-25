# Production-Readiness Audit — HRM-New

**Date:** 2026-06-25 · **Method:** 5 parallel specialist agents (security, SRE/DR, testing/perf, architecture/data, product/UX) + orchestrator synthesis. Evidence-based; dynamic checks run against live Postgres (5434) + Redis. No-evidence = 0; 4–5 require executed/operational evidence.
**State audited:** `main` after PRs #17–#24.

---

## 1. Service Inventory (service cards)

| Component | Type | Criticality | Deps | Data class | Deploy | Notes |
|---|---|---|---|---|---|---|
| **hr-api** | NestJS API (modular monolith, 41 domains, CQRS) | P0 | Postgres, Redis, Kafka/Redpanda | up to SPECIAL_CATEGORY | Docker + k8s (2 replicas) | global guards (Throttle/Auth/Roles/Permission); outbox/inbox |
| **hr-web** | React 18 + Vite SPA (EN/AR) | P0 | hr-api | — | Docker + nginx | 106+ pages; 11 native, 16 workbench-fallback |
| **hr-auditor-agent** | Aux agent app | P2 | — | — | Docker | not deeply audited |
| **Postgres** `hcm_platform` | DB, 33 schemas, **168 tables, 521 indexes, 73 migrations** | P0 | — | k8s/stateful | 166/168 tenant-scoped; RLS policies on 169 tables (staged) |
| **Redis** | cache + session + throttle store | P1 | — | — | k8s | RedisCacheService, auth-session, throttler |
| **Kafka/Redpanda** | event bus | P1 | — | — | k8s | **silent in-memory fallback if KAFKA_BROKERS unset** |
| **Outbox/Inbox** | transactional event spine | P0 | Postgres | — | in-process pollers | `FOR UPDATE SKIP LOCKED`, ≤5 attempts, DB dedup |
| **Scheduler / jobs** | retention, effective-dating, reminders | P1 | Postgres | — | in-process cron | now on system pool |
| **8 integration adapters** | payroll-export, tax-authority, benefits-carrier, iam-provisioning, lms, data-warehouse, vms, email | P1 | external | varies | — | **real HTTP transport, env-gated**; orchestrator retry/backoff real; **DLQ in-memory only** |
| **Exports** | XLSX (ExcelJS), PDF (pdf-lib), DOCX (docx), CSV | P1 | — | — | — | real multi-format |
| **CI/CD** | GitHub Actions (ci.yml, release.yml) | P0 | — | — | — | typecheck/lint/test/build/migrate/e2e/security/Docker |
| **Roles/tenants** | RBAC/ABAC/SoD; multi-tenant | P0 | — | — | — | RLS proven; app-layer plugin active |

**Critical journeys:** hire/onboard · attendance→leave→approve · run payroll · performance cycle · employee self-service · admin configuration.

---

## 2. Architecture & Data Flow

```
HTTP ─▶ Guards(Throttle→Auth→Roles→Permission) ─▶ Controller ─▶ CommandBus(@CommandHandler)
        │                                                          │
        │ TenantInterceptor → ALS tenant                           ▼
        │                              Aggregate mutation + Outbox.schedule  ── same txn ──▶ hr_platform.outbox_events
        ▼                                                                                         │
   StructuredLogger (correlationId/traceId via ALS)                                               ▼
                                                          Outbox poller (SKIP LOCKED, 5s) ─▶ EventBus
                                                                                    │ Kafka if KAFKA_BROKERS
                                                                                    │ else InMemory (silent)
                                                                                    ▼
                                                            topic ─▶ InboxConsumer ─▶ Dedup (DB exactly-once)
                                                                                    ▼
                                              handler / IntegrationOrchestrator ─▶ adapter.send ─▶ HTTP transport
                                                                 (retry+backoff, credential gate, in-mem DLQ)
```
Tenant isolation: **app-layer** `TenantFilterPlugin` (active) + **DB-layer** RLS `tenant_isolation` policy on 169 tables (built & proven as `hcm_app`, **not active in default config**). PII/special-category fields AES-256-GCM at rest.

---

## 3. Scorecard (16 categories, 0–5, weighted /100)

| # | Category | Score | Weight | Wtd | Evidence (executed) |
|---|---|---|---|---|---|
| 1 | Product completeness / business logic | 4 | 8 | 6.4 | 0 stubs across 41 domains; payroll/tax/KPI computed |
| 2 | Critical user journeys | 4 | 8 | 6.4 | golden e2e (hire→…→terminate) green on live DB |
| 3 | UX / usability | 3 | 5 | 3.0 | 11 native pages real; 16/27 modules workbench-fallback |
| 4 | Accessibility / i18n | 4 | 4 | 3.2 | i18n parity 4/4 executed; a11y tests pass (partial run) |
| 5 | Architecture / integration | 4 | 7 | 5.6 | real outbox/inbox/CQRS, real HTTP adapters |
| 6 | Data governance / classification | 5 | 5 | 5.0 | field-policy 5 levels, masking, step-up, retention job |
| 7 | Data integrity (PK/FK/migration) | 3 | 6 | 3.6 | 0 missing PK; **FK 71/168 thin**; 73 migrations applied |
| 8 | Security — authN / authZ | 3 | 7 | 4.2 | 4 global guards; auth tests 22/22; per-route not all dynamic |
| 9 | Tenant isolation (defense-in-depth) | 2 | 8 | 3.2 | RLS proven as hcm_app; **inert in shipped config** |
| 10 | Secrets / dependency hygiene | 2 | 6 | 2.4 | **2 high CVEs**; weak dev secrets, NODE_ENV=development |
| 11 | Testing (unit/integration/e2e) | 4 | 8 | 6.4 | real-DB e2e **32 passed/1 skipped**; typecheck 0; ~0 stubs |
| 12 | Performance / load | 0 | 6 | 0.0 | **no load/soak tooling anywhere** |
| 13 | CI/CD | 4 | 5 | 4.0 | real gates incl. Postgres e2e + dep audit |
| 14 | Observability | 3 | 5 | 3.0 | structured logs+correlation; **metrics in-memory**, OTel smart-default |
| 15 | Backup / restore / DR | 2 | 7 | 2.8 | dump→restore proven manually; **no automation, no drill** |
| 16 | Deployment / rollback / scaling | 3 | 5 | 3.0 | probes+limits good; **no HPA/PDB**; migration rollback footgun |
| | **TOTAL** | | **100** | **62.2** | |

**Weighted readiness: ~62 / 100.**

---

## 4. Blocker Report (hard blockers)

**P0 (must fix before any production):**
- **SEC-1 + SEC-2 — DB tenant isolation inert in shipped config.** `DB_RLS_ENABLED` unset and `DATABASE_URL` = superuser `hcm_admin` → RLS bypassed at runtime. (Mechanism proven correct as `hcm_app`; this is an activation/config gap, not a code gap.)
- **SRE-1 — no automated backup.** Manual `pg_dump` only; WAL archiving asserted but not configured → RPO 15m unmet.
- **SRE-2 — restore never drilled/automated.** Mechanism works (proven), but no executed/scheduled restore drill.

**P1 (block go-live):**
- **SEC-4** — 2 high CVEs (multer <2.2.0, hono DoS).
- **SEC-5** — weak dev secrets + `NODE_ENV=development` in shipped `.env`; harden the fail-on-demo-secret guard.
- **TEST-2** — zero load/soak/spike testing; no performance baseline.
- **UX-4** — 16/27 modules ship only the generic operations-workbench (no per-domain admin UI).
- **SRE-3** — app rollback does not revert migrations (documented footgun).
- **SRE-4** — RLS activation migration is staged (`infra/rls/`), not in the auto-run chain; live dev DB has it applied out-of-band (drift).

**Critical journeys:** all PASS (golden e2e green). **Migration rollback:** verified reversible (up→down→up roundtrip executed). **Restore:** mechanism verified, drill not.

Per the stated rule (no Ready with any P0/P1, unverified restore, etc.): **the system cannot be "Ready" today.**

---

## 5–6. Remediation Backlog + Implementation Plan

### P0
- **RLS activation** (SEC-1/2, SRE-4): move `infra/rls/enable-tenant-rls.js` → `infra/migrations/` (timestamped); set prod `DB_RLS_ENABLED=true`, `DATABASE_URL`→`hcm_app`, `SYSTEM_DATABASE_URL`→`hcm_system`; add a prod startup assertion that the runtime role is non-superuser when RLS on. *Acceptance:* boot as hcm_app; cross-tenant SELECT=0 & INSERT rejected through the app pool; CI tenant-isolation e2e runs with the flag on. *Rollback:* flag off + revert DATABASE_URL.
- **Automated backup + WAL archiving** (SRE-1): add a CronJob/`wal-g`/`pgbackrest` base-backup + WAL archive; artifact retention. *Acceptance:* nightly backup artifact present; WAL shipping verified.
- **Automated restore drill** (SRE-2): scheduled job restoring latest backup to a scratch DB + integrity check. *Acceptance:* drill job green with RTO/RPO recorded.

### P1
- Bump multer ≥2.2.0 + hono chain (SEC-4) → `pnpm audit --prod` 0 high.
- Real prod secrets + `NODE_ENV=production`; reject low-entropy/known-dev secrets in `app.config.ts` (SEC-5).
- Load/soak harness (k6/autocannon) against golden workflow + outbox drain; p95/RPS baseline + SLO thresholds in CI (TEST-2).
- Per-domain admin UIs for the 16 workbench modules, wired to existing domain APIs (UX-4) — incremental, highest-value first (recruiting, benefits, compensation).
- Document/operationalize migration-rollback policy; reconcile RLS migration drift (SRE-3/4).

### P2
- Persist integration DLQ to `hr_platform.integration_dead_letters` (ARCH-8); fail-fast on missing Kafka brokers in prod + bound dedup set (ARCH-4); add FKs for high-value parent-child links (DATA-3); durable metrics via Prometheus/`prom-client` (SRE-5); Alertmanager receivers/routing (SRE-6); HPA + PodDisruptionBudget (SRE-7); decompose remaining giant pages (UX-5); populate/verify audit-log writes (SEC-6); CORS prod-reject `*` (SEC-7); verify global ValidationPipe/DTO whitelisting (SEC-8); N+1 query-count assertions (TEST-3).

### P3
- Generate OpenAPI client types from the served spec (ARCH-9); fix flaky `notification-center.test.tsx` (TEST-1); replace hand-rolled metrics with `prom-client` (SRE-8).

**Process:** implement P0 then P1 as separate PRs; the **independent-verification agent re-audits** each (reproduce issue → rerun acceptance test → inspect telemetry → rescore). Implementer may not approve its own correction.

---

## 7. Evidence Index (selected, executed)
- RLS proof: `SET app.current_tenant` as hcm_app → cross-tenant SELECT=0; INSERT → `ERROR: new row violates row-level security policy`; policy on 169 tables.
- e2e: `pnpm build` + migrate + seed + `vitest run test/` on live PG → 32 passed/1 skipped (golden-workflow, tenant-isolation, outbox-drain).
- Backup: `pg_dump -Fc` (676K) → `pg_restore` into fresh DB → 73 migrations + 168 tables intact.
- Migration rollback: up→down(3)→up roundtrip clean on scratch DB.
- Deps: `pnpm audit --prod` → 2 high (multer, hono), 17 moderate.
- i18n: `vitest run src/i18n` → 4/4. typecheck: hr-api + hr-web exit 0. Stubs: 1 TODO across all src.
- Schema: 168 tables, 0 without PK, 166 tenant_id, 71 FK, 521 indexes.

---

## 8. Final Verdict

### **CONDITIONALLY READY** — strong, real foundation gated by a finite, well-understood blocker set.

**What's genuinely production-grade:** the backend is real (no stubs across 41 domains; computed payroll/tax/KPI; real persistence + events), the transactional outbox/inbox/CQRS spine and real HTTP integrations are solid, all core journeys pass real-DB e2e, data governance/field-classification is strong, CI is mature, and RLS tenant isolation is built and *proven* at the DB layer.

**Why not "Ready":** the shipped config doesn't activate DB-level RLS (P0 config), there is no automated backup or executed restore drill (P0 ops), 2 high CVEs and weak prod secrets (P1), zero load testing (P1), and 16/27 advertised modules lack native admin UI (P1 commercial).

**Recommendation:** **Limited production for the core HR / payroll / time / performance / self-service scope** once the P0 set (RLS activation, backup automation, restore drill) and the security P1s (CVEs, secrets) are closed and re-audited. Full-suite GA requires the per-domain module UIs and a load-tested performance baseline. Target: P0 + security P1 ≈ 1–2 focused weeks; full GA ≈ the remaining backlog.
</content>
