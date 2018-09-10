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
variable "aws_instance_type" {}
variable "aws_instance_count" {}

#########################
# Storage Variables
#########################

variable "upload_bucket" {}
variable "temp_bucket" {}
variable "repository_bucket" {}
variable "website_bucket" {}

#########################
# Azure Variables
#########################

variable "azure_location" {}
variable "azure_account_id" {}
variable "azure_subscription_key" {}
variable "azure_api_url" {}
