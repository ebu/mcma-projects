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
  value = "https://s3${var.aws_region != "us-east-1" ? "-${var.aws_region}" : ""}.amazonaws.com/${var.website_bucket_name}/index.html"
}
