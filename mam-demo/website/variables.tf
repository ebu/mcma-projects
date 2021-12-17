#########################
# Environment Variables
#########################

variable "prefix" {
  type        = string
  description = "Prefix for all managed resources in this module"
}

variable "environment_type" {
  type        = string
  description = "Indicating environment type"
}

variable "domain_name" {
  type        = string
  description = "Domain name that will be used for the website"
  default     = ""
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
    id = string
  })
  description = "Media bucket for Upload and Storage"
}

variable "mam_service" {
  type = object({
    rest_api_url           = string
    websocket_url          = string
    aws_apigatewayv2_stage = object({
      rest_api  = object({
        execution_arn = string
      })
      websocket = object({
        execution_arn = string
      })
    })
  })
}
