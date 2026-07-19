# Production Readiness Re-Score — 2026-07-19

Re-score of the 2026-06-28 baseline (`docs/PRODUCTION-READINESS-RESCORE-2026-06-28.md`, verdict **READY, 82/100**, gated only on an operator go-live checklist) after a 99-PR merge sprint. Method matches both prior audits in this lineage: 8 parallel specialist agents auditing `origin/main` read-only, with every critical/high finding independently re-verified by a separate, adversarial, evidence-only agent instructed to *refute* rather than confirm. See `docs/GAP-ANALYSIS-2026-07-19.md` for the full finding-by-finding detail this score is based on.

**Bottom line up front: this re-score is a regression, not a continuation.** The sprint added real breadth and fixed real bugs, but it also reintroduced the exact tenant-isolation bug class it had just fixed elsewhere, and shipped several headline features that are structurally unreachable via any API route despite passing CI. Score moves from **82 → 69 / 100**, and the verdict moves from READY back to **NOT READY**.

---

## 1. What changed since 2026-06-28 (by theme)

| Theme | What landed | Net effect on this re-score |
|---|---|---|
| Business-logic build-out | I-9/E-Verify domain, offer-compensation engine, recruiting EEO/fairness engine, DEI pay-equity engine, HR-AI governance bias scoring, employee-relations disciplinary escalation, global-hr international assignments, benefits/compensation lifecycle handlers | Real breadth added, but 3 of these headline builds (I-9/E-Verify, works-council resolution, HR-AI kill switch) turned out to be non-functional or unreachable on close inspection — see §3 |
| Security fixes | E-Verify duplicate-submission guards, PII encryption key fail-open fixed in both a migration and the shared `aes-gcm.ts` helper, tenant-scoping added to global-hr/i9-everify/reporting via `findByIdForTenant`, ZodValidationPipe wired into benefits/compensation/organization/recruiting/position-control | Genuinely fixed a real, disclosed IDOR class in the domains it touched — but the same fix was never extended to recruiting, which is now the largest confirmed hole in this re-score |
| Systemic CI fixes | Command-bus policy-matrix gaps closed, a stale `stepWriteOutbox` test fixed post-pipeline-decomposition, `migration-verification` job's missing `NODE_ENV` fixed, `FieldPrivacyStep`'s over-broad `/payroll/i` regex fixed | All confirmed still holding on current `main`; no regression found |
| This audit's own finding | `kafka-integration-test` CI job carries a self-disclosed "GitHub Actions billing-locked, static-review-only, not an actual run" comment dated 2026-07-12, still present and unresolved | Introduces a documented, scoped caveat on how much weight to put on "CI-green" for that one job |

---

## 2. Re-scored scorecard (same 16 categories, 0–5, weighted /100, same weights as prior two audits)

