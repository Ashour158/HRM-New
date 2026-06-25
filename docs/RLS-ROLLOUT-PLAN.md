# Postgres Row-Level Security (RLS) Rollout Plan

**Status:** PROVEN AT DB LEVEL — policies + roles validated against live Postgres (2026-06-25). App-connection activation has one remaining blocker (boot path under RLS); see §8.
**Goal:** Defense-in-depth multi-tenancy enforced by the database, so a missing `WHERE tenant_id`, a raw query, an INSERT, or a plugin bypass can no longer leak or cross-write tenant data.

---

## 8. Validation results (2026-06-25, live Postgres)

Provisioned `hcm_app` (non-superuser, RLS-subject) + `hcm_system` (BYPASSRLS) via the fixed
`infra/rls/provision-app-role.sql` (the original `:app_password` interpolation was broken inside
dollar-quoted `DO` blocks — now uses `:'app_password'` + `\gexec`). Applied the staged policy migration:
**166 `hr_*` tables** got `ENABLE`+`FORCE ROW LEVEL SECURITY` and a `tenant_isolation` policy.

Direct proof as `hcm_app`:

| Scenario | Result |
| --- | --- |
| `SET app.current_tenant` = owning tenant, `SELECT` | sees only that tenant's rows ✓ |
| GUC = a different tenant | **0 rows** ✓ |
| GUC unset | **0 rows (fail-closed)** ✓ |
| `INSERT` a row for a different tenant (WITH CHECK) | **ERROR: violates row-level security policy** ✓ |

DB-level cross-tenant read **and** write are blocked independent of the app-layer plugin.

### Kit completeness fix (applied + re-validated)
The kit originally scoped policies and grants to `hr_%` only, but **3 tenant_id tables live in `public`**
(`admin_module_operation_controls`/`records`/`workflows`). Fixed:
- `enable-tenant-rls.js` now covers every tenant_id base table in any non-system schema (was `hr_%`) →
  **169 tables** RLS+FORCE (was 166).
- `provision-app-role.sql` now also grants `hcm_app` on the `public` tenant tables (per-table, excluding
  `pgmigrations`). Re-validated: `hcm_app` reads `public.admin_module_operation_records` tenant-scoped with
  no permission error.

### Remaining blocker before flipping the app to `hcm_app`
Even with grants+policies complete, booting the full app as `hcm_app` with `DB_RLS_ENABLED=true` still hangs
in `beforeAll` — so it is NOT just a grant gap. Boot-time lifecycle hooks and background workers run
**without a request tenant** and fail-closed/hang under RLS. Confirmed boot-time DB hooks:
`platform/command-bus/command-bus.ts` and `integrations/consumers/email-notification.consumer.ts`
(onApplicationBootstrap), plus the outbox dispatcher / inbox recovery / scheduler / tenant-onboarding workers.
To activate the app connection (not just the policies), still required:
1. Route those workers + boot hooks through the `hcm_system` BYPASSRLS role (a separate pool, e.g.
   `SYSTEM_DATABASE_URL` → `getSystemPool()`), since they legitimately operate cross-tenant.
2. Add a focused boot probe (temporary logger) to pin the exact first hanging query, then make each such
   read tenant-tolerant or system-scoped.
3. Then: `DB_RLS_ENABLED=true` + `DATABASE_URL` → `hcm_app`, keeping migrations/seed on the admin role.
This is a multi-file change with real blast radius (all background DB access), so it is staged as its own
task rather than bundled here.

### Root cause found (2026-06-25) — the app boots fine under RLS; the e2e hang is a TEST-HARNESS artifact
A standalone boot probe (compiled `AppModule`, same overrides as the e2e but **logger ON**, connected as
`hcm_app` with `DB_RLS_ENABLED=true`) showed **`app.init()` COMPLETES in ~5s** — the app starts cleanly
under RLS. The 60s hang is therefore **after** `app.init()`, in the e2e's own `beforeAll` seeding:
`tenant-isolation.e2e.test.ts:198-204` does a **raw `getPool().query('insert into hr_platform.tenants …')`**.
Because `createTenantBoundPool` mutates the **shared singleton** pool's `connect`, that raw seeding (and the
later raw `insert into hr_core.workers`) runs through the tenant-binding wrapper with **no request tenant**
→ GUC = nil → the write misbehaves under RLS and the harness stalls.

Corrected conclusions:
1. **The application runs under RLS** — boot is not a blocker (earlier "app-side boot hang" was a misread of
   the e2e harness, not the app).
