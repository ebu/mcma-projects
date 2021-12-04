locals {
  media_bucket_name = "${var.global_prefix}-media-${var.aws_region}"
}

###########
# Media
###########

resource "aws_s3_bucket" "media" {
  bucket              = local.media_bucket_name
  acl                 = "private"
  force_destroy       = true
  acceleration_status = "Enabled"

  policy = jsonencode({
    Version   = "2012-10-17"
    Statement = [
      {
        Sid       = "DenyHttpRequests",
        Effect    = "Deny"
        Principal = "*"
        Action    = "s3:*"
        Resource  = [
          "arn:aws:s3:::${local.media_bucket_name}",
          "arn:aws:s3:::${local.media_bucket_name}/*"
        ]
        Condition = {
          Bool = {
            "aws:SecureTransport" = "false"
          }
        }
      },
      {
        Sid       = "DenyDeprecatedTlsRequests",
        Effect    = "Deny",
        Principal = "*",
        Action    = "s3:*",
        Resource  = [
          "arn:aws:s3:::${local.media_bucket_name}",
          "arn:aws:s3:::${local.media_bucket_name}/*"
        ],
        Condition = {
          NumericLessThan = {
            "s3:TlsVersion" = "1.2"
          }
        }
      }
    ]
  })

  cors_rule {
    allowed_headers = ["*"]
    allowed_methods = ["GET", "PUT", "POST", "DELETE"]
    allowed_origins = ["*"]
    expose_headers  = ["ETag"]
    max_age_seconds = 3600
  }

  server_side_encryption_configuration {
    rule {
      apply_server_side_encryption_by_default {
        sse_algorithm = "AES256"
      }
    }
  }

  lifecycle_rule {
    id      = "Delete user uploaded unprocessed files after 7 days"
    enabled = true
    prefix  = "${var.aws_region}:"

    abort_incomplete_multipart_upload_days = 1

    expiration {
      days = 7
    }
  }
}

resource "aws_s3_bucket_public_access_block" "media" {
  bucket = aws_s3_bucket.media.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_metric" "media" {
  name   = local.media_bucket_name
  bucket = aws_s3_bucket.media.id
}
