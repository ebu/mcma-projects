#########################
# Provider registration 
#########################

provider "aws" {
  version = "~> 2.7"

  access_key = "${var.aws_access_key}"
  secret_key = "${var.aws_secret_key}"
  region     = "${var.aws_region}"
}

data "template_file" "s3_authenticated_read_write_policy_upload" {
  template = "${file("../../deployment/policies/s3-authenticated-read-write.json")}"

  vars = {
    bucket_name    = "${var.bucket_name}"
    aws_account_id = "${var.aws_account_id}"
  }
}

resource "aws_s3_bucket" "upload" {
  bucket        = "${var.bucket_name}"
  acl           = "private"
  policy        = "${data.template_file.s3_authenticated_read_write_policy_upload.rendered}"
  force_destroy = true

  cors_rule {
    allowed_headers = ["*"]
    allowed_methods = ["GET", "PUT", "POST", "DELETE"]
    allowed_origins = ["*"]
    expose_headers  = ["ETag"]
    max_age_seconds = 3000
  }
}

output "bucket_name" {
  value = "${var.bucket_name}"
}
