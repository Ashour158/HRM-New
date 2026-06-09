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

