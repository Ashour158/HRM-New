# ---------------------------------------------------------------------------
# Account-specific values (no default — must come from a real terraform.tfvars
# that YOU create from terraform.tfvars.example; never commit real values here).
# ---------------------------------------------------------------------------

variable "aws_region" {
  description = "AWS region to deploy into, e.g. \"us-east-1\". No default on purpose — pick the region your org actually operates in."
  type        = string
}

variable "aws_account_id" {
  description = "12-digit AWS account id this configuration deploys into. Used only for tagging/auditing (e.g. confirming `terraform apply` is pointed at the right account) — never interpolated into a secret."
  type        = string

  validation {
    condition     = can(regex("^[0-9]{12}$", var.aws_account_id))
    error_message = "aws_account_id must be a 12-digit AWS account id."
  }
}

# ---------------------------------------------------------------------------
# Naming / tagging
# ---------------------------------------------------------------------------

variable "project_name" {
  description = "Short name used as a prefix for every resource this configuration creates."
  type        = string
  default     = "hcm-platform"
}

variable "environment" {
  description = "Environment tag, e.g. production/staging."
  type        = string
  default     = "production"
}

# ---------------------------------------------------------------------------
# Networking (VPC) — minimal inline resources, not a separate module; see vpc.tf.
# ---------------------------------------------------------------------------

variable "vpc_cidr" {
  description = "CIDR block for the VPC. EXAMPLE VALUE ONLY — pick a range that does not collide with any network this VPC will ever be peered with or connected to over VPN/Direct Connect."
  type        = string
  default     = "10.42.0.0/16"
}

variable "az_count" {
  description = "Number of availability zones to spread public/private subnets across."
  type        = number
  default     = 2

  validation {
    condition     = var.az_count >= 2
    error_message = "az_count must be at least 2 for a highly-available control plane and RDS subnet group."
  }
}

variable "single_nat_gateway" {
  description = "Use a single shared NAT Gateway (cheaper) instead of one per AZ (more resilient, ~2x NAT cost). Reconsider for production."
  type        = bool
  default     = true
}

# ---------------------------------------------------------------------------
# EKS
# ---------------------------------------------------------------------------

variable "cluster_name" {
  description = "EKS cluster name."
  type        = string
  default     = "hcm-platform-eks"
}

variable "kubernetes_version" {
  description = "EKS Kubernetes minor version."
  type        = string
  default     = "1.31"
}

variable "eks_public_endpoint_enabled" {
  description = "Whether the EKS API server endpoint is reachable from the public internet (still IAM/RBAC gated). Set false + rely on endpoint_private_access + a VPN/bastion for a stricter posture."
  type        = bool
  default     = true
}

variable "eks_public_access_cidrs" {
  description = "CIDR blocks allowed to reach the public EKS API endpoint when eks_public_endpoint_enabled is true. DEFAULT IS INTENTIONALLY OPEN — narrow this to your office/VPN/CI runner CIDRs before applying for real."
  type        = list(string)
  default     = ["0.0.0.0/0"]
}

variable "node_instance_types" {
  description = "EC2 instance types for the default managed node group."
  type        = list(string)
  default     = ["m6i.large"]
}

variable "node_capacity_type" {
  description = "ON_DEMAND or SPOT for the default managed node group."
  type        = string
  default     = "ON_DEMAND"

  validation {
    condition     = contains(["ON_DEMAND", "SPOT"], var.node_capacity_type)
    error_message = "node_capacity_type must be ON_DEMAND or SPOT."
  }
}

variable "node_desired_size" {
  description = "Desired worker node count. Ignored after first apply (autoscaler/HPA-adjacent tooling owns it) — see the lifecycle.ignore_changes on aws_eks_node_group.main."
  type        = number
  default     = 3
}

variable "node_min_size" {
  type    = number
  default = 2
}

variable "node_max_size" {
  type    = number
  default = 6
}

# ---------------------------------------------------------------------------
# RDS PostgreSQL (PITR via native automated backups — docs/postgres-pitr.md Option A)
# ---------------------------------------------------------------------------

