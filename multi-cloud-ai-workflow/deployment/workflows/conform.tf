provider "aws" {
  access_key = "${var.aws_access_key}"
  secret_key = "${var.aws_secret_key}"
  region     = "${var.aws_region}"
}

#################################
#  aws_iam_role : iam_for_exec_lambda
#################################

resource "aws_iam_role" "iam_for_exec_lambda" {
  name               = "${var.global_prefix}.${var.aws_region}.conform.role_exec_lambda"
  assume_role_policy = "${file("policies/lambda-assume-role.json")}"
}

resource "aws_iam_policy" "log_policy" {
  name        = "${var.global_prefix}.${var.aws_region}.conform.policy_log"
  description = "Policy to write to log"
  policy      = "${file("policies/lambda-allow-log-write.json")}"
}

resource "aws_iam_role_policy_attachment" "role-policy-log" {
  role       = "${aws_iam_role.iam_for_exec_lambda.name}"
  policy_arn = "${aws_iam_policy.log_policy.arn}"
}

resource "aws_iam_policy" "S3_policy" {
  name        = "${var.global_prefix}.${var.aws_region}.conform.policy_s3"
  description = "Policy to access S3 bucket objects"
  policy      = "${file("policies/lambda-allow-s3-access.json")}"
}

resource "aws_iam_role_policy_attachment" "role-policy-S3" {
  role       = "${aws_iam_role.iam_for_exec_lambda.name}"
  policy_arn = "${aws_iam_policy.S3_policy.arn}"
}

resource "aws_lambda_function" "01-validate-workflow-input" {
  filename         = "./../workflows/conform/01-validate-workflow-input/dist/lambda.zip"
  function_name    = "${var.global_prefix}_${var.aws_region}-01-validate-workflow-input"
  role             = "${aws_iam_role.iam_for_exec_lambda.arn}"
  handler          = "lambda.handler"
  source_code_hash = "${base64sha256(file("./../workflows/conform/01-validate-workflow-input/dist/lambda.zip"))}"
  runtime          = "nodejs8.10"
  timeout          = "30"
  memory_size      = "256"
}
