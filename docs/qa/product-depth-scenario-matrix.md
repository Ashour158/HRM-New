# Product Depth QA Scenario Matrix

## Actors

| Actor | Login | Purpose |
| --- | --- | --- |
| HR Admin | hr.admin@example.com | Admin workflows, policies, approvals, org setup, payroll readiness |
| Employee | employee@example.com | Self-service profile, leave, benefits, payslips, check-in/out |
| Manager | manager@example.com | Team approvals, employee visibility, manager relationship behavior |

## Required Scenarios

| ID | Actor | Scenario | Expected Result | Evidence |
| --- | --- | --- | --- | --- |
| ESS-01 | Employee | Open self-service dashboard | Dashboard shows live profile, benefits, leave, attendance, and payslip modules | Browser smoke screenshot and API response |
| ESS-02 | Employee | Apply for valid leave | Request is created, policy result is visible, status is pending approval | Absence request row and audit entry |
| ESS-03 | Employee | Apply for leave exceeding balance | Request is blocked with a clear policy reason | API 4xx or validation state |
| ATT-01 | Employee | Check in with valid geolocation | Time clock event stores structured evidence and policy decision | Time clock event row |
| ATT-02 | Employee | Check in without required geolocation | Check-in is blocked or exceptioned according to attendance policy | Time clock event/exception row |
| ORG-01 | HR Admin | Create legal entity, org unit, department | Records persist and appear in organization admin UI | Repository/API response |
| ORG-02 | HR Admin | Assign manager relationship | Employee reporting line changes and manager view reflects it | Manager relationship row |
| LEAVE-01 | HR Admin | Approve leave | Status transitions through allowed action and audit event is recorded | FSM/audit evidence |
| LEAVE-02 | HR Admin | Reject leave | Status transitions with reason and employee sees rejected state | FSM/audit evidence |
| RBAC-01 | Employee | Terminated employee attempts to access employee portal | Protected workflows are denied; no sensitive data is exposed | 403/redirect and access-control test |
| GEO-01 | HR Admin | Export geolocation evidence | Export is allowed only to roles with explicit attendance/privacy permission | CSV route and policy check |
| ROUTE-01 | HR Admin | Compare frontend/backend route coverage for admin and self-service workflows | High-risk missing UI paths are classified and tracked | Route coverage report |

## Verification Status - 2026-06-01

| ID | Result | Verification Evidence |
| --- | --- | --- |
| ESS-01 | PASS | `node scripts/product-depth-smoke.mjs`; `/employee/profile`, `/employee/benefits`, and employee dashboard API routes covered by `scripts/frontend-route-coverage.mjs` |
| ESS-02 | PASS | `pnpm --filter @hcm/hr-api test -- absence-leave`; employee time-off page uses `/employee/absences` create flow |
| ESS-03 | PASS | `leave-policy.service.test.ts` and `absence-balance-enforcement.test.ts` cover over-balance denial before create/approval; employee UI disables over-balance submit |
| ATT-01 | PASS | `time-attendance.controller.test.ts` verifies structured geolocation evidence for clock events |
| ATT-02 | PASS | `time-attendance.controller.test.ts` verifies missing required geolocation is rejected by policy |
| ORG-01 | PASS | `organization.controller.spec.ts` covers legal entity, org unit, and department creation |
| ORG-02 | PASS | `organization.controller.spec.ts` covers manager reassignment and reporting-tree behavior |
| LEAVE-01 | PASS | `employee-leave.controller.test.ts` and admin leave page cover approval, audit, balance, and payroll impact |
| LEAVE-02 | PASS | `employee-leave.controller.test.ts` and admin leave page cover rejection with reason and audit trail |
| RBAC-01 | PASS | `employee-self-service.controller.spec.ts`, `command-bus.security.test.ts`, and `access-control.service.test.ts` cover inactive/terminated denial, no SSN leak, and tenant-scoped access |
| GEO-01 | PASS | `time-attendance.controller.test.ts` covers HR-admin-only evidence export and employee 403 |
| ROUTE-01 | PASS | `node scripts/frontend-route-coverage.mjs` reports `missingHighRisk: []` |
