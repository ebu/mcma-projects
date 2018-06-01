provider "aws" {
  access_key = "${var.aws_access_key}"
  secret_key = "${var.aws_secret_key}"
  region     = "${var.aws_region}"
}

locals {
  env_composite_name = "${var.environment_name}.${var.environment_type}"
}

resource "aws_s3_bucket" "website-bucket" {
  bucket = "${local.env_composite_name}.website"
  acl    = "private"
}
