# Intelligence Layer — Architecture (v1, heuristic, no external AI)

Authoritative design for Prompt 3. v1 is **explainable heuristics only** — no LLM/ML
provider wired. The whole point is a pluggable seam so a real model can replace a
heuristic later behind the same interface.

## Placement in the nervous system

```
domain events ──▶ event-bus ──▶ IntelligenceConsumer ──▶ read-models (hr_intelligence)
                                         │
                                  IntelligenceModel(s)  (pure functions, packages/hr-intelligence)
                                         │
                          GET endpoints + admin/insights.tsx + manager team view
                                         │
                          anomaly flags ──▶ notification bus (ReminderEmitter pattern)
```

- **`packages/hr-intelligence`** — pure, deterministic, side-effect-free model functions.
  No DB, no Nest, no network. Input = a typed feature snapshot; output = a score + the
  contributing factors (explainability is mandatory — never a bare number).
- **`apps/hr-api/src/domains/intelligence`** — the Nest wiring: an event consumer that
  subscribes to existing domain events, assembles feature snapshots, runs the model
  functions, and persists results to append-only read-models. Controllers expose reads.
- **`hr_intelligence` schema** — append-only snapshot tables (one row per
  worker/period/model run); never mutate, always insert a new snapshot. Migration +
  repos required (auto-scan migration coverage will enforce this).

## The pluggable interface (the seam)

```ts
export interface IntelligenceModel<TFeatures, TResult extends ScoredInsight> {
  readonly key: string;            // 'attrition-risk' | 'attendance-anomaly'
  readonly version: string;        // bump when logic changes
  score(features: TFeatures): TResult;   // pure
}
export interface ScoredInsight {
  score: number;                   // 0..1 normalized
  band: 'LOW' | 'MEDIUM' | 'HIGH';
  factors: { factor: string; weight: number; detail: string }[];  // explainability
  modelKey: string;
  modelVersion: string;
}
```
A future ML/LLM model implements the same interface; the consumer/endpoints don't change.

## v1 models

**Model 1 — attrition-risk (per worker).** Features from existing signals only:
tenure, comp position vs band midpoint, months since last promotion/comp change,
engagement survey score trend, absence trend, manager-relationship changes. Weighted
heuristic → score + factors. Explainable ("comp 12% below band midpoint (+0.2),
no promotion in 28 months (+0.15) …").

**Model 2 — attendance/payroll anomaly (per worker/period).** Outlier detection on
existing attendance ledger + payroll lines: z-score on hours/overtime vs the worker's
trailing mean, pay delta vs prior period beyond a threshold. Emits a flag through the
notification bus (ReminderEmitter pattern) and a read-model row.

## Data sourcing rules
- Read ONLY existing aggregates/read-models via events or repositories; do not add
  write paths to other domains.
- Respect the data-classification taxonomy — intelligence reads of SPECIAL_CATEGORY /
  HIGH_SENSITIVITY fields go through the field-policy gate; surface only aggregate,
  non-identifying outputs in dashboards.
- Multi-tenant: every snapshot carries tenant_id; all reads tenant-scoped.

## Surfacing
- `GET /intelligence/attrition-risk/worker/:workerId`, `/attrition-risk/tenant/:tenantId`
  (ranked), `/anomalies/tenant/:tenantId` — all read-only, RBAC: new `INTELLIGENCE_READ`
  permission mapped + role-granted (HR_ADMIN, EXECUTIVE_VIEWER, MANAGER for own team).
- `apps/hr-web/src/pages/admin/insights.tsx` — dashboard (charts) of attrition-risk
  distribution + anomaly feed. Manager view: team attrition risk on manager/team.
- Everything explainable: the UI shows the `factors`, not just the score.

## Explicitly out of scope for v1
No external LLM/ML provider, no training pipeline, no PII in model output. Keep models
deterministic so unit tests can assert exact scores from fixed inputs.

## Acceptance
- Deterministic unit tests per model (fixed features → exact score + factors).
- E2E: ingest domain events → read back a scored, explainable insight via the endpoint;
  an anomaly event produces a notification.
