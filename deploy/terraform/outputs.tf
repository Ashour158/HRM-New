output "vpc_id" {
  description = "VPC id."
  value       = aws_vpc.main.id
}

output "private_subnet_ids" {
  description = "Private subnet ids (EKS nodes, RDS)."
  value       = aws_subnet.private[*].id
}

output "public_subnet_ids" {
  description = "Public subnet ids (NAT, any public-facing LB)."
  value       = aws_subnet.public[*].id
}

output "eks_cluster_name" {
  description = "EKS cluster name — pass to `aws eks update-kubeconfig --name <this>`."
  value       = aws_eks_cluster.main.name
}

output "eks_cluster_endpoint" {
  description = "EKS API server endpoint."
  value       = aws_eks_cluster.main.endpoint
}

output "eks_cluster_certificate_authority_data" {
  description = "Base64 CA cert for the EKS API server."
  value       = aws_eks_cluster.main.certificate_authority[0].data
  sensitive   = true
}

output "rds_endpoint" {
  description = "RDS Postgres endpoint (\"host:port\"). Combine with rds_db_name and the hcm_app/hcm_system role passwords (see infra/rls/provision-app-role.sql) to build the DATABASE_URL / SYSTEM_DATABASE_URL values for the hcm-platform-secrets K8s Secret — see the mapping comment at the bottom of rds.tf and docs/production-infrastructure-setup.md."
  value       = aws_db_instance.postgres.endpoint
}

output "rds_db_name" {
  description = "Default database name on the RDS instance."
  value       = aws_db_instance.postgres.db_name
}

output "rds_master_user_secret_arn" {
  description = "Secrets Manager ARN holding the RDS-managed master username/password. Used exactly once to provision hcm_app/hcm_system (infra/rls/provision-app-role.sql) — never placed directly in the app's own K8s secret."
  value       = try(aws_db_instance.postgres.master_user_secret[0].secret_arn, null)
}

output "rds_backup_retention_days" {
  description = "Confirms the applied automated-backup retention window that provides PITR (docs/postgres-pitr.md Option A)."
  value       = aws_db_instance.postgres.backup_retention_period
}
