output website_url {
  value = local.website_url
}

output aws_cloudfront_distribution {
  value = {
    website = aws_cloudfront_distribution.website
  }
}

