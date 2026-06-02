# Product Depth QA With AI Auditor Observations Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Status:** Approved by product owner on 2026-06-01.

**Goal:** Walk HRM Nexus as HR admin, employee, and manager through realistic business scenarios, close shallow/demo workflow gaps, and convert the AI auditor observations into acceptance criteria.

**Architecture:** Keep the existing NestJS domain modules, command bus, workflow/FSM layer, Kysely repositories, and React/Vite portal shell. Add depth through scenario tests, route coverage checks, service-backed UI states, privacy/access checks, and a written invariant matrix that distinguishes app-level workflow rules from database-enforced rules.

**Tech Stack:** NestJS, TypeScript, Kysely/PostgreSQL, Vitest, React/Vite, Axios API client, existing OpenAI Agents SDK auditor sidecar, PowerShell/Node smoke scripts.

---

## AI Auditor Observations To Carry Forward

- Placeholder/demo workflow surfaces remain in `apps/hr-web/src/pages/employee/time-off.tsx`, `apps/hr-web/src/pages/admin/payroll.tsx`, `apps/hr-web/src/pages/admin/settings.tsx`, and `apps/hr-web/src/pages/login.tsx`.
- Workflow automation is currently app-level: many FSM/workflow/saga files exist, but the auditor found no `CREATE TRIGGER` definitions in migrations.
- Structured geolocation evidence exists through `infra/migrations/20240524000025000_time_clock_structured_geolocation.js` and `/time/attendance/daily-ledger/geolocation-evidence.csv`; it needs privacy, retention, and access-control review.
- Frontend API route coverage is much thinner than backend route surface. Treat this as a prioritization signal: cover high-risk user workflows first, then decide which backend-only routes need UI, docs, or internal-only classification.

## Files And Responsibilities

- Create `docs/qa/product-depth-scenario-matrix.md`: human-readable QA matrix for HR admin, manager, and employee scenarios.
- Create `docs/qa/workflow-invariant-matrix.md`: source-of-truth matrix for business invariants, enforcement layer, audit evidence, and trigger decision.
- Create `scripts/product-depth-smoke.mjs`: repeatable local smoke runner that logs in as admin/employee and validates critical API routes.
- Create `scripts/frontend-route-coverage.mjs`: compares frontend API calls against backend controller routes and classifies high-risk gaps.
- Modify `apps/hr-web/src/pages/employee/time-off.tsx`: replace demo-only leave UX with API-backed request, balance, validation, loading, and error states.
- Modify `apps/hr-web/src/pages/admin/leave-management.tsx`: validate admin approval/rejection, pending queue, policy result, and audit visibility.
- Modify `apps/hr-web/src/pages/admin/organization.tsx`: verify legal entity, org unit, department, and manager relationship workflows.
- Modify `apps/hr-web/src/pages/admin/payroll.tsx`: remove placeholder language and expose service-backed payroll readiness states.
- Modify `apps/hr-web/src/pages/admin/settings.tsx`: convert settings into real policy/config modules or mark unavailable modules as disabled with backend-backed status.
- Modify `apps/hr-api/src/domains/absence-leave/**`: add missing scenario tests around leave policy, balances, approval failure, and payroll impact.
- Modify `apps/hr-api/src/domains/time-attendance/**`: add invalid geolocation, missing geolocation, privacy-gated evidence, and check-in/out tests.
- Modify `apps/hr-api/src/domains/organization/**`: add manager reassignment and department/legal entity tests.
- Modify `packages/hr-access-control/src/**`: add terminated employee and geolocation evidence access checks.

---

### Task 1: Scenario Matrix And Acceptance Gates

**Files:**
- Create: `docs/qa/product-depth-scenario-matrix.md`
- Create: `docs/qa/workflow-invariant-matrix.md`

- [ ] **Step 1: Create scenario matrix**

Add this table to `docs/qa/product-depth-scenario-matrix.md`:

