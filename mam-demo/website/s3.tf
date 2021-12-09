locals {
  website_bucket_name = "${var.prefix}-website-${var.aws_region}"
}

###########
# Website
###########

resource "aws_s3_bucket" "website" {
  bucket        = local.website_bucket_name
  acl           = "private"
  force_destroy = true

  policy = jsonencode({
    Version   = "2012-10-17"
    Statement = [
      {
        Sid       = "AllowCloudFrontAccess"
        Effect    = "Allow"
        Principal = {
          AWS = aws_cloudfront_origin_access_identity.website.iam_arn
        }
        Action    = [
          "s3:GetObject"
        ]
        Resource  = [
          "arn:aws:s3:::${local.website_bucket_name}/*"
        ]
      },
      {
        Sid       = "DenyHttpRequests",
        Effect    = "Deny"
        Principal = "*"
        Action    = "s3:*"
        Resource  = [
          "arn:aws:s3:::${local.website_bucket_name}",
          "arn:aws:s3:::${local.website_bucket_name}/*"
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
          "arn:aws:s3:::${local.website_bucket_name}",
          "arn:aws:s3:::${local.website_bucket_name}/*"
        ],
        Condition = {
          NumericLessThan = {
            "s3:TlsVersion" = "1.2"
          }
        }
      }
    ]
  })

  server_side_encryption_configuration {
    rule {
      apply_server_side_encryption_by_default {
        sse_algorithm = "AES256"
      }
    }
  }
}

resource "aws_s3_bucket_public_access_block" "website" {
  bucket = aws_s3_bucket.website.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_metric" "website" {
  name   = local.website_bucket_name
  bucket = aws_s3_bucket.website.id
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
    MediaBucket           = var.media_bucket.id
    RestApiUrl            = var.mam_service.rest_api_url
    WebSocketUrl          = var.mam_service.websocket_url
  })
}
