# Common locals shared across vpc.tf / eks.tf / rds.tf / budgets.tf.

locals {
  common_tags = {
    Project     = var.project_name
    Environment = var.environment
    ManagedBy   = "terraform"
    AccountId   = var.aws_account_id
  }
}
