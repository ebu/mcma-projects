#########################
# Module registration 
# Run a terraform get on each module before executing this script
#########################

module "storage" {
  source = "./storage"

  website_bucket = "${var.website_bucket}"

  aws_account_id = "${var.aws_account_id}"
  aws_access_key = "${var.aws_access_key}"
  aws_secret_key = "${var.aws_secret_key}"
  aws_region     = "${var.aws_region}"
}

output "website_url" {
  value = "${module.storage.website_url}"
}
