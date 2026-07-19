# Gap Analysis — HRM-New

**Date:** 2026-07-19 · **State audited:** `origin/main` @ `3959887` (post-99-PR merge sweep) · **Method:** 8 parallel specialist agents (read-only, evidence-based against `git show`/`git grep` on `origin/main`) + independent adversarial verification of every critical/high finding (separate verifier agents instructed to *refute*, not confirm; evidence-only). 30 agents, 796 tool calls, ~2.5M tokens.

This is a fresh audit, not a continuation of the 2026-06-28 re-score's remediation tracking. It specifically hunted for what changed — for better or worse — across the 99 PRs merged into `main` since then, on the explicit premise that "merged and CI-green" does not imply "correct."

---

## 1. Headline

The 99-PR sprint added substantial breadth (I-9/E-Verify, offer-compensation, recruiting EEO/fairness, DEI pay-equity, HR-AI governance, employee-relations escalation, global-hr international assignments) and fixed real, serious bugs (E-Verify duplicate submission, PII key fail-open, several tenant-isolation gaps, benefits/recruiting idempotency). But the same sprint **reintroduced the exact bug class it had just spent effort fixing** in at least one major domain (recruiting), and shipped several features that are **structurally unreachable** despite being "done" per the merge log — their command handlers exist, are unit-tested, and are wired into the DI container, but no controller route or saga ever dispatches them.

Two findings were independently discovered by *two separate specialist agents working from different angles* (security review vs. business-logic review), which is a strong corroboration signal:
- The recruiting-domain cross-tenant IDOR
- The I-9/E-Verify domain's missing controller

**6 findings are CONFIRMED CRITICAL. 7 are CONFIRMED HIGH (H-1 through H-7)** — every one of these 13 survived a dedicated adversarial verification pass by an agent whose explicit job was to refute it using only direct evidence re-derived from `origin/main`, not to rubber-stamp the specialist's claim. Where verification *downgraded* a finding's severity, the corrected severity is what's listed.

**One additional finding, H-8, is listed separately below** because its evidence level differs from H-1–H-7: it was not independently re-checked by a dedicated verifier agent. It surfaced as a byproduct of a *different* verifier refuting a broader, related claim — that verifier re-derived H-8's specific evidence (file content, missing `BaseRepository` inheritance) directly from `origin/main` while doing so, so it is not merely the original specialist's unverified assertion, but it has not gone through the same dedicated refute-first pass as H-1–H-7. Treat it as real and evidence-backed, with a slightly lower confidence bar than the other 12 confirmed findings.

