# Service Level Objectives / Agreement Targets

The only quantified performance evidence that exists today is a CI regression
gate on the unauthenticated `GET /api/v1/health` endpoint (see
[perf-baseline.md](perf-baseline.md)) and a steady-state latency/error-rate
threshold referenced in [release-process.md](release-process.md). Neither is
a business-facing SLA a customer contract could point to. This document
defines the **target** SLOs this platform is being engineered toward, and is
explicit about which numbers are proven vs. aspirational.

## Status of every number in this document

Every row below is marked:
- **[TARGET]** -- an engineering goal, not yet measured at all.
- **[PROVEN]** -- measured and recorded with dated evidence, *at the scale
  and environment stated in that row*. A row marked [PROVEN] against a local
  smoke test is proven for that smoke test only -- it is explicitly not the
  same claim as "proven at production scale," which requires the
  authenticated, multi-tenant, production-shaped load test described under
  "Validation cadence" below.
- **[NOT COVERED]** -- no defensible target exists yet; the underlying
  capability has a known correctness/scale gap that must close first.

None of the SLOs in this document should be quoted to a customer or in a
contract until the row is [PROVEN] against production-shaped load
specifically (see "Validation cadence" below) -- a [PROVEN] local/CI smoke
result is evidence the measurement methodology works, not a production
capacity claim.

## Availability

| Target | Value | Status |
|---|---|---|
| Monthly API availability | 99.9% (≈43 min/month downtime budget) | **[TARGET]** -- no production deployment has run long enough to measure this; see [GO-LIVE-RUNBOOK.md](GO-LIVE-RUNBOOK.md) for the staging/production provisioning gates that must close first. |
| Planned maintenance windows | Excluded from availability calculation, announced ≥48h in advance | **[TARGET]** |

## Latency

| Target | Value | Status |
|---|---|---|
| Steady-state API p95 (authenticated business endpoints) | < 1 second | **[TARGET]** -- referenced in release-process.md's release gate; not yet measured under realistic multi-tenant load. |
| Health endpoint p95 | < 150ms | **[PROVEN]** -- 78ms p95 recorded 2026-06-30 against a local dev instance (see perf-baseline.md). Gated in CI on every push. |
| Payroll cycle close (per 1,000 workers) | Not yet defined | **[NOT COVERED]** -- the CTO pre-production audit found this path currently does up to ~12,000 sequential DB/command-bus operations for a 2,000-worker cycle with no batching; no latency target can be set honestly until that path is redesigned (tracked separately). |

## Error rate

| Target | Value | Status |
|---|---|---|
| Steady-state error rate | < 1% (5xx) | **[TARGET]** -- referenced in release-process.md; gated by `HcmApiHighErrorRate` Prometheus alert once a real cluster runs it. |
| Health endpoint error rate | 0% under smoke load | **[PROVEN]** -- 0 errors across 6,253 requests recorded 2026-06-30. |

## Business-process SLOs (customer-facing, not yet instrumented)

These are the kind of commitments an enterprise HCM customer will expect
(Workday/SAP/UKG-class competitors publish equivalents), and none currently
have engineering instrumentation behind them:

| Process | Candidate target | Status |
|---|---|---|
| Payroll cycle closes and posts to GL within | Not yet defined | **[NOT COVERED]** -- needs the payroll-cycle-creation redesign first. |
| Employee self-service page load | < 2 seconds p95 | **[TARGET]**, unmeasured. |
| Bulk employee import (mass-update) for 5,000 rows | Not yet defined | **[NOT COVERED]** -- the CTO audit found this path does up to ~20,000 sequential DB round trips before batching was added; re-baseline after that fix lands. |
| Support ticket first response | Not yet defined -- requires a support process to exist first | **[NOT COVERED]**, see [GO-LIVE-RUNBOOK.md](GO-LIVE-RUNBOOK.md) commercial-readiness items. |

## Validation cadence

Once a staging environment exists (tracked as a go-live gate in
GO-LIVE-RUNBOOK.md), the following becomes possible and should be run before
any target in this document is promoted from **[TARGET]** to **[PROVEN]**:

1. An authenticated, multi-tenant load test against realistic data volumes
   (not just `/health`) -- soak (multi-hour sustained) and spike (ramped
   concurrency) profiles, per perf-baseline.md's "Not yet covered" section.
2. A payroll-cycle-close load test at a representative worker count, run
   only after the sequential-operation redesign lands.
3. Re-running (1) and (2) on every major release that touches a hot path,
   not just once.

Until this cadence exists, treat every **[TARGET]** row as an internal
engineering goal a CTO or customer conversation can reference as direction,
not as a number to put in a signed SLA.
