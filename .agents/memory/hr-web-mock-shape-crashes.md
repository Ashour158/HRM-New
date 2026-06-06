---
name: hr-web demo mock shape mismatches
description: Why hr-web inner pages crash in demo mode and how to consume API data defensively.
---

# hr-web demo/mock data shapes are partial and inconsistent

The demo mocks in `apps/hr-web/src/lib/mock-data.ts` frequently do NOT match the
TypeScript types the pages cast their responses to (via `unwrap<T>`), so pages that
trust the type crash at runtime even though `tsc` is clean.

Recurring crash classes seen across multiple pages (organization, workers, services):
- **List endpoints return paginated `{ items, total, page, ... }`, not a bare array.**
  e.g. `GET /hr/core/workers` → `{ items: [...] }`. Code doing `data ?? []` then
  `.filter/.map/.find` throws "x is not a function".
- **Some "summary" scalar fields collide with array field names.** e.g.
  `GET /hr/organization/summary` returns `legalEntities: 3` (a count) while the page
  types `legalEntities: LegalEntity[]` → `(3).map` crashes.
- **Dashboard mocks omit whole nested sub-objects.** e.g.
  `GET /hr/organization/workforce-planning` omits `summary`, `workforceCostPlan`,
  `strategicDashboard`, `headcountPlan`. Two-level access `planning?.summary.x`
  short-circuits ONLY on `planning` being nullish; if `planning` exists but `summary`
  doesn't, it throws.

**How to apply:** When consuming hr-web API data in a page, normalize defensively:
- list payloads → `Array.isArray(p) ? p : p?.items ?? []` (do it in the queryFn so the
  whole page sees a real array).
- guard array-typed fields with `Array.isArray(x) ? x : []` (not just `?? []`, which
  passes scalars through).
- use FULL optional chaining `a?.b?.c` for every level of nested dashboard objects.

**Why:** mocks are partial; these guards are behavior-preserving (identical when the
real API returns correct shapes) and the only thing standing between a clean `tsc`
and a blank crashing page in demo mode.
