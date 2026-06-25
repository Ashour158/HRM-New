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

### Remaining blocker before flipping the app to `hcm_app`
Booting the full Nest app as `hcm_app` with `DB_RLS_ENABLED=true` hangs in startup: boot-time / background
queries that run **without a request tenant** fail-closed (or need privileges) under RLS. To activate the
app connection (not just the policies), still required:
1. Route background workers (outbox dispatcher, scheduler, inbox recovery, tenant onboarding) through the
   `hcm_system` BYPASSRLS role (separate pool), since they legitimately operate cross-tenant.
2. Audit boot-path / global reads for tenant-less queries; make them tolerate empty results or run as `hcm_system`.
3. Then: `DB_RLS_ENABLED=true` + `DATABASE_URL` → `hcm_app`, keep migrations/seed on the admin role.

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
