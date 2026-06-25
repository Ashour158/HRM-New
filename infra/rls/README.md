# Tenant Row-Level Security (RLS) — activation kit

Defense-in-depth multi-tenancy enforced by Postgres. See the design rationale in
[`docs/RLS-ROLLOUT-PLAN.md`](../../docs/RLS-ROLLOUT-PLAN.md).

The **policy migration is now in the auto-run chain**
(`infra/migrations/20260625000002000_enable_tenant_rls.js`), so RLS policies exist in
every environment. They are **inert until activated**: with the default superuser
connection (`hcm_admin`) RLS is bypassed; enforcement turns on only when the app
connects as the non-superuser `hcm_app` AND `DB_RLS_ENABLED=true`. A boot-time guard
(`apps/hr-api/src/config/rls-runtime-check.ts`) fails fast if `DB_RLS_ENABLED=true`
while the request role is superuser/BYPASSRLS or `SYSTEM_DATABASE_URL` is unset.

## What ships already
- Policy migration in `infra/migrations/` — `tenant_isolation` on every `tenant_id`
  table (any non-system schema); applied by the normal migration run.
- `packages/hr-database/src/connection/rls-pool.ts` — connection wrapper binding
  `app.current_tenant` per checkout. **Gated by `DB_RLS_ENABLED` (default off).**
- `getSystemPool()` / `SYSTEM_DATABASE_URL` — BYPASSRLS pool for cross-tenant workers.

## Activation sequence (per environment)
1. **Provision roles:** run `provision-app-role.sql` as a superuser (creates `hcm_app`
   + `hcm_system`, grants both). Set a real password via `-v app_password=...`.
2. Set `DB_RLS_ENABLED=true`, `DATABASE_URL`→`hcm_app`, `SYSTEM_DATABASE_URL`→`hcm_system`.
   Keep the migration runner / seed on the admin role.
3. Boot — the runtime guard verifies the role is non-superuser; the app fails to start
   on misconfiguration.
4. **Verify:** cross-tenant probes return zero rows; foreign-tenant INSERT rejected by
   `WITH CHECK`; background jobs still function via the system role.

## Rollback
Set `DB_RLS_ENABLED=false` (+ revert `DATABASE_URL` to a bypass role): the wrapper goes
inert and the superuser connection bypasses the still-present policies — immediate and
safe. To remove policies entirely, run the migration's `down`.

## Notes
- `TenantFilterPlugin` (app-layer WHERE rewriting) stays in place as belt-and-suspenders
  until RLS is proven in production, then can be retired.
- Add a CI check that every new `tenant_id` table is covered by the policy loop.
