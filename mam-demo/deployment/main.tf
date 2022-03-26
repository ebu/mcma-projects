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

  stage_name = var.environment_type

  aws_account_id = data.aws_caller_identity.current.account_id
  aws_region     = var.aws_region

  media_bucket = aws_s3_bucket.media
  service_registry = module.service_registry
  job_processor    = module.job_processor

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
  source = "https://ch-ebu-mcma-module-repository.s3.eu-central-1.amazonaws.com/ebu/service-registry/aws/0.13.28/module.zip"

  prefix = "${var.global_prefix}-service-registry"

  stage_name = var.environment_type

  aws_account_id = data.aws_caller_identity.current.account_id
  aws_region     = var.aws_region

  log_group = aws_cloudwatch_log_group.main

  services = [
    module.service.service_definition,
    module.job_processor.service_definition,
    module.mediainfo_ame_service.service_definition,
    module.ffmpeg_service.service_definition,
    module.stepfunctions_workflow_service.service_definition,
  ]
}

#########################
# Job Processor Module
#########################

module "job_processor" {
  source = "https://ch-ebu-mcma-module-repository.s3.eu-central-1.amazonaws.com/ebu/job-processor/aws/0.13.28/module.zip"

  prefix = "${var.global_prefix}-job-processor"

  stage_name     = var.environment_type
  dashboard_name = var.global_prefix

  aws_account_id = data.aws_caller_identity.current.account_id
  aws_region     = var.aws_region

  service_registry = module.service_registry

  log_group = aws_cloudwatch_log_group.main

  execute_api_arns = [
    "${module.service_registry.aws_apigatewayv2_api.service_api.execution_arn}/${var.environment_type}/GET/*",
    "${module.ffmpeg_service.aws_apigatewayv2_api.service_api.execution_arn}/${var.environment_type}/*/*",
    "${module.mediainfo_ame_service.aws_apigatewayv2_api.service_api.execution_arn}/${var.environment_type}/*/*",
    "${module.stepfunctions_workflow_service.aws_apigatewayv2_api.service_api.execution_arn}/${var.environment_type}/*/*",
    "${module.service.aws_apigatewayv2_api.rest_api.execution_arn}/${var.environment_type}/*/*",
  ]
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

#########################
# FFmpeg service
#########################

module "ffmpeg_service" {
  source = "https://ch-ebu-mcma-module-repository.s3.eu-central-1.amazonaws.com/ebu/ffmpeg-service/aws/0.0.1/module.zip"

  prefix = "${var.global_prefix}-ffmpeg-service"

  stage_name = var.environment_type
  aws_region = var.aws_region

  service_registry = module.service_registry
  job_processor    = module.job_processor

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

  workflows = [
    module.media_ingest_workflow.workflow_definition
  ]
}

module "media_ingest_workflow" {
  source = "../workflows/media-ingest"

  prefix = "${var.global_prefix}-wf-media-ingest"

  aws_account_id = data.aws_caller_identity.current.account_id
  aws_region     = var.aws_region

  service_registry = module.service_registry
  job_processor    = module.job_processor
  mam_service      = module.service

  media_bucket = aws_s3_bucket.media

  log_group = aws_cloudwatch_log_group.main
}
