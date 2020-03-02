#########################
# Provider registration 
#########################

resource "aws_s3_bucket" "upload" {
  bucket        = var.upload_bucket_name
  acl           = "private"
  policy        = templatefile("policies/s3-authenticated-read-write.json", {
    bucket_name    = var.upload_bucket_name
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

resource "aws_s3_bucket" "media_repo" {
  bucket        = var.repository_bucket_name
  acl           = "private"
  force_destroy = true
}

resource "aws_s3_bucket" "temp" {
  bucket        = var.temp_bucket_name
  acl           = "private"
  force_destroy = true

  lifecycle_rule {
    id      = "cleanup-rule"
    enabled = true

    expiration {
      days = 7
    }
  }
}

resource "aws_s3_bucket" "website" {
  bucket        = var.website_bucket_name
  acl           = "public-read"
  policy        = templatefile("policies/s3-public-read.json", {
    bucket_name = var.website_bucket_name
  })
  force_destroy = true

  website {
    index_document = "index.html"
  }
}
