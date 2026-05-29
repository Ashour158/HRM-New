# Attendance Payroll Closure Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Attendance a payroll-grade source of truth by adding period close readiness, monthly closure, locked-ledger payroll handoff, and evidence exports.

**Architecture:** Daily attendance already has command-bus finalization, correction workflows, geolocation evidence, and payroll input creation. This plan adds a period-level orchestration layer that evaluates blockers across an entire pay period, locks daily ledgers through existing commands, and creates payroll inputs through the existing payroll command lifecycle.

**Tech Stack:** NestJS, TypeScript, Kysely/PostgreSQL repositories, existing command bus, React/Vite admin UI, Vitest.

---

### Task 1: Attendance Close Readiness Service

**Files:**
- Create: `apps/hr-api/src/domains/time-attendance/services/attendance-close-readiness.service.ts`
- Test: `apps/hr-api/src/domains/time-attendance/services/attendance-close-readiness.service.test.ts`
- Modify: `apps/hr-api/src/domains/time-attendance/time-attendance.module.ts`

- [ ] Write failing tests for missing locked ledgers, unready locked ledgers, pending corrections, and ready periods.
- [ ] Implement a pure readiness service that accepts active employees, locked snapshots, and correction requests.
- [ ] Export the service from `TimeAttendanceModule`.
- [ ] Run targeted attendance service tests.

### Task 2: Attendance Period Closure Endpoints

**Files:**
- Modify: `apps/hr-api/src/domains/time-attendance/api/dtos.ts`
- Modify: `apps/hr-api/src/domains/time-attendance/api/time-attendance.controller.ts`

- [ ] Add DTOs for period readiness, period close, and period evidence export parameters.
- [ ] Add `GET /time/attendance/period-close/readiness`.
- [ ] Add `POST /time/attendance/period-close/finalize`.
- [ ] Keep all mutations behind the command bus by calling existing `FinalizeAttendanceDailyLedger` and `CreatePayrollInput` commands.
- [ ] Add `GET /time/attendance/period-close/evidence.csv`.

### Task 3: Payroll Source-of-Truth Contract

**Files:**
- Modify: `apps/hr-api/src/domains/payroll/api/payroll.controller.ts`

- [ ] Mark preview attendance as `LOCKED_LEDGER` or `RAW_ESTIMATE`.
- [ ] Keep final close-to-pay blocked when locked attendance is incomplete.
- [ ] Ensure payroll artifacts reference locked attendance handoff rather than raw clock-only estimates.

### Task 4: Admin Attendance UI

**Files:**
- Modify: `apps/hr-web/src/pages/admin/attendance.tsx`

- [ ] Add horizontal tabs for `Daily Ledger`, `Close Readiness`, `Corrections`, `Evidence`, and `Payroll Handoff`.
- [ ] Show period readiness blockers by employee/date/severity.
- [ ] Allow monthly close only when readiness is clean or a privileged override reason is supplied.
- [ ] Add evidence export links for ledger and geolocation data.

### Task 5: Verification

**Commands:**
- `pnpm --filter @hcm/hr-api test -- attendance-close-readiness`
- `pnpm --filter @hcm/hr-api test -- time-attendance`
- `pnpm typecheck`
- `pnpm test`
- `pnpm build`

