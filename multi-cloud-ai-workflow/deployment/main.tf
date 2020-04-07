#########################
# Provider registration 
#########################

provider "aws" {
  version = "~> 2.7"

  access_key = var.aws_access_key
  secret_key = var.aws_secret_key
  region     = var.aws_region
}

#########################
# Module registration 
# Run a terraform get on each module before executing this script
#########################

module "cognito" {
  source = "./cognito"

  global_prefix = var.global_prefix
  aws_region    = var.aws_region
}

module "storage" {
  source = "./storage"

  environment_name = var.environment_name
  environment_type = var.environment_type

  aws_account_id = var.aws_account_id
  aws_region     = var.aws_region
}

module "services" {
  source = "./services"

  environment_name = var.environment_name
  environment_type = var.environment_type
  global_prefix    = var.global_prefix

  config_bucket = module.storage.config_bucket

  conform_workflow_id = module.workflows.conform_workflow_id
  ai_workflow_id      = module.workflows.ai_workflow_id

  aws_account_id = var.aws_account_id
  aws_region     = var.aws_region

  azure_location         = var.azure_location
  azure_account_id       = var.azure_account_id
  azure_subscription_key = var.azure_subscription_key
  azure_api_url          = var.azure_api_url

  google_bucket_name              = var.google_bucket_name
  google_service_credentials_file = var.google_service_credentials_file

  ecs_cluster_name = module.ecs.cluster_name
  ecs_benchmarkstt_service_name = module.ecs.benchmarkstt_service_name
}

module "workflows" {
  source = "./workflows"

  global_prefix    = var.global_prefix
  environment_type = var.environment_type

  aws_account_id = var.aws_account_id
  aws_region     = var.aws_region

  services_url               = module.services.services_url
  service_registry_auth_type = module.services.service_registry_auth_type

  repository_bucket_name = module.storage.repository_bucket.id
  temp_bucket_name       = module.storage.temp_bucket.id
  website_bucket_name    = module.storage.website_bucket.id
}

module "ecs" {
  source = "./ecs"

  global_prefix = var.global_prefix
  aws_region    = var.aws_region

  log_group = module.monitoring.log_group
}

module "monitoring" {
  source = "./monitoring"

  global_prefix = var.global_prefix

  aws_region = var.aws_region
}
