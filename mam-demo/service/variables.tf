##################################
# Enable optional variable attributes
##################################

terraform {
  experiments = [module_variable_optional_attrs]
}

#########################
# Environment Variables
#########################

variable "name" {
  type        = string
  description = "Optional variable to set a custom name for this service in the service registry"
  default     = "MAM Service"
}

variable "prefix" {
  type        = string
  description = "Prefix for all managed resources in this module"
}

variable "stage_name" {
  type        = string
  description = "Stage name to be used for the API Gateway deployment"
}

variable "dead_letter_config_target" {
  type        = string
  description = "Configuring dead letter target for worker lambda"
  default     = null
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

#########################
# Dependencies
#########################
variable "media_bucket" {
  type        = object({
    arn = string
  })
  description = "Media bucket for Upload and Storage"
}

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

#########################
# Logging
#########################

variable "log_group" {
  type        = object({
    id   = string
    arn  = string
    name = string
  })
  description = "Log group used by MCMA Event tracking"
}

variable "api_gateway_logging_enabled" {
  type        = bool
  description = "Enable API Gateway logging"
  default     = false
}

variable "api_gateway_metrics_enabled" {
  type        = bool
  description = "Enable API Gateway metrics"
  default     = false
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
