# HRM Nexus Disaster Recovery

This runbook defines the minimum backup, restore, and disaster recovery evidence required before production release or emergency recovery.

## Recovery Targets

- PostgreSQL RPO: 15 minutes for production point-in-time recovery.
- PostgreSQL RTO: 4 hours for restoring the core HR, payroll, policy, audit, and access-control data paths.
- Redis and Redpanda are recoverable runtime infrastructure. PostgreSQL remains the system of record for HR truth, audit, outbox, inbox, and policy state.

## Backup Policy

- Take an encrypted PostgreSQL base backup before every production release and before running the Kubernetes migration job.
- Keep continuous WAL archiving enabled for point-in-time restore.
- Store backups in a separate account or project from the Kubernetes cluster.
- Retain at least 35 days of daily backups and 7 days of WAL logs, unless a legal hold requires longer retention.
- Record backup id, timestamp, database version, application version, migration version, and operator in the release evidence.

## Automation (implemented)

- **Base backup:** `scripts/backup/pg-backup.mjs` (`pnpm db:backup`) — `pg_dump -Fc` to `BACKUP_DIR`
  with retention pruning. Scheduled nightly by `deploy/k8s/base/backup-cronjob.yaml` (CronJob + 20Gi PVC).
- **Restore drill:** `scripts/backup/pg-restore-drill.mjs` (`pnpm db:restore-drill`) — restores the
  backup into a throwaway scratch DB and asserts integrity (hr_* table count + migrations), exits non-zero
  on failure. **Executed manually against the live database 2026-06-25 (standalone script, run by hand
  with an admin/superuser connection): restored 168 hr_* tables + 73 migrations → PASS.** The same
  restore-and-verify logic is also scheduled weekly, in-cluster, by
  `deploy/k8s/base/restore-drill-cronjob.yaml`, but that CronJob automation is newer (it authenticates as
  the RLS-restricted `hcm_system` role) and has not itself had a successful live run — it previously hit
  a `CREATEDB` permission gap on its `CREATE DATABASE`/`DROP DATABASE` steps, now fixed in
  `infra/rls/provision-app-role.sql`. The 2026-06-25 PASS above is evidence the backup/restore mechanics
  work; it is not evidence that the in-cluster CronJob itself has been proven — that still needs its own
  observed run once the grant fix is applied.
- **WAL archiving / PITR:** required at the Postgres/managed-service layer to meet the 15-min RPO (base
  backups alone give last-backup RPO). Concrete config — managed PITR or self-managed `wal-g`
  (`archive_command`, restore-to-timestamp) — is in [`docs/postgres-pitr.md`](postgres-pitr.md).
- **Migration rollback:** production is forward-only (expand/contract); see
  [`docs/migration-rollback-policy.md`](migration-rollback-policy.md).

## Restore Procedure

1. Freeze application writes by scaling API workers down or routing traffic to maintenance mode.
2. Provision a clean PostgreSQL instance with the same major version as production.
3. Restore the selected base backup and replay WAL to the approved recovery timestamp.
4. Start the API with the restored database and run `pnpm runtime:smoke` against the recovered API URL.
5. Verify `/api/v1/health/ready`, `/api/v1/metrics`, authentication, employee profile, policy admin, payroll preview, audit ledger, outbox, and inbox paths.
6. Re-enable traffic only after smoke checks pass and the incident commander approves the recovered state.

## Migration Rollback

Database migrations are not automatically rolled back during application rollback. If a migration causes an incident:

1. Stop the rollout and preserve logs, release version, migration version, and backup id.
2. Prefer a forward fix migration when data is valid and the platform can remain online.
3. Restore from the pre-release backup when data shape or data integrity is unsafe.
4. Document the selected rollback or restore action in the release notes and incident record.

## Restore Drills

- Run a restore drill at least quarterly and before major releases.
- Use a production-sized anonymized backup or the latest approved production backup in an isolated environment.
- Measure elapsed restore time against RTO and point-in-time loss against RPO.
- Capture evidence: backup id, restore target time, commands executed, smoke output, metrics snapshot, operator, approver, and follow-up actions.