The broader claim H-8 was narrowed from — a cross-tenant IDOR spanning 5 domains — was **refuted** for its primary anchor (`wellbeing-eap`'s `MentalHealthCaseRepository`, which does correctly extend `BaseRepository` and is tenant-scoped). H-8 is what remained true after that refutation.

---

## 2. Critical (P0) — confirmed, must fix before production

### C-1. Recruiting domain: cross-tenant IDOR across 5 repositories (candidates, offers, requisitions, interviews, adverse-impact analyses)
**Files:** `apps/hr-api/src/domains/recruiting/repositories/{candidate,job-requisition,offer,interview-plan,requisition-adverse-impact-analysis}.repository.ts`

None of these five repositories extend the codebase's `BaseRepository<T>` (which enforces `tenant_id` filtering and throws if tenant context is missing). They're hand-rolled classes whose `findById`/`findByRequisition`/`findByCandidate`/`findByStatus` methods carry **no tenant predicate at all**. Reachable directly via `GET /hr/recruiting/{offers,candidates,requisitions}/:id` and 9 total controller call sites — an authenticated actor in Tenant A supplying a Tenant B UUID gets the full record back: candidate name/email/status, **candidate EEO self-identification data (race, gender identity, veteran/disability status)**, offer salary/currency/status, requisition adverse-impact analysis results.

This is the *identical* vulnerability class just fixed in global-hr (PR #182/#188) — `findById` used ahead of command dispatch with no `findByIdForTenant` counterpart — but recruiting, which added the most sensitive new PII this session, never received the equivalent hardening pass. RLS is not yet enabled, so there is no defense-in-depth backstop.

*Independently found and confirmed by two separate specialist agents.*

### C-2. `AnalyzeRequisitionAdverseImpact` command: no tenant/aggregate check at all — cross-tenant EEO data exfiltration + durable mislabeled persistence
**File:** `apps/hr-api/src/domains/recruiting/api/recruiting.controller.ts:695`

This endpoint builds its command with **no `aggregateId`**, so the command-bus's only tenant-filtering step (`AggregateLoadStep`) never runs. The handler takes the path-param `id` directly, reads another tenant's requisition/candidates/interviews/offers unscoped (per C-1), computes EEOC-protected-class funnel statistics, and **persists a new analysis stamped with the caller's own tenant ID**. An authenticated Tenant-A actor can both exfiltrate and durably mislabel Tenant B's hiring-funnel EEO data under their own tenant, with no compensating RBAC/ABAC check (the sibling GET endpoints for this same aggregate call a role-scope assertion; this POST endpoint does not).

### C-3. I-9/E-Verify domain has no REST controller — the entire compliance workflow is unreachable
**File:** `apps/hr-api/src/domains/i9-everify/` (no `api/*.controller.ts` exists — every other one of the 33 domains has one)

`CompleteI9CaseSection1`, `CompleteI9CaseSection2`, `RejectI9Case`, `SubmitEverifyCase`, `RecordEverifyResult`, `ContestEverifyTentativeNonconfirmation` are all registered command handlers with real logic, aggregates, FSMs, and unit tests — but **zero dispatch sites anywhere in production code**. Only `CreateI9Case` is ever invoked, automatically, by the recruiting offer-to-hire saga. Net effect: an I9Case is silently created on every hire, and then **nothing can ever be done with it** — no way for HR/compliance staff to complete Form I-9 Section 1/2, submit E-Verify, record a result, or contest a Tentative Nonconfirmation. This is a legally-mandated, deadline-driven federal employment-eligibility process, built out as this session's headline compliance feature, that is dead on arrival.

*Independently found and confirmed by two separate specialist agents.*

### C-4. WorksCouncilConsultation lifecycle is unreachable — permanently deadlocks worker termination and org restructuring
**File:** `apps/hr-api/src/domains/global-hr/api/global-hr.controller.ts:190`

Only `CreateWorksCouncilConsultation` has a route. `Initiate`/`StartProgress`/`Complete`/`BlockWorksCouncilAction` are registered handlers with no controller route and no saga dispatch. `WorksCouncilConsultation.create()` unconditionally sets status `REQUIRED`, and `isBlocking()` returns `true` for `REQUIRED | INITIATED | IN_PROGRESS`. `WorksCouncilConsultationGuard.assertNotBlocked()` — invoked unconditionally from `TerminateWorkerHandler` and `RestructureOrgUnitHandler` — throws whenever a blocking consultation exists. **Once any works-council consultation is ever created for a legal entity, no code path anywhere in the repo can move it out of the blocking state**, permanently barring termination and org restructuring for that entity with no in-product recovery path (only manual DB intervention).

### C-5. Policy Center's high-risk-apply confirmation gate fails open on any query error
**File:** `apps/hr-api/src/domains/policy-center/policy-center.repository.ts:611-629`, `policy-center.service.ts:1830`

The gate that's supposed to require explicit human confirmation before applying a high-risk policy revision (e.g. one touching open payroll cycles) is derived from 7 chained queries, **every one of which silently returns an empty result on any error** (schema drift, transient DB error, permission issue) — with a second identical fail-open layer wrapping the whole call. A single query failure reads as "nothing at risk," silently skips the confirmation requirement, and lets a high-risk revision apply unconfirmed — undetectably, since none of the 7 catch blocks log or alert.

### C-6. HR-AI governance kill switch has no enforcement effect — triggering it does not stop new model runs
**File:** `apps/hr-api/src/domains/hr-ai-governance/commands/{create,start}-hr-ai-model-run.handler.ts`

`CreateHrAiModelRunHandler`/`StartHrAiModelRunHandler` never load `HrAiUseCaseRepository` or `HrAiKillSwitchRepository` — they have no way to know whether a use case is suspended or its kill switch triggered. No command-bus pipeline step checks this either. `TriggerHrAiKillSwitchHandler` only flips its own aggregate's status and publishes an event that **nothing subscribes to**. The entire AI-governance safety-stop mechanism is audit-log-only: an admin can "trigger the kill switch" on a biased/misbehaving AI use case, and new model runs against it will still be created and started successfully.

---

## 3. High (P1) — confirmed, should block or immediately follow go-live

| # | Finding | File |
|---|---|---|
| H-1 | `CountryRuleSet`/`StatutoryLeaveType` lifecycle commands (`Activate`/`Supersede`/`Retire`/`Update`) have no routes — every one created via the API is permanently stuck in `DRAFT` and invisible to `ACTIVE`-only downstream queries | `global-hr.controller.ts:136` |
| H-2 | `OfferToHireSaga` is not idempotent against event redelivery — generates fresh random UUIDs/idempotency keys on every invocation with no per-`offerId` guard; a crash-and-restart or DLQ replay of `OfferAccepted` creates a **second** WorkerProfile + EmploymentRelationship + JobAssignment + OnboardingPlan for the same hire. Confirmed the command-bus idempotency step dedups solely on `idempotencyKey`, which is always random here — `aggregateId` plays no role. Contributing cause confirmed in `kafka-event-bus.ts`'s `eachMessage`: it wraps `handler.handle(event)` in try/catch and only logs on error without rethrowing, so KafkaJS still auto-commits the offset after a failed/partial handler run — meaning the realistic trigger for redelivery is a process crash between a partial saga run and the next commit checkpoint, not an ordinary handler exception (which would just be swallowed and silently drop the event instead) | `offer-to-hire.saga.ts:135`, `kafka-event-bus.ts` (`eachMessage`) |
| H-3 | Headcount-budget ceiling enforcement has no fiscal-year scoping — `sumApprovedPositionsByDepartment` sums *all-time* approved headcount against a *per-fiscal-year* budget ceiling, so once lifetime approvals exceed any later year's budget, all future approvals in that department are permanently blocked | `headcount-request.repository.ts:96` |
| H-4 | Country-policy impact simulation always reports **zero** impacted workers/payroll-runs/tax-assignments/leave-balances/benefits — the handler has no repository access to real tenant data and hardcodes all five entity-impact lists empty, while still reporting a real computed `impactLevel` (looks substantively computed, isn't) | `simulate-country-policy-pack-impact.handler.ts:58` |
| H-5 | DEI k-anonymity suppression blanks only the `headcount` field of a small cell but leaves the derived `meanHourlyGap` for that same cell fully exposed — defeats the stated purpose of the suppression for small-cohort pay-equity comparisons | `pay-gap-calculator.ts:127` |
| H-6 | Worker profile-section upsert (`hr-core`) accepts an unvalidated `Record<string, unknown>` merged directly into a PII aggregate for every data category except `CUSTOM` — including `BANKING`, `TAX`, `MEDICAL`, `COMPENSATION`. The proper Zod contract schema for this exists in `packages/hr-command-contracts` but is unused dead code | `hr-core.controller.ts:536` |
| H-7 | Approve/assign endpoints across employee-relations, workforce-management, and wellbeing-eap take a client-supplied actor ID (`approvedBy`/`reviewedBy`/`filledByWorkerId`) with **no cross-check against the authenticated actor** — lets any already-privileged caller forge the audit trail on disciplinary actions, legal reviews, and accommodation approvals by attributing them to an arbitrary UUID | `employee-relations.controller.ts:193` (+7 more sites) |
| H-8 | (Corrected/narrowed from a broader refuted claim) `PayGapReportRepository` (dei-analytics) and `LegalHoldRepository` (compliance) are standalone classes that do **not** extend `BaseRepository` and genuinely skip tenant scoping — surfaced while an adversarial verifier was refuting a wider 5-domain claim; this narrower version held up. Not independently re-verified by a dedicated pass, but backed by direct evidence | `pay-gap-report.repository.ts`, `legal-hold.repository.ts` |

---

## 4. Medium (P2) — real, worth fixing, not go-live blockers

- **Auth surface has zero request-body validation** (`auth.controller.ts`: login, refresh, invite, password-reset, MFA, SSO config, SAML ACS) — verification traced downstream sinks and found no proven bypass/injection, just unhandled-type 500s on malformed pre-auth input. Still the most-exposed surface in the app and inconsistent with the ZodValidationPipe convention used elsewhere.
- **Access-governance controller** (RBAC/ABAC/service-account admin) has no `ZodValidationPipe` but does have real hand-rolled field validation (`requiredString`/`enumValue`/UUID checks) plus admin-only RBAC gating — a consistency gap, not an open surface.
- **Policy Center controller** has no `ZodValidationPipe`; partial downstream business-rule validation exists for some policy areas (PAYROLL, BENEFITS, ATTENDANCE) but not others (LEAVE, EMPLOYEE_SETUP, COUNTRY_POLICY, COMPLIANCE) — admin-gated, multi-stage approval required before real effect.
- **Two brand-new tables shipped this session with zero FK constraints** on obviously-FK-shaped columns: `hr_position.headcount_budgets` (department_id, set_by) and `hr_i9_everify.i9_forms`/`everify_cases` (worker_id, reviewer_id, case IDs). Consistent with — not a deviation from — the already-tracked DATA-3 backlog item (71/168 FK coverage at the 2026-06-28 baseline), but confirms the gap is being actively reproduced, not just inherited. The "enforcement bypass" framing was checked and refuted: a missing FK on `headcount_budgets.department_id` degrades to the code's own already-intentional "no budget configured → unconstrained" no-op path, not an active bypass.
- **CI's `kafka-integration-test` job carries a self-disclosed "billing-locked, validated by static review only, not an actual run" comment** dated 2026-07-12. Verified real and unresolved as of current `main`, but scoped to that one job only — no evidence the disclosure extends repo-wide or that other, older jobs haven't run live. Worth an explicit operator check on GH Actions billing status before trusting that job's "pass."
- **`load-smoke` CI job runs under `NODE_ENV=development`** instead of `test` like its sibling DB-touching jobs — doesn't crash (both values hit the same non-production code path) but skips production secret/CORS guards and is an unexplained inconsistency.
- **`GO-LIVE-RUNBOOK.md`'s "5 real CI jobs" branch-protection claim is stale** — `ci.yml` now defines 8 top-level jobs, including the two (`rls-enforcement-e2e`, `kafka-integration-test`) that prove the exact gates the runbook is tracking. (Verification found the claim was accurate when first written on 2026-07-01 at 5 jobs; three E2E jobs were added afterward and the line was never updated — ordinary staleness, not authorship error.)
- **zod major version is already split across the monorepo**: `apps/hr-auditor-agent` independently pins `^4.4.3` while every `@hcm/*` package and `hr-api`/`hr-web` pin `^3.2x` — worth surfacing to whoever makes the deferred Dependabot #177/#178 pinning decision, since "the monorepo hasn't moved off zod v3 yet" isn't uniformly true today.
- **`GO-LIVE-RUNBOOK.md`'s status banner** still reads "Status at 2026-07-01" despite a substantive PITR-section rewrite on 2026-07-19 — cosmetic, but could mislead a reader about how current the document is.
- **`TenantFilterPlugin`'s ambient tenant filter fails open** (returns the query unfiltered, not an error) when tenant context is unset — the sole isolation mechanism for repositories in compliance, dei-analytics, country-policy, offboarding, onboarding, and position-control that don't extend `BaseRepository`'s fail-closed pattern. Not independently adversarially verified (rated medium by the specialist, below the verification threshold), but architecturally plausible and consistent with the confirmed H-8 finding — any future saga/consumer path that queries one of these repos outside `runWithTenant` would silently run unscoped rather than erroring.

## 5. Verified clean — explicitly checked, no gap found

- No hardcoded secrets/credentials anywhere in `apps/hr-api/src` or `apps/hr-web/src`.
- No security-relevant TODO/FIXME/HACK/XXX comments in either app.
- No skipped/disabled tests (`.skip(`, `it.todo`, `xit(`, `xdescribe(`) anywhere in `apps/hr-api/src` or `apps/hr-web/src`.
- `command-bus.security.test.ts`'s policy-matrix catch-all correctly governs the newest aggregate types (`DisciplinaryAction`, `I9Case`, `EverifyCase`, etc.) via its verb-prefix regex, by design — spot-checked, not a fresh gap.
- Migration-verification CI job's `NODE_ENV` fix (from earlier this session) held; no other DB-touching job regressed the same way.
- The dev-only `LOCAL_BYPASS_TOKEN` in `hr-web` is correctly gated behind `import.meta.env.DEV` and has zero backend references — cannot bypass real API auth even if mis-set in a deployed build.
- The three operator go-live boot guards from the 2026-06-28 report (RLS runtime check, strong-secret/`NODE_ENV=production` fail-fast, `KAFKA_BROKERS` fail-fast) are all still present, correctly wired, and match the shipped `k8s/base/configmap.yaml`.
- ~250 `@Body()` call sites sampled across all 48 controllers found no schema/DTO type mismatches in the ZodValidationPipe wiring landed this session (benefits, compensation, organization, recruiting, position-control).

---

## 6. Recommended remediation order

1. **C-1/C-2 (recruiting IDOR)** — highest blast radius (EEO/PII data, most sensitive new dataset this session) and lowest fix cost (same `findByIdForTenant` pattern already proven 3x this session in global-hr/hr-core/reporting). Should be the very next PR.
2. **C-3/C-4/H-1 (unreachable lifecycle commands: i9-everify controller, works-council lifecycle routes, country-rule-set/statutory-leave-type lifecycle routes)** — these are "just write the missing controller routes," not new logic; the handlers, aggregates, and tests already exist and pass.
3. **C-5 (Policy Center fail-open)** — change the 7 catch blocks from `return []`/`.catch(() => emptyImpactRecords())` to fail-closed (block the apply and surface the query error) or at minimum log/alert on failure.
4. **C-6 (AI kill switch no-op)** — add a use-case/kill-switch status check to `CreateHrAiModelRun`/`StartHrAiModelRun`, likely as a new command-bus pipeline step given the precedent set by `PolicyEngineStep`/`RbacStep`.
5. **H-2 through H-8** — bundle as a follow-up hardening pass; none are as urgent as the above but all are real and confirmed.
