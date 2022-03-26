locals {
  website_origin_id = aws_s3_bucket.website.bucket_regional_domain_name
  comment           = "${upper(var.environment_type)} - MCMA Media Asset Management Tool"
  website_url       = "https://${var.domain_name != null && var.domain_name != "" ? var.domain_name : aws_cloudfront_distribution.website.domain_name}"
}

resource "aws_cloudfront_origin_access_identity" "website" {
  comment = local.comment
}

data "aws_cloudfront_response_headers_policy" "hsts" {
  name = "Managed-SecurityHeadersPolicy"
}

resource "aws_cloudfront_distribution" "website" {
  comment = local.comment

  enabled         = true
  is_ipv6_enabled = true

  default_root_object = "index.html"

  aliases = var.domain_name != null && var.domain_name != "" ? [var.domain_name] : []

  origin {
    domain_name = aws_s3_bucket.website.bucket_regional_domain_name
    origin_id   = local.website_origin_id

    s3_origin_config {
      origin_access_identity = aws_cloudfront_origin_access_identity.website.cloudfront_access_identity_path
    }
  }

  default_cache_behavior {
    allowed_methods            = ["GET", "HEAD"]
    cached_methods             = ["GET", "HEAD"]
    target_origin_id           = local.website_origin_id
    viewer_protocol_policy     = "redirect-to-https"
    response_headers_policy_id = data.aws_cloudfront_response_headers_policy.hsts.id

    forwarded_values {
      query_string = false
      cookies {
        forward = "none"
      }
    }
  }

  restrictions {
    geo_restriction {
      restriction_type = "none"
    }
  }

  viewer_certificate {
    cloudfront_default_certificate = true
  }
}