```markdown
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
| RBAC-01 | Terminated Employee | Access employee portal | Protected workflows are denied; no sensitive data is exposed | 403/redirect and access-control test |
| GEO-01 | HR Admin | Export geolocation evidence | Export is allowed only to roles with explicit attendance/privacy permission | CSV route and policy check |
| ROUTE-01 | Engineer | Compare frontend/backend route coverage | High-risk missing UI paths are classified and tracked | Route coverage report |
```

- [ ] **Step 2: Create workflow invariant matrix**

Add this table to `docs/qa/workflow-invariant-matrix.md`:

```markdown
# Workflow Invariant Matrix

| Invariant | Current Layer | Required Layer | DB Trigger Required | Evidence |
| --- | --- | --- | --- | --- |
| Employee cannot approve own leave | Command/access-control | Command/access-control | No | Access-control unit test and audit entry |
| Leave cannot exceed policy balance without override | Leave policy service | Service + command guard | No | Leave policy service test |
| Locked attendance ledger cannot be corrected | Attendance command handler | Service + command guard | No | Attendance correction test |
| Payroll close requires approved/locked inputs | Payroll command handler | Command guard | No | Payroll close test |
| Time clock geolocation evidence is privacy-gated | Access-control + API route | Access-control + route guard | No | Evidence export test |
| Tenant/user cannot read another tenant's worker data | Repository filters + guards | Repository + command guard | Maybe, only for cross-tenant write invariants | Multi-tenant access test |
```

- [ ] **Step 3: Commit the documentation baseline**

Run:

```powershell
git add docs/qa/product-depth-scenario-matrix.md docs/qa/workflow-invariant-matrix.md
git commit -m "docs: approve product-depth qa plan"
```

Expected: commit succeeds with only the two QA docs staged.

---

### Task 2: Repeatable Product-Depth Smoke Runner

**Files:**
- Create: `scripts/product-depth-smoke.mjs`

- [ ] **Step 1: Add the smoke runner**

Create `scripts/product-depth-smoke.mjs`:

```js
const baseUrl = process.env.HCM_API_URL || 'http://localhost:3001/api/v1';

async function login(email) {
  const response = await fetch(`${baseUrl}/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email, password: 'Password123!' }),
  });
  if (!response.ok) throw new Error(`Login failed for ${email}: ${response.status}`);
  const body = await response.json();
  return body.accessToken ?? body.data?.accessToken ?? body.token ?? body.data?.token;
}

async function get(path, token) {
  const response = await fetch(`${baseUrl}${path}`, {
    headers: { authorization: `Bearer ${token}` },
  });
  const text = await response.text();
  if (!response.ok) throw new Error(`${path} failed: ${response.status} ${text}`);
  return text ? JSON.parse(text) : {};
}

const adminToken = await login('hr.admin@example.com');
const employeeToken = await login('employee@example.com');

const checks = [
  ['employee profile', () => get('/employee/profile', employeeToken)],
  ['employee benefits', () => get('/employee/benefits', employeeToken)],
  ['admin dashboard', () => get('/admin/dashboard', adminToken)],
  ['policy actions benefits', () => get('/policy/allowed-actions?aggregateType=BENEFITS_PROGRAM', adminToken)],
  ['audit ledger', () => get('/audit', adminToken)],
];

