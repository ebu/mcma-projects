#########################
# Environment Variables
#########################

variable "environment_name" {}
variable "environment_type" {}

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

variable "upload_bucket" {}
variable "temp_bucket" {}
variable "repository_bucket" {}
variable "website_bucket" {}
