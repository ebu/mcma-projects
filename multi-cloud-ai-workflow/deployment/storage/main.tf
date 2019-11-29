#########################
# Provider registration 
#########################

provider "template" {
    version = "~> 2.1"
}

data "template_file" "s3_authenticated_read_write_policy_upload" {
  template = file("policies/s3-authenticated-read-write.json")

  vars = {
    bucket_name = var.upload_bucket_name
    aws_account_id = var.aws_account_id
  }
}

resource "aws_s3_bucket" "upload" {
  bucket = var.upload_bucket_name
  acl    = "private"
  policy = data.template_file.s3_authenticated_read_write_policy_upload.rendered
  force_destroy = true
  cors_rule {
    allowed_headers = ["*"]
    allowed_methods = ["GET", "PUT", "POST", "DELETE"]
    allowed_origins = ["*"]
    expose_headers  = ["ETag"]
    max_age_seconds = 3000
  }
}

resource "aws_s3_bucket" "media_repo" {
  bucket = var.repository_bucket_name
  acl    = "private"
  force_destroy = true
}

resource "aws_s3_bucket" "temp" {
  bucket = var.temp_bucket_name
  acl    = "private"
  force_destroy = true
}

data "template_file" "s3_public_read_policy_website" {
  template = file("policies/s3-public-read.json")

  vars = {
    bucket_name = var.website_bucket_name
  }
}

resource "aws_s3_bucket" "website" {
  bucket = var.website_bucket_name
  acl    = "public-read"
  policy = data.template_file.s3_public_read_policy_website.rendered
  force_destroy = true

  website {
    index_document = "index.html"
  }
}
