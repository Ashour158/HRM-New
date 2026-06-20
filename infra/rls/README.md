# Tenant Row-Level Security (RLS) — activation kit

Defense-in-depth multi-tenancy enforced by Postgres. See the design rationale in
[`docs/RLS-ROLLOUT-PLAN.md`](../../docs/RLS-ROLLOUT-PLAN.md).

These files are **staged, not auto-applied**. RLS only takes effect once the app
connects as a non-superuser role AND the connection wrapper is enabled — otherwise
queries either stay unprotected (superuser bypass) or return zero rows (policies on,
GUC unset). Activation is therefore a deliberate, ordered operation.

## What ships already (safe, inert)
- `packages/hr-database/src/connection/rls-pool.ts` — connection wrapper that binds
  `app.current_tenant` per checkout and resets on release. **Gated by `DB_RLS_ENABLED`
  (default off)** — a no-op until enabled. Unit-tested in `rls-pool.test.ts`.

## Activation sequence (staging first)
1. **Provision the restricted role:** run `provision-app-role.sql` as a superuser
   (creates `hcm_app`, grants DML on `hr_*`, plus an optional `hcm_system` BYPASSRLS
   role for cross-tenant jobs). Set a real password via `-v app_password=...`.
2. **Enable the wrapper:** set `DB_RLS_ENABLED=true` in the app environment.
3. **Apply policies:** move `enable-tenant-rls.js` into `infra/migrations/` with a
   timestamp prefix (e.g. `20260620000002000_enable_tenant_rls.js`) and run migrations.
   It enables + FORCEs RLS and creates a `tenant_isolation` policy on every `hr_*`
   table with a `tenant_id` column.
4. **Switch the runtime connection:** point `DATABASE_URL` at `hcm_app`. Keep the
   migration runner / outbox dispatcher on the admin or `hcm_system` role.
5. **Verify:** cross-tenant probes return zero rows; INSERT with a foreign tenant id
   is rejected by `WITH CHECK`; background jobs still function via the system role.

## Rollback
Any of: set `DB_RLS_ENABLED=false`, revert `DATABASE_URL` to `hcm_admin`, or run the
`enable-tenant-rls.js` down migration (`DISABLE ROW LEVEL SECURITY`). The wrapper is
inert when the flag is off, so reverting is immediate.

## Notes
- `TenantFilterPlugin` (app-layer WHERE rewriting) stays in place as belt-and-suspenders
  until RLS is proven in production, then can be retired.
- Add a CI check that every new `tenant_id` table is covered by the policy loop.
