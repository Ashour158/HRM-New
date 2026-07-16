# RDS PostgreSQL with native automated backups + WAL-based PITR.
# This is docs/postgres-pitr.md "Option A" — chosen over self-managed wal-g (Option B)
# specifically because it needs zero application/OS-level configuration to hit the
# 15-minute RPO in docs/disaster-recovery.md: RDS continuously ships WAL in the
# background once backup_retention_period > 0, independent of pg-backup.mjs's own
# nightly logical dump (which stays in place as a second, portable recovery path).

resource "aws_kms_key" "rds" {
  description             = "Storage + master-password encryption for ${var.project_name} RDS"
  deletion_window_in_days = 30
  enable_key_rotation     = true
  tags                    = local.common_tags
}

resource "aws_db_parameter_group" "postgres" {
  name   = "${var.project_name}-${var.db_parameter_group_family}"
  family = var.db_parameter_group_family
  tags   = local.common_tags
}

resource "aws_db_instance" "postgres" {
  identifier     = "${var.project_name}-postgres"
  engine         = "postgres"
  engine_version = var.postgres_engine_version
  instance_class = var.db_instance_class

  allocated_storage     = var.db_allocated_storage_gb
  max_allocated_storage = var.db_max_allocated_storage_gb
  storage_type          = "gp3"
  storage_encrypted     = true
  kms_key_id            = aws_kms_key.rds.arn

  db_name  = var.db_name
  username = var.db_master_username
  port     = 5432

  # RDS-managed master password: Terraform never sees or stores the plaintext password.
  # It lands in a Secrets Manager secret RDS creates and owns — fetch it manually
  # (aws secretsmanager get-secret-value) to run infra/rls/provision-app-role.sql once,
  # per docs/production-infrastructure-setup.md. It is NOT the app's own credential.
  manage_master_user_password   = true
  master_user_secret_kms_key_id = aws_kms_key.rds.key_id

  db_subnet_group_name   = aws_db_subnet_group.main.name
  vpc_security_group_ids = [aws_security_group.rds.id]
  parameter_group_name   = aws_db_parameter_group.postgres.name

  multi_az = var.db_multi_az

  # --- PITR: docs/postgres-pitr.md Option A -------------------------------
  backup_retention_period  = var.db_backup_retention_days
  backup_window            = var.db_backup_window
  maintenance_window       = var.db_maintenance_window
  copy_tags_to_snapshot    = true
  delete_automated_backups = false

  deletion_protection       = var.db_deletion_protection
  skip_final_snapshot       = var.db_skip_final_snapshot
  final_snapshot_identifier = var.db_skip_final_snapshot ? null : "${var.project_name}-postgres-final-snapshot"

  enabled_cloudwatch_logs_exports = ["postgresql", "upgrade"]

  auto_minor_version_upgrade = true
  apply_immediately          = false

  tags = local.common_tags
}

# ---------------------------------------------------------------------------
# Mapping from this RDS instance to the `hcm-platform-secrets` K8s Secret
# (deploy/k8s/base/secret.example.yaml). Terraform does NOT write the K8s secret —
# this is documentation of the manual step, spelled out fully in
# docs/production-infrastructure-setup.md:
#
#   K8s secret key       Value
#   --------------------  -----------------------------------------------------------
#   DATABASE_URL          postgresql://hcm_app:<hcm_app-password>@<output.rds_endpoint>/<output.rds_db_name>
#                          hcm_app is created by infra/rls/provision-app-role.sql, run
#                          once against `output.rds_master_user_secret_arn`'s credentials.
#                          It is a non-superuser, non-BYPASSRLS role (RLS-enforced).
#   SYSTEM_DATABASE_URL   postgresql://hcm_system:<hcm_system-password>@<output.rds_endpoint>/<output.rds_db_name>
#                          hcm_system is the BYPASSRLS role for cross-tenant background
#                          workers (outbox/inbox/scheduler) — also provisioned by the
#                          same script.
#
# The RDS master role (output.rds_master_user_secret_arn) is used exactly once for
# provisioning and is never itself placed in hcm-platform-secrets.
# ---------------------------------------------------------------------------