for (const [name, check] of checks) {
  await check();
  console.log(`PASS ${name}`);
}
```

- [ ] **Step 2: Run the smoke runner**

Run:

```powershell
node scripts/product-depth-smoke.mjs
```

Expected:

```text
PASS employee profile
PASS employee benefits
PASS admin dashboard
PASS policy actions benefits
PASS audit ledger
```

---

### Task 3: Employee Leave Self-Service Depth

**Files:**
- Modify: `apps/hr-web/src/pages/employee/time-off.tsx`
- Modify/Test: `apps/hr-api/src/domains/absence-leave/services/leave-policy.service.test.ts`
- Modify/Test: `apps/hr-api/src/domains/absence-leave/api/absence-leave.controller.ts`

- [ ] **Step 1: Add failing policy tests**

Add tests that prove:

```ts
expect(validRequest.policyResult.allowed).toBe(true);
expect(overBalanceRequest.policyResult.allowed).toBe(false);
expect(overBalanceRequest.policyResult.reason).toContain('balance');
expect(holidayOnlyRequest.durationHours).toBe(0);
```

- [ ] **Step 2: Wire the employee page to service-backed data**

The employee time-off page must call live APIs for balances and requests. Its UI states must be:

```ts
type EmployeeLeavePageState =
  | { status: 'loading' }
  | { status: 'ready'; balances: LeaveBalance[]; requests: AbsenceRequest[] }
  | { status: 'empty'; balances: LeaveBalance[] }
  | { status: 'error'; message: string };
