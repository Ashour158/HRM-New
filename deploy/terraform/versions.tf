terraform {
  required_version = ">= 1.6.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }

  # Remote state is intentionally NOT configured here — this repo ships scaffolding only
  # (see docs/production-infrastructure-setup.md). Before running a real `terraform apply`,
  # configure a backend in a bucket/table you actually own, e.g.:
  #
  # backend "s3" {
  #   bucket         = "REPLACE_ME_your-terraform-state-bucket"
  #   key            = "hcm-platform/production/terraform.tfstate"
  #   region         = "REPLACE_ME_your-aws-region"
  #   dynamodb_table = "REPLACE_ME_your-terraform-lock-table"
  #   encrypt        = true
  # }
}

provider "aws" {
  region = var.aws_region

  default_tags {
    tags = local.common_tags
  }
}
