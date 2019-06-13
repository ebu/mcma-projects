#########################
# Provider registration 
#########################

provider "template" {
    version = "~> 2.1"
}

data "template_file" "s3_authenticated_read_write_policy_upload" {
  template = "${file("policies/s3-authenticated-read-write.json")}"

  vars = {
    bucket_name = "${var.upload_bucket}"
    aws_account_id = "${var.aws_account_id}"
  }
}

resource "aws_s3_bucket" "upload" {
  bucket = "${var.upload_bucket}"
  acl    = "private"
  policy = "${data.template_file.s3_authenticated_read_write_policy_upload.rendered}"
  force_destroy = true
  cors_rule {
    allowed_headers = ["*"]
    allowed_methods = ["GET", "PUT", "POST", "DELETE"]
    allowed_origins = ["*"]
    expose_headers  = ["ETag"]
    max_age_seconds = 3000
  }
}

resource "aws_s3_bucket" "media-repo" {
  bucket = "${var.repository_bucket}"
  acl    = "private"
  force_destroy = true
}

resource "aws_s3_bucket" "temp" {
  bucket = "${var.temp_bucket}"
  acl    = "private"
  force_destroy = true
}

data "template_file" "s3_public_read_policy_website" {
  template = "${file("policies/s3-public-read.json")}"

  vars = {
    bucket_name = "${var.website_bucket}"
  }
}

resource "aws_s3_bucket" "website" {
  bucket = "${var.website_bucket}"
  acl    = "public-read"
  policy = "${data.template_file.s3_public_read_policy_website.rendered}"
  force_destroy = true

  website {
    index_document = "index.html"
  }
}

output "upload_bucket" {
  value = "${var.upload_bucket}"
}

output "repository_bucket" {
  value = "${var.repository_bucket}"
}

output "temp_bucket" {
  value = "${var.temp_bucket}"
}

output "website_bucket" {
  value = "${var.website_bucket}"
}

output "website_url" {
  value = "https://s3${var.aws_region != "us-east-1" ? "-" : ""}${var.aws_region != "us-east-1" ? var.aws_region : ""}.amazonaws.com/${var.website_bucket}/index.html"
}
