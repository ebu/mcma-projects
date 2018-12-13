variable "global_prefix" {}
variable "upload_bucket" {}
variable "temp_bucket" {}
variable "repository_bucket" {}
variable "website_bucket" {}
variable "conform_workflow_id" {}
variable "ai_workflow_id" {}

variable "ec2_transform_service_hostname" {
  default = "localhost"
}

variable "aws_account_id" {}
variable "aws_access_key" {}
variable "aws_secret_key" {}
variable "aws_region" {}
variable "environment_name" {}
variable "environment_type" {}
variable "azure_location" {}
variable "azure_account_id" {}
variable "azure_subscription_key" {}
variable "azure_api_url" {}
