# Inline Edit Saved Views Config Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add editable table cells, per-user saved list views, and visual admin configuration primitives without touching the notifications inbox branch files.

**Architecture:** Saved views live as tenant/user-scoped records in `hr_platform.saved_views`, exposed through a small domain controller and consumed by the web DataTable. Inline editing is a reusable cell primitive; visual config uses small builder components layered over existing workflow/policy endpoints.

**Tech Stack:** NestJS, Kysely/Postgres, node-pg-migrate, React, TanStack Query, Vitest, Testing Library, i18next.

---

### Task 1: Saved Views Backend

**Files:**
- Create: `infra/migrations/20260613000026000_saved_views.js`
- Create: `apps/hr-api/src/domains/saved-views/*`
- Modify: `apps/hr-api/src/app.module.ts`
- Modify: `packages/hr-database/src/types/platform-tables.ts`
- Modify: `packages/hr-access-control/src/access-control.service.ts`
- Modify: `packages/hr-access-control/src/rbac/roles.ts`
- Test: `apps/hr-api/src/domains/saved-views/api/saved-views.controller.spec.ts`
- Test: `apps/hr-api/test/runtime-lifecycle.e2e.test.ts`

- [ ] **Step 1: Write controller tests**
  - Verify create/list/update/delete are tenant and actor scoped.
  - Verify default view uniqueness per user/list.

- [ ] **Step 2: Add migration and database typing**
  - Create `hr_platform.saved_views` with required tenant/user/list columns and indexes.

- [ ] **Step 3: Implement domain**
  - Add aggregate, repository, controller, module.

- [ ] **Step 4: Wire RBAC and AppModule**
  - Add `SavedView` aggregate mapping and saved-view permissions.

- [ ] **Step 5: Add runtime lifecycle E2E**
  - Create/list/update/delete a saved view over HTTP using JSON.

### Task 2: Inline Edit And DataTable Saved Views

**Files:**
- Create: `apps/hr-web/src/components/common/inline-edit.tsx`
- Create: `apps/hr-web/src/components/common/inline-edit.test.tsx`
- Create: `apps/hr-web/src/hooks/use-saved-views.ts`
- Modify: `apps/hr-web/src/components/common/data-table.tsx`
- Modify: `apps/hr-web/src/pages/admin/workers.tsx`
- Modify: `apps/hr-web/src/pages/admin/compensation.tsx`
- Modify: `apps/hr-web/src/i18n/resources.ts`

- [ ] **Step 1: Write InlineEdit tests**
  - Click-to-edit, enter save, escape cancel, blur cancel, optimistic display.

- [ ] **Step 2: Implement InlineEdit**
  - Keyboard-accessible edit button and input, aria labels, local pending state.

- [ ] **Step 3: Add saved-view hook**
  - Query/mutate `/saved-views`.

- [ ] **Step 4: Extend DataTable**
  - Optional editable columns, optional listKey saved-view toolbar and visible columns.

- [ ] **Step 5: Apply to record lists**
  - Workers: editable job title/email via existing worker patch endpoint.
  - Compensation: editable list labels when supported; otherwise present saved views and safe inline fields only.

### Task 3: Visual Admin Builder

**Files:**
- Create: `apps/hr-web/src/components/builder/*`
- Modify: `apps/hr-web/src/pages/admin/approvals-config.tsx`
- Modify: `apps/hr-web/src/pages/admin/policies.tsx`
- Test: builder and page render/a11y tests where existing harness supports it.

- [ ] **Step 1: Add builder primitives**
  - Rule rows, ordered step rows, preview panel.

- [ ] **Step 2: Upgrade approvals config**
  - Drag/drop ordering, move controls, role/worker pickers, escalation rows, sandbox preview.

- [ ] **Step 3: Upgrade policies**
  - Add visual rule rows using existing policy data, without raw JSON in normal UI.

### Task 4: Verification And PR

- [ ] Run focused API/web tests.
- [ ] Run `pnpm typecheck`, `pnpm lint`, `pnpm test` as feasible.
- [ ] Rebuild changed packages.
- [ ] Stage explicit paths only, commit, push, and open PR to `main`.
