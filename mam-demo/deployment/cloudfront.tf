locals {
  website_origin_id = "S3-Website-${aws_s3_bucket.website.bucket}.${aws_s3_bucket.website.website_domain}"
}

resource "aws_cloudfront_distribution" "website" {
  comment = "${upper(var.environment_type)} - MCMA MAM Demo"

  enabled         = true
  is_ipv6_enabled = true

  origin {
    domain_name = "${aws_s3_bucket.website.bucket}.${aws_s3_bucket.website.website_domain}"
    origin_id   = local.website_origin_id
    custom_origin_config {
      http_port              = 80
      https_port             = 443
      origin_protocol_policy = "http-only"
      origin_ssl_protocols   = ["TLSv1", "TLSv1.1", "TLSv1.2"]
    }
  }

  default_cache_behavior {
    allowed_methods        = ["GET", "HEAD"]
    cached_methods         = ["GET", "HEAD"]
    target_origin_id       = local.website_origin_id
    viewer_protocol_policy = "redirect-to-https"

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
