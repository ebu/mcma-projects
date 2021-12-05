output website {
  value = {
    url                        = module.website.website_url
    cloudfront_distribution_id = module.website.aws_cloudfront_distribution.website.id
  }
}
