# Payroll Engine V2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build an enterprise-grade payroll close-to-pay engine with configurable low-code policies, governed cycle validation, employee-type-aware calculation, payslip generation, protected exports, and an operational admin UI.

**Architecture:** Keep payroll calculation deterministic and testable in small services. Store tenant-controlled policy in HCM setup JSON first, then persist locked payroll outputs through existing command handlers and repositories. The admin UI should expose only real backend capabilities and avoid copied/non-working reference controls.

**Tech Stack:** NestJS, TypeScript, Vitest, Kysely repositories, command bus/FSM, React/Vite, Tailwind/Radix UI.

---

### Task 1: Payroll Rule Engine And Employee Type Eligibility

**Files:**
- Modify: `apps/hr-api/src/domains/hcm-setup/hcm-setup.types.ts`
- Modify: `apps/hr-web/src/types/index.ts`
- Modify: `apps/hr-api/src/domains/payroll/services/payroll-cycle-calculation.service.ts`
- Test: `apps/hr-api/src/domains/payroll/services/payroll-cycle-calculation.service.test.ts`

- [ ] **Step 1: Write failing tests**

Add tests proving:
- progressive tax brackets replace flat tax when configured
- employee insurance caps are applied
- deductions can be pre-tax or post-tax
- deductions can be limited to employee types, locations, and effective date ranges
- hourly employees calculate gross from payable attendance hours

- [ ] **Step 2: Run red tests**

Run: `pnpm --filter @hcm/hr-api exec vitest run src/domains/payroll/services/payroll-cycle-calculation.service.test.ts`

Expected: tests fail because the current engine does not support brackets, caps, eligibility, deduction timing, or hourly gross calculation.

- [ ] **Step 3: Implement minimal engine support**

Extend payroll policy types with:
- `taxMode`
- `taxBrackets`
- `employeeInsuranceCap`
- `employerInsuranceCap`
- employee type, location, date, and timing metadata on deductions

Update calculation service to calculate gross, taxable base, tax, insurance, policy deductions, net pay, and explainability deterministically.

- [ ] **Step 4: Run green tests**

Run: `pnpm --filter @hcm/hr-api exec vitest run src/domains/payroll/services/payroll-cycle-calculation.service.test.ts`

Expected: all payroll calculation tests pass.

### Task 2: Payroll Cycle Brain And Readiness Gates

**Files:**
- Create: `apps/hr-api/src/domains/payroll/services/payroll-cycle-governance.service.ts`
- Test: `apps/hr-api/src/domains/payroll/services/payroll-cycle-governance.service.test.ts`
- Modify: `apps/hr-api/src/domains/payroll/api/payroll.controller.ts`
- Modify: `apps/hr-api/src/domains/payroll/payroll.module.ts`

- [ ] **Step 1: Write failing tests**

Add tests proving cycle validation blocks:
- duplicate year/month/workplace cycles
- missing bank account data
- missing salary or zero gross when employee is payroll eligible
- unresolved attendance payroll blockers
- negative net pay

- [ ] **Step 2: Implement governance service**

Return structured readiness issues with severity, employee id, code, message, and blocking flag.

- [ ] **Step 3: Wire close-to-pay**

`POST /payroll/monthly-cycle/close-to-pay` must block when readiness has blocking issues, unless an explicit admin override field is present and audit metadata records the override reason.

### Task 3: Payslip Documents And Admin Payslip Register

**Files:**
- Modify: `apps/hr-api/src/domains/payroll/services/payroll-cycle-calculation.service.ts`
- Modify: `apps/hr-api/src/domains/payroll/api/payroll.controller.ts`
- Modify: `apps/hr-api/src/domains/payroll/api/employee-payroll.controller.ts`
- Modify: `apps/hr-web/src/pages/employee/payslip.tsx`

- [ ] **Step 1: Write failing tests**

Add tests proving payslips include employee name, employee number, gross, taxable base, deductions, employer contributions, net pay, period, pay date, and YTD totals from locked result lines.

- [ ] **Step 2: Implement payslip document DTO**

Add admin `GET /payroll/cycles/:cycleId/payslips` and employee self-service `GET /employee/payslips` using the same document builder.

### Task 4: Export Governance

**Files:**
- Modify: `apps/hr-api/src/domains/payroll/api/payroll.controller.ts`
- Test: `apps/hr-api/src/domains/payroll/api/payroll.controller.spec.ts`

- [ ] **Step 1: Write failing tests**

Add tests proving payroll and bank exports are denied for non-payroll roles, classified as high sensitivity, and include export metadata.

- [ ] **Step 2: Implement export status gates**

Exports should be tied to a selected payroll cycle when possible and should carry file hash, classification, scope, and export event metadata.

### Task 5: Payroll Admin UI Redesign

**Files:**
- Modify: `apps/hr-web/src/pages/admin/payroll.tsx`

- [ ] **Step 1: Redesign only around real features**

Use horizontal tabs:
- Cycle
- Register
- Exceptions
- Policies
- Exports
- Payslips

Show cycle readiness, blockers, payroll register, policy editor, export center, and payslip register. Remove non-working or decorative controls.

- [ ] **Step 2: Browser verification**

Verify `/admin/payroll` renders, does not flash, and exposes the built controls only.