| # | Category | 06-28 | 07-19 | Weight | Wtd | Basis for change |
|---|---|---|---|---|---|---|
| 1 | Product completeness / business logic | 4 | **3** | 8 | 4.8 | Broader surface, but 3 headline features (I-9/E-Verify, works-council, country-rule-set lifecycle) are unreachable/no-op; "0 stubs" no longer holds — these are worse than stubs because they're *hidden* |
| 2 | Critical user journeys | 4 | **3** | 8 | 4.8 | Hire→onboard journey is not actually complete: offer-to-hire saga isn't idempotent (duplicate records on redelivery) and post-hire I-9 compliance is unreachable |
| 3 | UX / usability | 5 | 4 | 5 | 4.0 | Not directly re-audited; downgraded one point because several "done" native-UI actions (works-council resolution, rule-set activation) have no backend route to call |
| 4 | Accessibility / i18n | 4 | 4 | 4 | 3.2 | Not re-audited this round — no new evidence either way |
| 5 | Architecture / integration | 5 | **4** | 7 | 5.6 | Saga idempotency gap (H-2) and a Kafka consumer that swallows handler errors without rethrow (undermining redelivery-based recovery) are real architectural findings |
| 6 | Data governance / classification | 5 | **4** | 5 | 4.0 | DEI k-anonymity suppression bypass (H-5) — a real data-governance defect in a newly-built, compliance-relevant domain |
| 7 | Data integrity (PK/FK/migration) | 3 | 3 | 6 | 3.6 | Unchanged — DATA-3 not improved (flat, not worse); 2 new tables shipped without FKs, consistent with already-tracked debt |
| 8 | Security — authN / authZ | 4 | **3** | 7 | 4.2 | Multiple new confirmed gaps in domains built this session: actor-ID spoofing (H-7), several controllers missing ZodValidationPipe (downgraded to medium individually but numerous) |
| 9 | Tenant isolation (defense-in-depth) | 4 | **2** | 8 | 3.2 | Largest single regression: recruiting domain (this session's most PII/EEO-sensitive build) has a full, confirmed cross-tenant IDOR across 5 repositories; 2 more repos confirmed in dei-analytics/compliance; RLS still not enabled as a backstop |
| 10 | Secrets / dependency hygiene | 5 | 5 | 6 | 6.0 | Unchanged — all 3 boot guards (RLS/secrets/Kafka) still verified present and correctly wired; zod v3/v4 split found but doesn't affect CVE posture |
| 11 | Testing (unit/integration/e2e) | 4 | **3** | 8 | 4.8 | No skipped tests (good), but a spec was found mocking directly around a real bug (fiscal-year scoping) rather than exercising it, and the CI billing-lock disclosure adds a documented doubt about live-run coverage on at least one job |
| 12 | Performance / load | 3 | 3 | 6 | 3.6 | Not re-audited this round |
| 13 | CI/CD | 4 | 4 | 5 | 4.0 | `NODE_ENV` consistency holds; new `load-smoke` NODE_ENV inconsistency and the billing-lock disclosure are noted but don't net move the score |
| 14 | Observability | 4 | 4 | 5 | 4.0 | Not re-audited this round |
| 15 | Backup / restore / DR | 4 | 4 | 7 | 5.6 | Not re-audited this round; `GO-LIVE-RUNBOOK.md`'s PITR section was actively maintained (edited 2026-07-19), consistent with no regression |
| 16 | Deployment / rollback / scaling | 4 | 4 | 5 | 4.0 | Not re-audited this round |
| | **TOTAL** | **82.2** | | **100** | **69.4** | |

**Weighted readiness: ~69 / 100** (down from 82).

---

## 3. Why this is a regression and not just "more work to do"

The 2026-06-28 score was earned by closing every open P0/P1 from the 2026-06-25 baseline and having each fix independently re-audited before counting it. This re-score found **6 new CONFIRMED CRITICAL findings and 7 new CONFIRMED HIGH findings** — every one surviving an adversarial verification pass with direct evidence re-derived from `origin/main`, not taken on the specialist's word. Per the same "no Ready with any open P0" rule the 2026-06-25 and 2026-06-28 audits both applied, this re-score cannot be READY:

- **C-1/C-2** — cross-tenant IDOR + EEO-data cross-tenant persistence in recruiting (the exact bug class fixed elsewhere this same session)
- **C-3** — I-9/E-Verify, the session's own headline compliance feature, has no HTTP surface at all
- **C-4** — works-council consultations permanently deadlock worker termination once created, no recovery path
- **C-5** — Policy Center's high-risk confirmation gate fails open on any transient error
- **C-6** — the AI-governance kill switch does not actually stop anything

These are not edge-case findings requiring unusual conditions — C-1/C-2/C-3/C-4 are reachable via the product's normal, documented API surface by an ordinary authenticated user.

## 4. Verdict — **NOT READY**

The system regressed from a verified 82/100 READY state to 69/100 with 6 open P0-class findings. This is not a criticism of the individual PRs, most of which were reviewed, tested, and CI-green in isolation — it's a property of merging ~99 PRs in rapid succession without a dedicated cross-cutting security/completeness pass at the end, the same failure mode that caused the tenant-isolation gap the session *did* catch and fix in global-hr to not get generalized to the other domains built in parallel.

**What's still solid** (verified this round, not just carried forward):
- ✅ No hardcoded secrets, no security-relevant TODOs, no skipped tests anywhere in either app.
- ✅ All 3 operator go-live boot guards (RLS, secrets/`NODE_ENV`, `KAFKA_BROKERS`) still present and correctly wired.
- ✅ The systemic CI fixes from earlier this session (policy-matrix, `stepWriteOutbox`, migration `NODE_ENV`, `FieldPrivacyStep` regex) all confirmed still holding, no regression.
- ✅ The ZodValidationPipe wiring landed this session (benefits/compensation/organization/recruiting/position-control) has no schema/DTO mismatches across ~250 sampled call sites.

**What must happen before this can be READY again:**
1. Fix C-1 through C-6 (see `docs/GAP-ANALYSIS-2026-07-19.md` §6 for recommended order — C-1/C-2 and C-3/C-4/H-1 are both mechanical applications of patterns already proven elsewhere in this same codebase, not new design work).
2. Independently re-verify each fix (evidence-only, no self-approval) before counting it, per this lineage's established method.
3. Re-run this same 8-specialist sweep against the post-fix `main` before declaring READY again — given that a full sweep just found this much, a narrower "did we fix exactly these N things" check is not sufficient assurance on its own.
4. Resolve the operator-facing open item from this audit: confirm whether GitHub Actions billing-lock (self-disclosed in `kafka-integration-test`'s own comment) is still in effect, and if so, what portion of "CI-green" claims since 2026-07-12 it actually covers.

## 5. Unchanged from 2026-06-28 — still gating go-live once C-1–C-6 are closed

1. **Enable RLS**: `DB_RLS_ENABLED=true`, non-superuser DB role, `SYSTEM_DATABASE_URL` set. Boot guard still refuses to start otherwise (verified).
2. **Secrets / env**: `NODE_ENV=production`, strong `JWT_SECRET`/`SYSTEM_API_KEY`/`INTEGRATION_API_KEY`, explicit non-wildcard `CORS_ORIGINS`, real `KAFKA_BROKERS`. Boot fails fast otherwise (verified).
3. **PITR**: enable managed Postgres PITR per `docs/postgres-pitr.md`.

## 6. Remaining non-blocking backlog (P2/P3, carried + new)

- DATA-3: thin FK coverage, still ~flat since 2026-06-28; 2 new tables reproduced the gap (`docs/GAP-ANALYSIS-2026-07-19.md` §4).
- Auth surface (`auth.controller.ts`) and Policy Center/access-governance controllers lack `ZodValidationPipe` — inconsistent with the pattern used in 56 other files; no proven exploit found, but worth closing for defense-in-depth and consistency.
- `GO-LIVE-RUNBOOK.md`'s "5 real CI jobs" line and status-date banner are stale — a one-line doc fix.
- zod major version is split across the monorepo (`hr-auditor-agent` on v4, everything else on v3) — surface to whoever makes the deferred Dependabot #177/#178 decision.
- `load-smoke` CI job's `NODE_ENV=development` inconsistency with its sibling DB-touching jobs.
