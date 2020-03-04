locals {
  config_bucket_name     = "${var.environment_name}.${var.aws_region}.${var.environment_type}.config"
  upload_bucket_name     = "${var.environment_name}.${var.aws_region}.${var.environment_type}.upload"
  temp_bucket_name       = "${var.environment_name}.${var.aws_region}.${var.environment_type}.temp"
  repository_bucket_name = "${var.environment_name}.${var.aws_region}.${var.environment_type}.repository"
  website_bucket_name    = "${var.environment_name}.${var.aws_region}.${var.environment_type}.website"
}

resource "aws_kms_key" "config" {
  description = "Key used for encrypting/decrypting files in the config bucket"
}

resource "aws_s3_bucket" "config" {
  bucket        = local.config_bucket_name
  acl           = "private"
  force_destroy = true

  server_side_encryption_configuration {
    rule {
      apply_server_side_encryption_by_default {
        kms_master_key_id = aws_kms_key.config.arn
        sse_algorithm     = "aws:kms"
      }
    }
  }
}

resource "aws_s3_bucket_public_access_block" "config" {
  bucket = aws_s3_bucket.config.id

  block_public_acls = true
  block_public_policy = true
  ignore_public_acls = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_metric" "config" {
  name   = "${local.config_bucket_name}-metrics"
  bucket = aws_s3_bucket.config.bucket
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

resource "aws_s3_bucket" "temp" {
  bucket        = local.temp_bucket_name
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

resource "aws_s3_bucket" "media_repo" {
  bucket        = local.repository_bucket_name
  acl           = "private"
  force_destroy = true
}

resource "aws_s3_bucket" "website" {
  bucket        = local.website_bucket_name
  acl           = "public-read"
  policy        = templatefile("policies/s3-public-read.json", {
    bucket_name = local.website_bucket_name
  })
  force_destroy = true

  website {
    index_document = "index.html"
  }
}
