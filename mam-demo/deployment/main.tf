#########################
# Provider registration
#########################

provider "aws" {
  profile = var.aws_profile
  region  = var.aws_region
}

#################################
# Retrieving AWS account details
#################################
data "aws_caller_identity" "current" {}

############################################
# Cloud watch log group for central logging
############################################

resource "aws_cloudwatch_log_group" "main" {
  name = "/mcma/${var.global_prefix}"
}

#########################
# MAM service
#########################
module "service" {
  source = "../service"

  prefix = "${var.global_prefix}-mam-service"

  aws_account_id = data.aws_caller_identity.current.account_id
  aws_region     = var.aws_region

  service_registry = module.service_registry
  job_processor    = module.job_processor

  stage_name = var.environment_type

  log_group = aws_cloudwatch_log_group.main
}

#########################
# MAM Website
#########################
module "website" {
  source = "../website"

  prefix = var.global_prefix

  environment_type = var.environment_type

  aws_account_id = data.aws_caller_identity.current.account_id
  aws_region     = var.aws_region

  media_bucket = aws_s3_bucket.media
  mam_service  = module.service
}

#########################
# Service Registry Module
#########################

module "service_registry" {
  source = "https://ch-ebu-mcma-module-repository.s3.eu-central-1.amazonaws.com/ebu/service-registry/aws/0.13.27/module.zip"

  prefix = "${var.global_prefix}-service-registry"

  stage_name = var.environment_type

  aws_account_id = data.aws_caller_identity.current.account_id
  aws_region     = var.aws_region

  log_group = aws_cloudwatch_log_group.main

  services = [
    module.job_processor.service_definition,
    module.mediainfo_ame_service.service_definition,
    module.stepfunctions_workflow_service.service_definition,
  ]
}

#########################
# Job Processor Module
#########################

module "job_processor" {
  source = "https://ch-ebu-mcma-module-repository.s3.eu-central-1.amazonaws.com/ebu/job-processor/aws/0.13.27/module.zip"

  prefix = "${var.global_prefix}-job-processor"

  stage_name     = var.environment_type
  dashboard_name = var.global_prefix

  aws_account_id = data.aws_caller_identity.current.account_id
  aws_region     = var.aws_region

  service_registry = module.service_registry

  log_group = aws_cloudwatch_log_group.main
}

#########################
# Media Info AME Service
#########################

module "mediainfo_ame_service" {
  source = "https://ch-ebu-mcma-module-repository.s3.eu-central-1.amazonaws.com/ebu/mediainfo-ame-service/aws/0.0.1/module.zip"

  prefix = "${var.global_prefix}-mediainfo-ame-service"

  stage_name = var.environment_type

  aws_account_id = data.aws_caller_identity.current.account_id
  aws_region     = var.aws_region

  service_registry = module.service_registry

  log_group = aws_cloudwatch_log_group.main
}

########################################
# AWS Step Functions Workflow Service
########################################

module "stepfunctions_workflow_service" {
  source = "https://ch-ebu-mcma-module-repository.s3.eu-central-1.amazonaws.com/ebu/step-functions-workflow-service/aws/0.0.3/module.zip"

  prefix = "${var.global_prefix}-stepfunctions-workflow-service"

  stage_name = var.environment_type

  aws_account_id   = data.aws_caller_identity.current.account_id
  aws_region       = var.aws_region
  service_registry = module.service_registry
  job_processor    = module.job_processor

  log_group = aws_cloudwatch_log_group.main

  workflows = []
}
