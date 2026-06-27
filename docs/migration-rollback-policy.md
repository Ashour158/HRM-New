# Database Migration & Rollback Policy

Addresses SRE-3: an application rollback does **not** automatically revert database
migrations, so schema and code can diverge during an incident. This policy makes the
safe path explicit.

## Principle: migrations are forward-only in production

Rolling an app Deployment back to a previous image does NOT run migration `down`
steps. A `down` that drops a column/table is **destructive** and can lose data written
since the migration. Therefore:

- **Default:** never auto-run `down` migrations in production. Roll *forward* with a
  corrective migration instead.
- **Backward-compatible migrations only** across a release boundary (expand/contract):
  1. *Expand* — add columns/tables/indexes, nullable or defaulted; deploy.
  2. *Migrate data* + dual-write if needed.
  3. *Contract* — remove the old shape only **after** the new code is fully rolled out
     and proven, in a later release.
  This guarantees the previous app image keeps working against the new schema, so an
  app rollback is always safe without touching the database.

## Operational rules

- The migration Job (`deploy/k8s/base/migration-job.yaml`) runs as the admin role and
  must complete **before** the new app pods roll out (it already gates the release).
- Take a base backup immediately before the migration Job (`pnpm db:backup` /
  `backup-cronjob`), and verify the latest restore drill is green
  (`pnpm db:restore-drill` / `restore-drill-cronjob`) — these are the real rollback
  path for a destructive change.
- Every migration MUST provide a `down` (for local/test reversibility and the CI
  migration round-trip), but `down` is **not** part of the production rollback runbook.
- CI runs an up→down→up round-trip (`migration-verification`) so reversibility is
  proven in non-prod; production stays forward-only.

## If a bad migration reaches production

1. Roll the **app** back to the prior image (safe — schema is backward compatible).
2. Ship a **forward** corrective migration (e.g. re-widen a constraint, restore a
   default) rather than running `down`.
3. Only if data integrity is already compromised: restore from the pre-migration base
   backup + PITR to just before the migration (see `docs/disaster-recovery.md`), which
   is a full DR event, not a routine rollback.
