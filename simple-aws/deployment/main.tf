#########################
# Provider registration 
#########################

provider "aws" {
  version = "~> 2.7"

  access_key = var.aws_access_key
  secret_key = var.aws_secret_key
  region     = var.aws_region
}

module "services" {
  source = "./services"

  environment_name = var.environment_name
  environment_type = var.environment_type
  global_prefix    = var.global_prefix

  aws_account_id = var.aws_account_id
  aws_region     = var.aws_region
}

module "storage" {
  source = "./storage"

  environment_name = var.environment_name
  environment_type = var.environment_type

  aws_account_id = var.aws_account_id
  aws_region     = var.aws_region
}
