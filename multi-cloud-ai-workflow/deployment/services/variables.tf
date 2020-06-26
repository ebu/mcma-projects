variable "environment_name" {}
variable "environment_type" {}
variable "global_prefix" {}

variable "config_bucket" {}

variable "conform_workflow_id" {}
variable "ai_workflow_id" {}

variable "aws_account_id" {}
variable "aws_region" {}

variable "azure_location" {}
variable "azure_account_id" {}
variable "azure_subscription_key" {}
variable "azure_api_url" {}

variable "google_bucket_name" {}
variable "google_service_credentials_file" {}

variable "ecs_cluster_name" {}
variable "ecs_benchmarkstt_service_name" {}
variable "vpc_private_subnet_id" {}
variable "vpc_default_security_group_id" {}
variable "ecs_enabled" {
  type = bool
}

variable "job_processor_default_job_timeout_in_minutes" {
  type = number
  default = 720
}
variable "job_processor_job_retention_period_in_days" {
  type = number
  default = 90
}
