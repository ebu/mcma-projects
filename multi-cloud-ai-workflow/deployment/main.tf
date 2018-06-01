#########################################################
# Deployment Variables
#
# Create a file named terraform.tfvars in same directory
# add these parameters to the file
#
#### Environment Variables ###
#
# environment_name = "something unique to identify your deployment e.g. your domain name"
# environment_type = "dev/test/prod/or as you wish"
#
#### AWS Variables ###
#
# aws_account_id = "my AWS account id (get it from AWS console under account info)"
# aws_access_key = "my aws access key"
# aws_secret_key  = "my aws secret key"
# aws_region = "us-east-X"
#
#########################################################

#########################
# Environment Variables
#########################

variable "environment_name" {
  default = "org.your-domain.mcma"
}

variable "environment_type" {
  default = "dev"
}

#########################
# Environment Variables
#########################

variable "aws_account_id" {
  default = "ACCOUNT ID"
}

variable "aws_access_key" {
  default = "ACCESS KEY"
}

variable "aws_secret_key" {
  default = "SECRET KEY"
}

variable "aws_region" {
  default = "REGION"
}

#########################
# Module registration 
# Run a terraform get on each module before executing this script
#########################

module "storage" {
  source = "./storage"

  environment_name = "${var.environment_name}"
  environment_type = "${var.environment_type}"

  aws_account_id = "${var.aws_account_id}"
  aws_access_key = "${var.aws_access_key}"
  aws_secret_key = "${var.aws_secret_key}"
  aws_region     = "${var.aws_region}"
}
