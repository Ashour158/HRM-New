# HRM-New — End-to-End Service Audit

**Date:** 2026-06-20
**Scope:** 34 backend domains (apps/hr-api) + platform/cross-cutting layer + web (apps/hr-web) + shared packages.
**Method:** 6 parallel auditor agents, each domain scored 1–10 across 12 dimensions with file-level evidence. No files modified during audit.

---

## Overall verdict: ~7.0 / 10 — production-grade core, stubbed outer ring

The hard architecture is genuinely built (CQRS command bus, transactional outbox/inbox, multi-tenant ALS, RBAC/SSO/MFA, FSM aggregates, 69 migrations, bilingual API-wired React UI, CI/k8s). The gaps are concentrated and bounded: a security/data-protection ring on the most sensitive domains, a near-universal exports gap, near-zero service-layer observability, thin tests, and a handful of functional stubs.

---

## Scorecard (12-dimension average per domain)

| Cluster | Domain | Avg | Headline |
|---|---|---|---|
| Time & Pay | **payroll** | 8.0 | Best domain. Progressive tax, net-pay protection, SEPA/NACHA/CBE files. No PDF payslip. |
| Time & Pay | time-attendance | 7.9 | Rich calc engine. OT is daily threshold only — no FLSA weekly/tiered. |
| Platform | platform spine | 7.5 | Real outbox/inbox/command bus/scheduler. Production-grade. |
| Core | hr-core | 7.9 | GDPR erase, field-level ABAC, CSV. Strongest core domain. |
| Governance | policy-center | 8.0 | Maker-checker, GL/payroll sim, audit ledger. Best governance domain. |
| Governance | access-governance | 7.8 | SoD, access-review fulfillment, hash-only creds. |
| Workforce | workforce-management | 7.5 | 6 aggregates/FSMs, full admin UI. No roster export. |
| Talent | skills-talent | 7.4 | Tidiest wiring. No analytics/export. |
| Talent | recruiting | 7.3 | SoD on offers, event-sourced. Near-zero tests. |
| Workforce | hr-service-delivery | 7.3 | Admin + ESS wired. No SLA breach scheduler. |
| Time & Pay | benefits | 7.3 | Life-event enrollment, carrier recon. No EDI 834, deduction bridge unclear. |
| Time & Pay | absence-leave | 7.3 | Carryover/close FSM. No tenure-tiered accrual / auto-accrual job. |
| Workforce | contingent-workforce | 7.2 | SOW/rate-card/misclassification. Unpaginated, no export. |
| Core | organization | 7.1 | 1789-line org tree UI. No export, 1 test. |
| Time & Pay | compensation | 7.1 | HIGH_SENSITIVITY bands. No compa-ratio/pay-equity analytics. |
| Talent | onboarding | 6.8 | Role gates, probation. Event publisher no-op, no DocuSign/IAM callbacks. |
| Talent | performance | 6.8 | Largest domain (131 files). Zero logging. Client-side CSV only. |
| Talent | learning | 6.8 | Full FSM. SCORM/xAPI validate/parse are no-ops. |
| Core | hcm-setup | 6.8 | Clean config singleton. Best explicit authz. |
| Core | global-hr | 6.7 | Rich compliance domain — **but controller has NO AuthGuard**. |
| Governance | compliance | 6.8 | Legal-hold, statutory FSM. `/summary` hardcodes empty arrays. |
| Governance | union-labor | 6.5 | Grievance FSM. No retention/PII rules, 4 mocked tests. |
| Time & Pay | scheduler | 6.2 | Job dispatcher (not shift scheduling). No UI, no arbitrary cron. |
| Governance | hr-ai-governance | 6.1 | FSM + kill-switch. findById/findByStatus NOT tenant-scoped, no role guard. |
| Workforce | dei-analytics | 5.3 | k-anonymity present but **metrics not computed**; **no RBAC** on protected-class/pay data. |
| Workforce | engagement | 5.2 | Backend solid; **web mostly missing**; `analyze()` is a stub. |
| Workforce | wellbeing-eap | 5.0 | **No auth guards on health data; "encrypted" notes stored plaintext.** |
| Governance | country-policy | 4.1 | **Validation/simulation hardcoded `success=true`**; policy engine never called; dead saga. |
| Platform | integrations | 3.0 | **7/8 adapters mock; trigger endpoint unauthenticated.** |

