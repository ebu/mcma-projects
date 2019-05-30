#########################
# Provider registration 
#########################

provider "aws" {
  version = "~> 2.7"

  access_key = "${var.aws_access_key}"
  secret_key = "${var.aws_secret_key}"
  region     = "${var.aws_region}"
}

resource "aws_s3_bucket" "temp" {
  bucket        = "${var.bucket_name}"
  acl           = "private"
  force_destroy = true
}

output "bucket_name" {
  value = "${var.bucket_name}"
}
