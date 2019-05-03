/* Define our vpc */
resource "aws_vpc" "default" {
  cidr_block           = "${var.aws_vpc_cidr}"
  enable_dns_hostnames = true

  tags {
    Name = "${var.global_prefix}-vpc"
  }
}