Cluster averages: Core 7.1 · Talent 7.0 · Time&Pay 7.3 · Governance 6.3 · Workforce 6.2 · Platform 7.5 (core) / 3.0 (integrations).

---

## P0 — Security & data-protection defects (fix before any production exposure)

> **Remediation status (2026-06-20):** Items 1–6 below are **DONE** (guards + RBAC scopes added; special-category fields encrypted at rest via PII field encryption; data-loss column added; hr-ai-governance tenant-scoped; integrations trigger guarded; `SUPRESSED` typo fixed). All changes typecheck/lint clean with passing specs. **Item 7 (Postgres RLS) remains open.** dei-analytics k-anonymity now covers all 4 aggregates (extracted to a shared `applyKAnonymitySuppression` helper, unit-tested).

1. **wellbeing-eap** — controller has no `@UseGuards`; SPECIAL_CATEGORY health notes annotated "encrypted at rest" but `toRow()` writes plaintext. GDPR special-category liability.
2. **employee-relations** — plaintext SPECIAL_CATEGORY medical data falsely commented as encrypted; no RBAC on disciplinary draft/approve/execute; data-loss bug (`toAggregate` hardcodes `description:''`, `severity:'LOW'`).
3. **global-hr.controller** — no `@UseGuards(AuthGuard)`; 28 compliance endpoints (work-auth, intl assignments, works-council) unauthenticated.
4. **dei-analytics** — no domain RBAC on protected-class + pay-gap data; `DEI_ANALYTICS_READ/WRITE` exist only in test mock; suppression typo `'SUPRESSED'` and applied to 1 of 4 aggregates.
5. **integrations.controller** — unauthenticated `POST /:adapter/trigger`.
6. **hr-ai-governance** — `findById`/`findByStatus` not tenant-scoped (cross-tenant read); no role guard.
7. **No Postgres RLS** — tenant isolation is app-layer only; any raw query or plugin bypass leaks cross-tenant.

## P1 — Functional stubs (advertised features that don't work)

