locals {
  upload_bucket_name     = "${var.environment_name}.${var.aws_region}.${var.environment_type}.upload"
  output_bucket_name     = "${var.environment_name}.${var.aws_region}.${var.environment_type}.output"
}

resource "aws_s3_bucket" "upload" {
  bucket        = local.upload_bucket_name
  acl           = "private"
  policy        = templatefile("policies/s3-authenticated-read-write.json", {
    bucket_name    = local.upload_bucket_name
    aws_account_id = var.aws_account_id
  })
  force_destroy = true
  cors_rule {
    allowed_headers = ["*"]
    allowed_methods = ["GET", "PUT", "POST", "DELETE"]
    allowed_origins = ["*"]
    expose_headers  = ["ETag"]
    max_age_seconds = 3000
  }
}

resource "aws_s3_bucket" "output" {
  bucket        = local.output_bucket_name
  acl           = "public-read"
  policy        = templatefile("policies/s3-public-read.json", {
    bucket_name = local.output_bucket_name
  })
  force_destroy = true

  lifecycle_rule {
    id      = "Delete after 1 week"
    enabled = true

    expiration {
      days = 7
    }
  }
}
