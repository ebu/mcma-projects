#########################
# Environment Variables
#########################

variable "name" {
  type        = string
  description = "Optional variable to set a custom name for this workflow"
  default     = "MediaIngestWorkflow"
}

variable "prefix" {
  type        = string
  description = "Prefix for all managed resources in this module"
}

variable "tags" {
  type        = map(string)
  description = "Tags applied to created resources"
  default     = {}
}

#########################
# AWS Variables
#########################

variable "aws_account_id" {
  type        = string
  description = "Account ID to which this module is deployed"
}

variable "aws_region" {
  type        = string
  description = "AWS Region to which this module is deployed"
}

variable "iam_role_path" {
  type        = string
  description = "Path for creation of access role"
  default     = "/"
}

#########################
# Logging
#########################

variable "log_group" {
  type = object({
    id   = string
    arn  = string
    name = string
  })
  description = "Log group used by MCMA Event tracking"
}

variable "xray_tracing_enabled" {
  type        = bool
  description = "Enable X-Ray tracing"
  default     = false
}

variable "enhanced_monitoring_enabled" {
  type        = bool
  description = "Enable CloudWatch Lambda Insights"
  default     = false
}

#########################
# Dependencies
#########################

variable "service_registry" {
  type = object({
    auth_type              = string,
    services_url           = string,
    aws_apigatewayv2_stage = object({
      service_api = object({
        execution_arn = string
      })
    })
  })
}

variable "job_processor" {
  type = object({
    aws_apigatewayv2_stage = object({
      service_api = object({
        execution_arn = string
      })
    })
  })
}

variable "media_bucket" {
  type = object({
    id  = string
    arn = string
  })
  description = "Media bucket for Upload and Storage"
}

variable "mam_service" {
  type = object({
    rest_api_url       = string
    aws_dynamodb_table = object({
      service_table = object({
        id  = string
        arn = string
      })
    })
  })
}