> **Remediation status (2026-06-20):** **DONE** — country-policy validation/simulation (real engine #27), workflow guard-library (12 guards), 3 policy engines (field-access/employment-eligibility/payroll-validation), learning SCORM/xAPI validation, engagement `analyze()` (with k-anonymity + `results` column), compliance `/summary` aggregation. All typecheck/lint/tested, app boots. **STILL OPEN:** integration adapters (7/8 mock — need real external connectors/credentials); no-op event publishers (may be intentional/outbox-driven — needs investigation); engagement frontend UI (backend now real).

8. **country-policy** — validate/simulate handlers return hardcoded pass; `@hcm/policy-engines` never invoked; event→saga path dead; `setTimeout` scheduling lost on restart.
9. **integrations** — 7/8 adapters return mock data; orchestrator declares retry/DLQ but never executes.
10. **workflow guard-library** — 12/16 guards (SoD, legal-hold, break-glass, field-access) are `return {passed:true}` no-ops.
11. **hr-policy-engines** — eligibility / field-access / payroll-validation engines stubbed.
12. **learning** — SCORM/xAPI content validate/parse handlers are no-ops.
13. **engagement** — surveys/recognition/pulse have no real UI (fall back to generic workbench); `analyze()` computes nothing.
14. **compliance** — `/compliance/summary` hardcodes `acknowledgements:[]`, `statutoryReports:[]`.
15. **Event publishers** no-op shims in onboarding/learning/skills-talent block cross-domain notifications/provisioning/signing callbacks.

## P2 — Systemic readiness gaps (cross-cutting)

16. **Outputs/exports** — weakest dimension system-wide. Governance cluster 2–3, workforce 1–3. No regulator-ready CSV/PDF of audit trails, certifications, SoD violations, statutory/DEI reports, rosters. Need a shared export job + lineage layer (async, streaming/row caps, "who exported what" audit).
17. **Observability** — service layer has effectively zero structured logging/metrics/tracing across every domain (esp. payroll/time — financially material). OTel off by default; in-memory metrics lost per pod.
18. **PDF outputs missing everywhere** — payslips, timesheets, total-comp statements are HTML/CSV only.
19. **Test coverage** — mostly mocked controller specs; aggregates/handlers/FSM/repos largely untested. Recruiting worst (1 metadata test).
20. **Notification delivery** — in-app only; no email/SMS/push; `delivery_status` column dead.
21. **Report-schedule executor** — schedules persist, nothing runs them.
22. **Calc gaps** — time-attendance OT lacks FLSA weekly-40/tiered 1.5×–2×; compensation lacks compa-ratio/range-penetration/pay-equity; absence lacks tenure-tiered + auto accrual.
23. **position-control** — complete backend, zero admin UI.

---

## Implementation plan

### Phase 0 — Security lockdown (1–2 weeks, do first)
- Add `@UseGuards(AuthGuard)` + permission decorators to wellbeing-eap, global-hr, dei-analytics, integrations controllers.
- Tenant-scope hr-ai-governance `findById`/`findByStatus`.
- Implement real field encryption (envelope/KMS) for wellbeing-eap + employee-relations special-category fields; fix the false "encrypted" comments.
- Fix employee-relations `toAggregate` data-loss (persist real description/severity).
- Fix dei-analytics suppression typo + apply k-anonymity to all 4 aggregates.
- Add a route-level RBAC convention (`@Roles`/permission decorators) repo-wide; audit every controller for guard presence (CI lint rule).

### Phase 1 — De-stub advertised features (2–4 weeks)
- country-policy: wire `@hcm/policy-engines`; implement real validate/simulate; replace `setTimeout` with the platform scheduler; connect saga.
- Implement the 3 hr-policy-engines + the 12 no-op workflow guards.
- Replace 7 mock integration adapters with real connectors (payroll/IAM/benefits/LMS/DWH); execute retry/DLQ.
- learning: real SCORM/xAPI parsing/validation.
- engagement: build surveys/recognition/pulse UIs + real `analyze()` scoring.
- compliance `/summary`: real aggregation.
- Replace no-op event publishers with outbox-backed publishing (onboarding/learning/skills-talent).

### Phase 2 — Outputs, exports & delivery (2–3 weeks)
- Shared async export service: job persistence + file storage + streaming/row caps + lineage/audit, formats CSV/XLSX/PDF.
- PDF rendering for payslips, timesheets, total-comp statements, governance/DEI/statutory reports.
- Real notification channels (email/SMS/push) + activate `delivery_status`.
- Report-schedule executor on platform scheduler.

### Phase 3 — Correctness & readiness hardening (2–4 weeks)
- FLSA weekly/tiered overtime + meal/break premiums (time-attendance).
- compa-ratio/range-penetration/pay-equity analytics (compensation); tenure-tiered + auto-accrual (absence).
- benefits→payroll deduction bridge + EDI 834.
- position-control admin UI; scheduler operator UI + arbitrary cron + missed-run backfill; SLA-breach scheduler (hr-service-delivery).
- Postgres RLS for defense-in-depth multi-tenancy.

### Phase 4 — Observability & test depth (continuous)
- Structured logging + metrics + tracing in service layer (start with payroll/time/governance); enable OTel; durable metrics store.
- Unit tests for aggregates/handlers/FSM/repos; real-DB integration tests for outbox/concurrent consumers; raise floor from ~3–5 to ≥7.
