#########################
# Environment Variables
#########################

variable "environment_name" {}
variable "environment_type" {}

variable "global_prefix" {}

#########################
# AWS Variables
#########################

variable "aws_account_id" {}
variable "aws_access_key" {}
variable "aws_secret_key" {}
variable "aws_region" {}

#########################
# Azure Variables
#########################

variable "azure_location" {}
variable "azure_account_id" {}
variable "azure_subscription_key" {}
variable "azure_api_url" {}

#########################
# Google Variables
#########################

variable "google_service_credentials_file" {}
variable "google_bucket_name" {}

#########################
# Enable/Disable ECS
#########################
variable "ecs_enabled" {
  type = bool
}
