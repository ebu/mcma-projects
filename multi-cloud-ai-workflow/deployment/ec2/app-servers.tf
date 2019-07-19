/* App servers */
data "template_file" "cloud_config_app_yml" {
  template = "${file("ec2/cloud-config/app.yml")}"

  vars = {
    services_url = "${var.services_url}"
    services_auth_type = "${var.services_auth_type}"
  }
}
resource "aws_instance" "app" {
  count                   = "${var.aws_instance_count}"
  ami                     = "${lookup(var.amis, var.aws_region)}"
  instance_type           = "${var.aws_instance_type}"
  subnet_id               = "${aws_subnet.private.id}"
  // we use "vpc_security_group_ids" instead of "security_groups" here to prevent destruction & recreation of the EC2 instance every time:
  // https://github.com/hashicorp/terraform/issues/7221
  vpc_security_group_ids  = ["${aws_security_group.default.id}"]
  key_name                = "${aws_key_pair.deployer.key_name}"
  source_dest_check       = false
  user_data               = "${data.template_file.cloud_config_app_yml.rendered}"
  iam_instance_profile    = "${aws_iam_instance_profile.app_iam_instance_profile.id}"

  tags = {
    Name = "${var.global_prefix}-app-${count.index}"
  }
}

resource "aws_iam_instance_profile" "app_iam_instance_profile" {
  name = "${var.global_prefix}-${var.aws_region}-iam-instance-profile"
  role = "${aws_iam_role.ec2_iam_role.id}"
}

resource "aws_iam_role" "ec2_iam_role" {
  name = "${var.global_prefix}-${var.aws_region}-ec2-iam-role"

  assume_role_policy = <<EOF
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": {
        "Service": "ec2.amazonaws.com"
      },
      "Action": "sts:AssumeRole"
    }
  ]
}
EOF
}

resource "aws_iam_role_policy" "ec2_s3_access_policy" {
  name = "${var.global_prefix}-${var.aws_region}-ec2-s3-access-policy"
  role = "${aws_iam_role.ec2_iam_role.id}"

  policy = <<EOF
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": "S3:*",
      "Resource": "*"
    }
  ]
}
EOF
}

/* Load balancer */
resource "aws_elb" "app" {
  name            = "${var.global_prefix}-elb"
  subnets         = ["${aws_subnet.public.id}"]
  security_groups = ["${aws_security_group.default.id}", "${aws_security_group.web.id}"]

  listener {
    instance_port     = 80
    instance_protocol = "http"
    lb_port           = 80
    lb_protocol       = "http"
  }

  instances = ["${aws_instance.app.*.id}"]
}
