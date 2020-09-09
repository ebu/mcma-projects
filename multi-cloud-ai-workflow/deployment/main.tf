#########################
# Terraform configuration
#########################

terraform {
  required_version = ">= 0.12"
}

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

module "service_registry" {
  source = "https://ch-ebu-mcma-module-repository.s3.eu-central-1.amazonaws.com/ebu/service-registry/aws/0.0.3/module.zip"

  aws_account_id = var.aws_account_id
  aws_region     = var.aws_region
  log_group_name = module.monitoring.log_group.name
  module_prefix  = "${var.global_prefix}-service-registry"
  stage_name     = var.environment_type
}

module "job_processor" {
  source = "https://ch-ebu-mcma-module-repository.s3.eu-central-1.amazonaws.com/ebu/job-processor/aws/0.0.4/module.zip"

  aws_account_id = var.aws_account_id
  aws_region     = var.aws_region
  log_group_name = module.monitoring.log_group.name
  module_prefix  = "${var.global_prefix}-job-processor"
  stage_name     = var.environment_type
  dashboard_name = var.global_prefix

  service_registry = module.service_registry
}

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

  log_group          = module.monitoring.log_group
  services_url       = module.service_registry.services_url
  services_auth_type = module.service_registry.auth_type

  azure_location         = var.azure_location
  azure_account_id       = var.azure_account_id
  azure_subscription_key = var.azure_subscription_key
  azure_api_url          = var.azure_api_url

  google_bucket_name              = var.google_bucket_name
  google_service_credentials_file = var.google_service_credentials_file

  ecs_cluster_name              = module.ecs.cluster_name
  ecs_benchmarkstt_service_name = module.ecs.benchmarkstt_service_name
  vpc_private_subnet_id         = module.ecs.private_subnet_id
  vpc_default_security_group_id = module.ecs.default_security_group_id
  ecs_enabled                   = var.ecs_enabled
}

module "workflows" {
  source = "./workflows"

  global_prefix    = var.global_prefix
  environment_type = var.environment_type

  aws_account_id = var.aws_account_id
  aws_region     = var.aws_region

  log_group = module.monitoring.log_group

  services_url       = module.service_registry.services_url
  services_auth_type = module.service_registry.auth_type

  repository_bucket_name = module.storage.repository_bucket.id
  temp_bucket_name       = module.storage.temp_bucket.id
  website_bucket_name    = module.storage.website_bucket.id
}

module "ecs" {
  source = "./ecs"

  global_prefix = var.global_prefix
  aws_region    = var.aws_region

  log_group = module.monitoring.log_group

  enabled = var.ecs_enabled
}

module "monitoring" {
  source = "./monitoring"

  global_prefix = var.global_prefix

  aws_region = var.aws_region
}
