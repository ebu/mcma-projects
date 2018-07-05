provider "aws" {
  access_key = "${var.aws_access_key}"
  secret_key = "${var.aws_secret_key}"
  region     = "${var.aws_region}"
}

resource "aws_iam_role" "iam_for_exec_lambda" {
  name               = "${var.global_prefix}.${var.aws_region}.services.role_exec_lambda"
  assume_role_policy = "${file("policies/lambda-assume-role.json")}"
}

resource "aws_iam_policy" "log_policy" {
  name        = "${var.global_prefix}.${var.aws_region}.services.policy_log"
  description = "Policy to write to log"
  policy      = "${file("policies/lambda-allow-log-write.json")}"
}

resource "aws_iam_role_policy_attachment" "role-policy-log" {
  role       = "${aws_iam_role.iam_for_exec_lambda.name}"
  policy_arn = "${aws_iam_policy.log_policy.arn}"
}

resource "aws_iam_policy" "S3_policy" {
  name        = "${var.global_prefix}.${var.aws_region}.services.policy_s3"
  description = "Policy to access S3 bucket objects"
  policy      = "${file("policies/lambda-allow-s3-access.json")}"
}

resource "aws_iam_role_policy_attachment" "role-policy-S3" {
  role       = "${aws_iam_role.iam_for_exec_lambda.name}"
  policy_arn = "${aws_iam_policy.S3_policy.arn}"
}