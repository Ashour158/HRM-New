# PostgreSQL Continuous Archiving & Point-in-Time Recovery (PITR)

Closes the RPO gap: the nightly base backup (`scripts/backup/pg-backup.mjs` /
`backup-cronjob`) alone gives a *last-backup* RPO (up to ~24h). The 15-minute RPO in
`docs/disaster-recovery.md` requires **continuous WAL archiving**. This is configured at
the Postgres / managed-service layer, below the application.

**Status: Option A is now scaffolded in Terraform** — `deploy/terraform/rds.tf`
provisions an `aws_db_instance` (RDS PostgreSQL) with `backup_retention_period` (real
default: 7 days, `var.db_backup_retention_days`, 1-35 configurable), a defined
`backup_window`/`maintenance_window`, `storage_encrypted = true`, and `multi_az` exposed
as `var.db_multi_az`. This is code/config scaffolding only — nobody has run
`terraform apply` against a real AWS account yet; see
`docs/production-infrastructure-setup.md` for the actual go-live steps (create the AWS
account, fill in `terraform.tfvars`, run `terraform apply` with real credentials, drill a
real PITR restore, record the achieved RPO/RTO). Option B (below) was not chosen; kept
here for reference.

## Option A — managed Postgres (recommended, chosen — see deploy/terraform/rds.tf)
Cloud Postgres (RDS / Cloud SQL / Azure Flexible Server) provides PITR out of the box:
- Enable automated backups + transaction-log (WAL) archiving with ≥7-day retention.
- Set the recovery window to cover the RTO (4h) + retention policy (≥35 days base).
- RPO is then the provider's WAL flush interval (typically < 5 min) — within the 15-min target.
No application change required; verify the setting is on and record the recovery window
in the release evidence.

AWS was picked over GCP/Azure because it's what `deploy/terraform/` targets end-to-end
(EKS + RDS in the same VPC) — RDS's native automated-backup PITR satisfies this option
with zero extra moving parts (no wal-g, no S3 bucket/IAM wiring for WAL shipping). A
GCP (Cloud SQL) or Azure (Flexible Server) equivalent would need separate Terraform
modules; not built here.

## Option B — self-managed with wal-g (not chosen)
Kept for reference / as a fallback if a future environment isn't on managed Postgres.
Not chosen for the primary path because it requires operating WAL shipping (wal-g,
`archive_command`, a dedicated S3 bucket/IAM policy, restore tooling) as an ongoing
concern on top of the database itself — Option A gets the same PITR guarantee from RDS
with substantially less operational burden.
On a self-managed primary, set in `postgresql.conf`:

```
wal_level = replica
archive_mode = on
archive_timeout = 60          # force a WAL segment at least every 60s (bounds RPO)
archive_command = 'wal-g wal-push %p'
```

`wal-g` env (from a secret, NOT committed):

```
WALG_S3_PREFIX=s3://hcm-db-backups/wal      # separate bucket/account from the cluster
AWS_REGION=...
AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY    # or instance role
WALG_COMPRESSION_METHOD=lz4
WALG_DELTA_MAX_STEPS=6
```

Base backups via wal-g (complements / replaces the logical dump for PITR):
```
wal-g backup-push $PGDATA      # schedule alongside backup-cronjob
wal-g delete retain FULL 7 --confirm
```

### PITR restore (to a timestamp just before an incident)
```
wal-g backup-fetch $PGDATA LATEST
# recovery.signal + postgresql.auto.conf:
restore_command = 'wal-g wal-fetch %f %p'
recovery_target_time = '2026-06-26 13:45:00+00'
recovery_target_action = 'promote'
```
Then start Postgres, run `pnpm runtime:smoke` against the recovered API, and follow the
restore checklist in `docs/disaster-recovery.md`.

## Acceptance
- WAL archiving is ON (managed setting or `archive_command` succeeding — check
  `pg_stat_archiver`: `failed_count = 0`, `last_archived_time` recent).
- A PITR restore to an arbitrary timestamp is drilled at least quarterly and the
  achieved RPO/RTO recorded in the release evidence.
