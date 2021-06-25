output "config_bucket" {
  value = aws_s3_bucket.config
}

output "upload_bucket" {
  value = aws_s3_bucket.upload
}

output "repository_bucket" {
  value = aws_s3_bucket.media_repo
}

output "temp_bucket" {
  value = aws_s3_bucket.temp
}

output "website_bucket" {
  value = aws_s3_bucket.website
}

output "website_url" {
  value = "https://${aws_s3_bucket.website.bucket}.s3-${var.aws_region != "us-east-1" ? var.aws_region : ""}.amazonaws.com/index.html"
}
