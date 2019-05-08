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
# Service Registry Variables
#########################

variable "services_url" {}
variable "services_auth_type" {}
variable "services_auth_context" {}

#########################
# Azure API Variables
#########################

variable "azure_location" {}
variable "azure_account_id" {}
variable "azure_subscription_key" {}
variable "azure_api_url" {}
