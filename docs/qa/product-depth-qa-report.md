# Product Depth QA Report

## Result

PASS with AI auditor observations classified for follow-up.

- Date/time: 2026-06-01T19:49:06+03:00
- Commit SHA: 95e44a6
- Scope: HR admin, employee self-service, leave, attendance/geolocation, organization, RBAC, route coverage, and AI auditor integration.

## Scenarios Verified

| ID | Result | Evidence |
| --- | --- | --- |
| ESS-01 | PASS | Smoke runner validates `/employee/profile` and `/employee/benefits`; employee routes included in route coverage |
| ESS-02 | PASS | Employee time-off API-backed create flow and absence-leave tests |
| ESS-03 | PASS | Leave policy and command-handler tests validate over-balance denial before create/approval; employee UI disables over-balance submit |
| ATT-01 | PASS | Time attendance controller tests validate structured geolocation evidence |
| ATT-02 | PASS | Missing required geolocation is rejected by attendance policy tests |
| ORG-01 | PASS | Organization controller tests cover legal entity, org unit, and department persistence |
| ORG-02 | PASS | Organization tests cover manager reassignment and reporting tree behavior |
| LEAVE-01 | PASS | Admin leave page and leave controller tests cover approval, audit, balance, and payroll impact |
| LEAVE-02 | PASS | Admin leave page and leave controller tests cover rejection reason and audit trail |
| RBAC-01 | PASS | Self-service and access-control tests cover inactive/terminated denial, tenant scoping, and masked SSN |
| GEO-01 | PASS | Time attendance controller tests cover HR-only geolocation evidence export and employee denial |
| ROUTE-01 | PASS | `node scripts/frontend-route-coverage.mjs` reports `missingHighRisk: []` |

## Verification Commands

| Command | Result |
| --- | --- |
| `pnpm --filter @hcm/hr-api test` | PASS: 50 files, 184 tests |
| `pnpm --filter @hcm/access-control test` | PASS: 2 files, 20 tests |
| `pnpm --filter @hcm/hr-api build` | PASS |
| `pnpm --filter hr-web typecheck` | PASS |
| `pnpm --filter hr-web build` | PASS with existing Vite chunk-size warning at 510.70 kB |
| `pnpm --filter @hcm/hr-auditor-agent build` | PASS |
| `pnpm --filter @hcm/hr-auditor-agent audit:agent` | PASS, observations recorded below |
| `node scripts/product-depth-smoke.mjs` | PASS: profile, benefits, dashboard, policy actions, audit ledger |
| `node scripts/frontend-route-coverage.mjs` | PASS: 120 frontend routes, 758 backend routes, no high-risk missing routes |

## AI Auditor Follow-up

| Observation | Status | Evidence |
| --- | --- | --- |
| Placeholder workflow surfaces | Closed for static/user-facing placeholder markers | Updated auditor reports `placeholderFiles: []`; `rg` hits only detector/test fixtures; no user-facing unfinished phrases in `apps/hr-web/src` target pages |
| App-level workflows/no DB triggers | Accepted and documented | Invariant matrix records command/service enforcement as required layer; full backend tests pass. No DB triggers are required for the listed invariants unless future cross-tenant write invariants demand them |
| Geolocation privacy/access review | Closed for check-in/out evidence scope | Migration, structured evidence tests, missing geolocation policy tests, and HR-only export tests pass |
| Frontend/backend route depth gap | Closed for high-risk frontend-to-backend mismatches; product-depth watch item remains | Dedicated route coverage reports 120 frontend routes, 758 backend routes, `missingHighRisk: []`. AI auditor still recommends journey-level route-to-handler review because backend service depth exceeds visible UI breadth |
| Leave/attendance/policy UX/API unevenness | Closed for planned leave/attendance/admin coverage; keep as regression focus | Absence balance enforcement, attendance/geolocation, route coverage, smoke, and frontend build pass. Future QA should walk policy acknowledgement and manager routes as separate product-depth scenarios |

## Remaining Risks

| Risk | Owner | Next Action |
| --- | --- | --- |
| Backend route surface remains much broader than visible UI | Product/QA | Prioritize new UI journeys from route coverage output instead of treating all backend-only routes as defects |
| Workflow enforcement is intentionally application-level | Architecture | Revisit DB triggers only for invariants that cannot safely rely on command bus/service guards |
| Frontend bundle main chunk is slightly above Vite warning threshold | Frontend | Add route-level dynamic imports/manual chunks when performance work is scheduled |