2. The real remaining production work is narrower than feared and is **runtime, not boot**:
   - **Background workers** (outbox dispatcher, inbox recovery, scheduler, tenant onboarding) operate
     cross-tenant and must use the `hcm_system` BYPASSRLS pool (`SYSTEM_DATABASE_URL` → `getSystemPool()`).
   - The real-DB **e2e harness** must seed through a request/tenant context (or via the admin/`hcm_system`
     role), not a raw `getPool().query`, to be runnable under RLS.
3. Caveat to revisit: the wrapper mutating the **shared singleton** pool means raw `getPool()` consumers are
   silently tenant-bound once any Kysely instance is created with the flag on. For the app that is intended;
   for tests/tools that expect raw access it is surprising — consider a dedicated bound pool rather than
   in-place mutation when activating.

Until then the policy migration stays **staged in `infra/rls/`** (not in `infra/migrations/`); the app keeps
connecting as the superuser `hcm_admin`, which bypasses RLS, so nothing is enforced in normal operation yet —
the proof above shows it *works* once the connection is flipped.

---

## 1. Why app-layer isolation isn't enough today

Tenant isolation currently relies entirely on `TenantFilterPlugin` (`packages/hr-database/src/plugins/tenant-plugin.ts`):

- It rewrites `SELECT`/`UPDATE`/`DELETE` to append `tenant_id = <ALS tenant>`.
- **Gaps:** it does **not** touch `INSERT` (nothing stops writing a row with another tenant's id), it is bypassed by any raw SQL / `sql\`\`` fragment, and it **silently no-ops when the ALS tenant is unset** (`if (!tenantId) return node;`). Schema-qualified table names (`hr_ai.hr_ai_use_cases`) and joined tables are also not uniformly covered.
- Correctness depends on every repo using the plugin-enabled Kysely instance and every query carrying a tenant. The audit already found repos (hr-ai-governance) querying by id with no tenant filter at all.

RLS moves the guarantee into Postgres: even a hand-written `SELECT * FROM hr_er.disciplinary_actions` returns only the current tenant's rows.

---

## 2. The core challenge: binding tenant to the connection

RLS policies read a per-session GUC, e.g. `current_setting('app.current_tenant')`. That value must be set **on the same physical connection that runs the query**. Two facts make this non-trivial here:

1. **Shared pool, no per-request connection.** `getPool()` returns one `pg.Pool` (max 20). Kysely checks out a connection per query and returns it. Two queries in one HTTP request may use two different connections.
2. **Repos don't use transactions.** Most repos run standalone queries, so `SET LOCAL` (which is transaction-scoped) wouldn't persist to the next query.

### Options considered

| Option | How | Pros | Cons |
|---|---|---|---|
| **A. Set GUC on connection checkout (recommended)** | Wrap the pool so every connection acquisition runs `SELECT set_config('app.current_tenant', $tenant, false)` from the ALS tenant, and `RESET app.current_tenant` on release. | No repo changes; covers single queries; works with the existing non-transactional repos. | Must guarantee reset-on-release so a pooled connection never carries a stale tenant; needs a custom Kysely driver/connection wrapper. |
| **B. Transaction-per-request with `SET LOCAL`** | Wrap each request's DB work in one transaction; `SET LOCAL app.current_tenant` at the start. | Clean, auto-resets at tx end. | Requires routing all repo work through one request-scoped transaction — large refactor of repo/connection wiring. |
| **C. `SET LOCAL` per query inside an implicit tx** | Each Kysely query wrapped in a tx that first sets the GUC. | Localized. | Doubles round-trips per query; invasive. |

**Recommendation: Option A** — lowest blast radius, no repo rewrites, matches the existing ALS model. Implement as a custom connection provider in `@hcm/database` that decorates the pool used by `createKyselyInstance`.

---

## 3. Implementation steps

### Phase A — Database role & GUC (migration, no behavior change yet)
1. Add migration creating a non-superuser app role (or confirm the app connects as one) — **RLS does not apply to table owners / superusers / `BYPASSRLS`**, so the runtime must connect as a restricted role.
2. Establish the GUC convention `app.current_tenant` (custom GUC needs no declaration; `set_config` works directly).

### Phase B — Connection tenant binding (`@hcm/database`)
3. Add a `tenant-aware-pool` wrapper: on connection acquire, read `getCurrentTenantId()` from ALS and issue `set_config('app.current_tenant', <uuid>, false)`; on release, `RESET app.current_tenant` (and never return a connection to the pool with the GUC still set).
4. If ALS tenant is **unset**, set the GUC to a sentinel (`'00000000-...-000000000000'`) that matches no rows — fail-closed, never fail-open. Provide an explicit escape hatch (`runWithoutTenant`/system role) for genuinely cross-tenant jobs (migrations, tenant onboarding, outbox dispatcher) so they don't silently break.
5. Keep `TenantFilterPlugin` for now (belt-and-suspenders); plan its eventual removal once RLS is proven.

### Phase C — Policies per table (migration)
6. For every tenant-scoped table in the `hr_*` schemas (enumerate from `infra/migrations` — ~all tables with a `tenant_id` column; exempt the `tenants`/platform-global tables already in `TENANT_EXEMPT_TABLES`):
   ```sql
   ALTER TABLE <schema>.<table> ENABLE ROW LEVEL SECURITY;
   ALTER TABLE <schema>.<table> FORCE ROW LEVEL SECURITY; -- also applies to table owner
   CREATE POLICY tenant_isolation ON <schema>.<table>
     USING (tenant_id = current_setting('app.current_tenant')::uuid)
     WITH CHECK (tenant_id = current_setting('app.current_tenant')::uuid);
   ```
   `USING` filters reads/updates/deletes; `WITH CHECK` blocks INSERT/UPDATE of rows for a different tenant (closes the INSERT gap).
7. Generate this migration programmatically by scanning information_schema for `hr_*` tables having a `tenant_id` column, to avoid missing any of the ~69-migration surface.

### Phase D — Verification
8. Integration tests (real Postgres): with tenant A's GUC set, queries never return tenant B rows; an INSERT with tenant B's id is rejected; raw SQL is also constrained; the unset-tenant sentinel returns zero rows.
9. Load/soak check that connection-release reset prevents tenant bleed under pool churn (the highest-risk failure mode).
10. Smoke the system-role escape hatch for outbox dispatcher, scheduler, and migrations.

---

## 4. Rollout & rollback

- **Staged:** ship Phase B (connection binding) first behind a flag (`DB_RLS_ENABLED`) with policies created but `ENABLE`/`FORCE` gated, so we can enable per-environment.
- **Canary:** enable on staging, run the full integration suite + manual cross-tenant probes, watch for empty-result regressions (the signature of a missing GUC set).
- **Rollback:** `DISABLE ROW LEVEL SECURITY` per table (or drop policies) — instant revert; the connection wrapper is a no-op when policies are absent.

## 5. Risks & mitigations

| Risk | Mitigation |
|---|---|
| Pooled connection returned with stale tenant → cross-tenant bleed | RESET on release + assertion test under churn; consider `DISCARD ALL` on release. |
| App connects as owner/superuser → RLS silently ignored | `FORCE ROW LEVEL SECURITY` + verify runtime DB role is non-owner, non-`BYPASSRLS`. |
| Background jobs (outbox, scheduler) have no request tenant → queries return nothing | Explicit system-role / `runWithoutTenant` escape hatch with `BYPASSRLS` or a dedicated policy. |
| Missed tables (no policy) remain app-layer-only | Programmatic policy generation from information_schema; CI check that every `tenant_id` table has RLS enabled. |
| Extra round-trip per checkout (set_config) | Negligible vs. query cost; measured in Phase D. |

## 6. Estimated effort
~2–4 days: 0.5d role/GUC, 1d connection wrapper + escape hatch, 0.5d policy-generation migration, 1–2d integration tests + staging canary.

## 7. Implementation status (2026-06-20)
- **Decision #2 answered:** the app connects as **`hcm_admin` (= `POSTGRES_USER`), a superuser** (`.env`, `deploy/docker-compose.production.yml`). Superusers **bypass RLS even with FORCE** — so a restricted role is a hard prerequisite. Provisioning template added: `infra/rls/provision-app-role.sql` (creates `hcm_app` + optional `hcm_system` BYPASSRLS).
- **Option A built (flag-gated, default off):** connection wrapper `packages/hr-database/src/connection/rls-pool.ts` binds `app.current_tenant` per checkout, resets/discards on release, fail-closed to nil UUID. Wired into `createKyselyInstance`; inert unless `DB_RLS_ENABLED=true`. Unit-tested (`rls-pool.test.ts`, 6 tests).
- **Policy migration staged (not auto-applied):** `infra/rls/enable-tenant-rls.js` dynamically enables + FORCEs RLS and creates `tenant_isolation` on every `hr_*` table with a `tenant_id` column. Lives outside `infra/migrations/` so it activates only by deliberate move. See `infra/rls/README.md` for the ordered activation sequence + rollback.

### Remaining (operationally coordinated — needs go-ahead)
1. Run `provision-app-role.sql` on staging (sets the role password).
2. Set `DB_RLS_ENABLED=true`, apply the policy migration, switch `DATABASE_URL` to `hcm_app`.
3. Real-Postgres integration tests (cross-tenant probes, INSERT WITH CHECK, system-role escape hatch) — can't run in this environment.
4. Decide escape-hatch mechanism for outbox dispatcher/scheduler: dedicated `hcm_system` BYPASSRLS role (template provided) vs. permissive system-GUC policy.
