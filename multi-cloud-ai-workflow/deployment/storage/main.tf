provider "aws" {
  access_key = "${var.aws_access_key}"
  secret_key = "${var.aws_secret_key}"
  region     = "${var.aws_region}"
}

data "template_file" "s3_public_policy" {
  template = "${file("policies/s3-public.json")}"

  vars {
    bucket_name = "${var.website_bucket}"
  }
}

resource "aws_s3_bucket" "website" {
  bucket = "${var.website_bucket}"
  acl    = "public-read"
  policy = "${data.template_file.s3_public_policy.rendered}"

  website {
    index_document = "index.html"
  }
}

output "website_url" {
  value = "https://s3-${var.aws_region}.amazonaws.com/${var.website_bucket}/index.html"
}
