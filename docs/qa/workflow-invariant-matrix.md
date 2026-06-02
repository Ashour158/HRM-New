# Workflow Invariant Matrix

| Invariant | Current Layer | Required Layer | DB Trigger Required | Evidence |
| --- | --- | --- | --- | --- |
| Employee cannot approve own leave | Command/access-control | Command/access-control | No | Access-control unit test and audit entry |
| Leave cannot exceed policy balance without override | Leave policy service | Service + command guard | No | Leave policy service test |
| Locked attendance ledger cannot be corrected | Attendance command handler | Service + command guard | No | Attendance correction test |
| Payroll close requires approved/locked inputs | Payroll command handler | Command guard | No | Payroll close test |
| Time clock geolocation evidence is privacy-gated | Access-control + API route | Access-control + route guard | No | Evidence export test |
| Tenant/user cannot read another tenant's worker data | Repository filters + guards | Repository + command guard | Maybe, only for cross-tenant write invariants | Multi-tenant access test |

## Verification Status - 2026-06-01

| Invariant | Result | Verification Evidence |
| --- | --- | --- |
| Employee cannot approve own leave | PASS | Leave approval commands remain manager/admin-routed and are covered by leave API/controller tests |
| Leave cannot exceed policy balance without override | PASS | `leave-policy.service.test.ts` and `absence-balance-enforcement.test.ts` cover over-balance denial before create/approval |
| Locked attendance ledger cannot be corrected | PASS | Attendance correction/finalization service tests pass in full `@hcm/hr-api` suite |
| Payroll close requires approved/locked inputs | PASS | Payroll governance, input orchestration, and close-to-pay tests pass in full `@hcm/hr-api` suite |
| Time clock geolocation evidence is privacy-gated | PASS | Geolocation evidence export is role-gated in `time-attendance.controller.test.ts` |
| Tenant/user cannot read another tenant's worker data | PASS | Self-service worker lookup and command-bus employment-status hydration are tenant-scoped in tests |