variable "postgres_engine_version" {
  description = "RDS PostgreSQL engine version."
  type        = string
  default     = "15.8"
}

variable "db_parameter_group_family" {
  description = "Parameter group family matching postgres_engine_version's major version."
  type        = string
  default     = "postgres15"
}

variable "db_instance_class" {
  description = "RDS instance class. Must be sized to support at least (hpa maxReplicas x per-pod DB pool budget) connections — see the worst-case-connections comment in deploy/k8s/base/configmap.yaml (currently 10 x 8 = 80) plus headroom for the migration job and psql/restore-drill access."
  type        = string
  default     = "db.r6g.large"
}

variable "db_allocated_storage_gb" {
  description = "Initial allocated storage, GiB."
  type        = number
  default     = 100
}

variable "db_max_allocated_storage_gb" {
  description = "Ceiling for RDS storage autoscaling, GiB."
  type        = number
  default     = 500
}

variable "db_name" {
  description = "Default database name. Matches the `hcm_platform` database referenced in deploy/k8s/base/secret.example.yaml."
  type        = string
  default     = "hcm_platform"
}

variable "db_master_username" {
  description = "RDS bootstrap superuser username. This is NOT the application role — it is used exactly once, manually, to run infra/rls/provision-app-role.sql and create the restricted hcm_app/hcm_system roles referenced by deploy/k8s/base/secret.example.yaml. It must never itself be put in the app's K8s secret."
  type        = string
  default     = "hcm_master"
}

variable "db_backup_retention_days" {
  description = "Automated backup retention window, days. This is what gives RDS its native PITR capability (docs/postgres-pitr.md Option A) — the 15-minute RPO target in docs/disaster-recovery.md depends on this being > 0."
  type        = number
  default     = 7

  validation {
    condition     = var.db_backup_retention_days >= 1 && var.db_backup_retention_days <= 35
    error_message = "db_backup_retention_days must be between 1 and 35 (RDS maximum)."
  }
}

variable "db_backup_window" {
  description = "Preferred daily backup window (UTC), \"hh24:mi-hh24:mi\"."
  type        = string
  default     = "03:00-04:00"
}

variable "db_maintenance_window" {
  description = "Preferred weekly maintenance window (UTC), \"ddd:hh24:mi-ddd:hh24:mi\"."
  type        = string
  default     = "mon:04:30-mon:05:30"
}

variable "db_multi_az" {
  description = "Enable RDS Multi-AZ standby (synchronous replica, automatic failover). Roughly doubles compute+storage cost. Configurable per the task requirement — default false for the scaffold; set true for a real production cutover."
  type        = bool
  default     = false
}

variable "db_deletion_protection" {
  description = "RDS deletion protection. Keep true for any real production instance."
  type        = bool
  default     = true
}

variable "db_skip_final_snapshot" {
  description = "Skip the final snapshot on destroy. Keep false for production — only useful for throwaway/dev applies of this same configuration."
  type        = bool
  default     = false
}

# ---------------------------------------------------------------------------
# AWS Budgets — account-level cost guardrail (deploy/observability/* covers
# in-cluster cost signals; this covers the account/billing layer).
# ---------------------------------------------------------------------------

variable "monthly_budget_limit_usd" {
  description = "PLACEHOLDER monthly spend ceiling in USD for the account-level budget alert. Replace with your real expected monthly AWS spend before applying."
  type        = number
  default     = 500
}

variable "budget_alert_emails" {
  description = "PLACEHOLDER notification email(s) for budget alerts. Replace before applying — this default is not a real inbox."
  type        = list(string)
  default     = ["REPLACE_ME_billing-alerts@example.com"]
}

variable "budget_alert_sns_topic_arn" {
  description = "Optional PLACEHOLDER SNS topic ARN for budget alerts (e.g. to fan out to PagerDuty/Slack via a subscription). Leave empty to notify by email only."
  type        = string
  default     = ""
}
