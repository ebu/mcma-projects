locals {
  website_bucket_name = "${var.global_prefix}-website-${var.aws_region}"
  media_bucket_name   = "${var.global_prefix}-media-${var.aws_region}"
}

###########
# Website
###########

resource "aws_s3_bucket" "website" {
  bucket        = local.website_bucket_name
  acl           = "public-read"
  force_destroy = true

  website {
    index_document = "index.html"
  }

  policy = jsonencode({
    Version   = "2012-10-17"
    Statement = [
      {
        Effect    = "Allow"
        Principal = "*"
        Action    = [
          "s3:GetObject"
        ]
        Resource  = [
          "arn:aws:s3:::${local.website_bucket_name}/*"
        ]
      }]
  })
}

resource "aws_s3_bucket_metric" "website" {
  name   = local.media_bucket_name
  bucket = aws_s3_bucket.website.id
}

###########
# Media
###########

resource "aws_s3_bucket" "media" {
  bucket              = local.media_bucket_name
  acl                 = "private"
  force_destroy       = true
  acceleration_status = "Enabled"

  cors_rule {
    allowed_headers = ["*"]
    allowed_methods = ["GET", "PUT", "POST", "DELETE"]
    allowed_origins = ["*"]
    expose_headers  = ["ETag"]
    max_age_seconds = 3600
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

##################
# website config
##################

resource "aws_s3_bucket_object" "config" {
  bucket           = aws_s3_bucket.website.id
  key              = "config.json"
  content_encoding = "application/json"
  content          = jsonencode({
    AwsRegion             = var.aws_region
    CognitoIdentityPoolId = aws_cognito_identity_pool.main.id
    CognitoUserPool       = {
      UserPoolId = aws_cognito_user_pool.main.id
      ClientId   = aws_cognito_user_pool_client.main.id
    }
    MediaBucket           = aws_s3_bucket.media.id
  })
}
