variable "environment_name" {}
variable "environment_type" {}
variable "global_prefix" {}

variable "google_cloud_project" {}
variable "google_cloud_region" {}

variable "functions_bucket" {}

variable job_processor_default_job_timeout_in_minutes {
  type = number
  default = 720
}
variable job_processor_job_retention_period_in_days {
  type = number
  default = 90
}
