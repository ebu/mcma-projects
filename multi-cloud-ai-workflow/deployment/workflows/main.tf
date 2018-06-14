provider "aws" {
  access_key = "${var.aws_access_key}"
  secret_key = "${var.aws_secret_key}"
  region     = "${var.aws_region}"
}

#################################
#  aws_iam_role : iam_for_exec_lambda
#################################

resource "aws_iam_role" "iam_for_exec_lambda" {
  name               = "${var.global_prefix}.${var.aws_region}.workflows.role_exec_lambda"
  assume_role_policy = "${file("policies/lambda-assume-role.json")}"
}

resource "aws_iam_policy" "log_policy" {
  name        = "${var.global_prefix}.${var.aws_region}.workflows.policy_log"
  description = "Policy to write to log"
  policy      = "${file("policies/lambda-allow-log-write.json")}"
}

resource "aws_iam_role_policy_attachment" "role-policy-log" {
  role       = "${aws_iam_role.iam_for_exec_lambda.name}"
  policy_arn = "${aws_iam_policy.log_policy.arn}"
}

resource "aws_iam_policy" "S3_policy" {
  name        = "${var.global_prefix}.${var.aws_region}.workflows.policy_s3"
  description = "Policy to access S3 bucket objects"
  policy      = "${file("policies/lambda-allow-s3-access.json")}"
}

resource "aws_iam_role_policy_attachment" "role-policy-S3" {
  role       = "${aws_iam_role.iam_for_exec_lambda.name}"
  policy_arn = "${aws_iam_policy.S3_policy.arn}"
}

data "template_file" "steps-assume-role" {
  template = "${file("policies/steps-assume-role.json")}"

  vars {
    aws_region = "${var.aws_region}"
  }
}

resource "aws_iam_role" "iam_for_state_machine_execution" {
  name               = "${var.global_prefix}.${var.aws_region}.workflows.role_exec_steps"
  assume_role_policy = "${data.template_file.steps-assume-role.rendered}"
}

resource "aws_iam_policy" "policy_steps_invoke_lambda" {
  name        = "${var.global_prefix}.${var.aws_region}.workflows.policy_steps_invoke_lambda"
  description = "Policy to execute Step Function"
  policy      = "${file("policies/steps-allow-invoke-lambda.json")}"
}

resource "aws_iam_role_policy_attachment" "role-policy-steps" {
  role       = "${aws_iam_role.iam_for_state_machine_execution.name}"
  policy_arn = "${aws_iam_policy.policy_steps_invoke_lambda.arn}"
}
