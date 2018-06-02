provider "aws" {
  access_key = "${var.aws_access_key}"
  secret_key = "${var.aws_secret_key}"
  region     = "${var.aws_region}"
}

data "template_file" "s3_public_read_write_policy_upload" {
  template = "${file("policies/s3-public-read-write.json")}"

  vars {
    bucket_name = "${var.upload_bucket}"
  }
}

resource "aws_s3_bucket" "upload" {
  bucket = "${var.upload_bucket}"
  acl    = "public-read-write"
  policy = "${data.template_file.s3_public_read_write_policy_upload.rendered}"
}

data "template_file" "s3_public_read_policy_website" {
  template = "${file("policies/s3-public-read.json")}"

  vars {
    bucket_name = "${var.website_bucket}"
  }
}

resource "aws_s3_bucket" "website" {
  bucket = "${var.website_bucket}"
  acl    = "public-read"
  policy = "${data.template_file.s3_public_read_policy_website.rendered}"

  website {
    index_document = "index.html"
  }
}

output "website_url" {
  value = "https://s3-${var.aws_region}.amazonaws.com/${var.website_bucket}/index.html"
}
