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
# Storage Variables
#########################

variable "upload_bucket_name" {}
variable "temp_bucket_name" {}
variable "repository_bucket_name" {}
variable "website_bucket_name" {}

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

variable "google_project_id" {}
variable "google_bucket_name" {}
variable "google_client_email" {}
variable "google_private_key" {}