```

- [ ] **Step 3: Verify employee leave workflows**

Run:

```powershell
pnpm --filter @hcm/hr-api test -- absence-leave
pnpm --filter hr-web typecheck
pnpm --filter hr-web build
```

Expected: absence-leave tests pass, web typecheck passes, web build passes.

---

### Task 4: Admin Leave Management Depth

**Files:**
- Modify: `apps/hr-web/src/pages/admin/leave-management.tsx`
- Modify/Test: `apps/hr-api/src/domains/absence-leave/**`
- Modify/Test: `apps/hr-api/src/audit.controller.spec.ts`

- [ ] **Step 1: Add approval/rejection test coverage**

Add tests for these state transitions:

```ts
expect(pending.allowedActions).toContain('APPROVE');
expect(approved.status).toBe('APPROVED');
expect(rejected.status).toBe('REJECTED');
expect(auditEntry.action).toMatch(/Approve|Reject|Leave/i);
```

- [ ] **Step 2: Expose admin decision UX**

The admin leave page must show:

```text
Pending queue
Policy result
Balance impact
Payroll impact
Approve action
Reject action with reason
Audit/event trail
```

- [ ] **Step 3: Verify leave admin behavior**

Run:

```powershell
pnpm --filter @hcm/hr-api test -- absence-leave audit
node scripts/product-depth-smoke.mjs
```

Expected: tests pass and smoke runner still passes.

---

### Task 5: Attendance And Geolocation Evidence Review

**Files:**
- Modify/Test: `apps/hr-api/src/domains/time-attendance/commands/record-time-clock-event.handler.ts`
- Modify/Test: `apps/hr-api/src/domains/time-attendance/api/time-attendance.controller.ts`
- Modify/Test: `packages/hr-access-control/src/access-control.service.test.ts`
- Review: `infra/migrations/20240524000025000_time_clock_structured_geolocation.js`

- [ ] **Step 1: Add geolocation scenario tests**

Add tests that prove:

```ts
expect(validClockIn.geolocation.latitude).toBeTypeOf('number');
expect(validClockIn.geolocation.longitude).toBeTypeOf('number');
expect(validClockIn.geolocation.accuracyMeters).toBeLessThanOrEqual(policy.maxAccuracyMeters);
expect(missingLocationResult.status).toBe('EXCEPTION');
expect(evidenceExportForEmployee.statusCode).toBe(403);
expect(evidenceExportForHrAdmin.statusCode).toBe(200);
```

- [ ] **Step 2: Review privacy metadata**

The time clock evidence must include structured fields equivalent to:

```ts
interface TimeClockEvidence {
  latitude: number | null;
  longitude: number | null;
  accuracyMeters: number | null;
  provider: 'browser' | 'mobile' | 'manual' | 'unknown';
  capturedAt: string;
  policyDecision: 'ACCEPTED' | 'EXCEPTION' | 'REJECTED';
  policyReason: string | null;
}
```

- [ ] **Step 3: Verify attendance and privacy behavior**

Run:

```powershell
pnpm --filter @hcm/hr-api test -- time-attendance
pnpm --filter @hcm/access-control test
```

Expected: geolocation storage, exception behavior, and privacy gating tests pass.

---

### Task 6: Organization, Departments, And Manager Relationships

**Files:**
- Modify: `apps/hr-web/src/pages/admin/organization.tsx`
- Modify/Test: `apps/hr-api/src/domains/organization/api/organization.controller.ts`
- Modify/Test: `apps/hr-api/src/domains/organization/repositories/manager-relationship.repository.ts`

- [ ] **Step 1: Add organization workflow tests**

Add tests that prove:

```ts
expect(createdLegalEntity.name).toBe('Demo Legal Entity');
expect(createdDepartment.parentOrgUnitId).toBe(createdOrgUnit.id);
expect(managerRelationship.managerWorkerId).toBe(manager.id);
expect(employeeAfterMove.departmentId).toBe(createdDepartment.id);
```

- [ ] **Step 2: Confirm admin UI has real create/edit flows**

The organization admin page must support:

```text
Create/edit legal entity
Create/edit organization unit
Create/edit department
Assign employee to department
Assign manager relationship
Show reporting tree
Show validation/error state from API
```

- [ ] **Step 3: Verify organization workflow**

Run:

```powershell
pnpm --filter @hcm/hr-api test -- organization
pnpm --filter hr-web typecheck
```

Expected: organization tests and web typecheck pass.

---

### Task 7: Terminated Employee And RBAC Edge Cases

**Files:**
- Modify/Test: `packages/hr-access-control/src/access-control.service.test.ts`
- Modify/Test: `apps/hr-api/src/auth/auth.service.ts`
- Modify/Test: `apps/hr-api/src/employee-self-service.controller.spec.ts`

- [ ] **Step 1: Add terminated employee tests**

Add tests that prove:

```ts
expect(terminatedEmployeeCanLogin).toBe(false);
expect(terminatedEmployeeProfileResponse.statusCode).toBe(403);
expect(terminatedEmployeeBenefitsResponse.statusCode).toBe(403);
expect(terminatedEmployeeAllowedActions).toEqual([]);
```

- [ ] **Step 2: Verify access-control decisions**

Run:

```powershell
pnpm --filter @hcm/access-control test
pnpm --filter @hcm/hr-api test -- employee-self-service auth
```

Expected: terminated employees cannot access self-service workflows or protected data.

---

### Task 8: Route Coverage And Placeholder Closure

**Files:**
- Create: `scripts/frontend-route-coverage.mjs`
- Modify: `apps/hr-web/src/pages/admin/payroll.tsx`
- Modify: `apps/hr-web/src/pages/admin/settings.tsx`
- Modify: `apps/hr-web/src/pages/login.tsx`
- Review: `apps/hr-web/src/components/ui/skeleton.tsx`
- Review: `apps/hr-web/src/components/common/field-mask.tsx`

- [ ] **Step 1: Add route coverage script**

Create `scripts/frontend-route-coverage.mjs` that:

```js
import { readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';

const root = process.cwd();
const frontendRoot = join(root, 'apps/hr-web/src');
const apiRoot = join(root, 'apps/hr-api/src');

async function walk(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) files.push(...await walk(path));
    else if (/\.(ts|tsx)$/.test(entry.name)) files.push(path);
  }
  return files;
}

const frontendFiles = await walk(frontendRoot);
const apiFiles = await walk(apiRoot);
const frontendRoutes = new Set();
const backendRoutes = new Set();

for (const file of frontendFiles) {
  const content = await readFile(file, 'utf8');
  for (const match of content.matchAll(/apiClient\.(get|post|put|patch|delete)\(\s*['"`]([^'"`]+)['"`]/g)) {
    frontendRoutes.add(match[2].split('?')[0]);
  }
}

for (const file of apiFiles) {
  const content = await readFile(file, 'utf8');
  const controller = content.match(/@Controller\(\s*['"`]([^'"`]*)['"`]\s*\)/)?.[1];
  if (!controller) continue;
  for (const match of content.matchAll(/@(Get|Post|Put|Patch|Delete)\(\s*(?:['"`]([^'"`]*)['"`])?/g)) {
    backendRoutes.add(`/${[controller, match[2] ?? ''].filter(Boolean).join('/')}`.replace(/\/+/g, '/'));
  }
}

const highRiskPrefixes = ['/employee', '/time', '/absence', '/policy', '/organization', '/payroll', '/audit'];
const missingHighRisk = [...frontendRoutes].filter((route) => {
  return highRiskPrefixes.some((prefix) => route.startsWith(prefix)) && ![...backendRoutes].some((backend) => backend === route || backend.includes(':'));
});

console.log(JSON.stringify({
  frontendRoutes: frontendRoutes.size,
  backendRoutes: backendRoutes.size,
  missingHighRisk,
}, null, 2));

if (missingHighRisk.length > 0) process.exitCode = 1;
```

- [ ] **Step 2: Remove user-facing placeholder language**

Search:

```powershell
rg -n "placeholder|demo mode|development mode|mock data|not wired" apps/hr-web/src
```

Expected: only legitimate developer-only test fixtures or neutral UI component names remain. User-facing page text must not advertise unfinished workflows.

- [ ] **Step 3: Verify route coverage**

Run:

```powershell
node scripts/frontend-route-coverage.mjs
pnpm --filter hr-web build
```

Expected: no high-risk missing frontend/backend route mismatch, and web build passes.

---

### Task 9: Final Product-Depth QA Report

**Files:**
- Create: `docs/qa/product-depth-qa-report.md`
- Update: `docs/qa/product-depth-scenario-matrix.md`
- Update: `docs/qa/workflow-invariant-matrix.md`

- [ ] **Step 1: Run final commands**

Run:

```powershell
pnpm --filter @hcm/hr-api test
pnpm --filter @hcm/access-control test
pnpm --filter @hcm/hr-api build
pnpm --filter hr-web typecheck
pnpm --filter hr-web build
pnpm --filter @hcm/hr-auditor-agent audit:agent
node scripts/product-depth-smoke.mjs
node scripts/frontend-route-coverage.mjs
```

Expected: all commands pass. If the AI auditor still reports findings, copy them into the report with owner/status.

- [ ] **Step 2: Write final QA report**

Create `docs/qa/product-depth-qa-report.md`:

```markdown
# Product Depth QA Report

## Result

PASS or FAIL with date/time and commit SHA.

## Scenarios Verified

List each matrix ID, result, evidence, and defect link or file reference.

## AI Auditor Follow-up

| Observation | Status | Evidence |
| --- | --- | --- |
| Placeholder workflow surfaces | Closed or open | Files/commands |
| App-level workflows/no DB triggers | Accepted with documented invariant matrix or changed | Matrix/tests |
| Geolocation privacy/access review | Closed or open | Access tests/export tests |
| Frontend/backend route depth gap | Closed or classified | Route coverage output |

## Remaining Risks

Only list risks with concrete owner and next action.
```

- [ ] **Step 3: Commit final QA artifacts and fixes**

Run:

```powershell
git add docs/qa scripts apps/hr-web apps/hr-api packages/hr-access-control
git commit -m "test: add product-depth qa coverage"
```

Expected: commit contains the scenario matrix, route/smoke scripts, tests, and workflow fixes produced by this plan.

---

## Execution Options

1. **Subagent-Driven (recommended):** Dispatch one fresh subagent per task and review each result before merging it into the main workspace.
2. **Inline Execution:** Execute this plan in the current session with checkpoints after route coverage, leave/attendance, organization/RBAC, and final verification.

