resource "aws_iam_role" "iam_for_exec_lambda" {
  name               = "${format("%.64s", "${var.global_prefix}.${var.aws_region}.services.lambda_exec_role")}"
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

resource "aws_iam_policy" "DynamoDB_policy" {
  name        = "${var.global_prefix}.${var.aws_region}.services.policy_dynamodb"
  description = "Policy to Access DynamoDB"
  policy      = "${file("policies/lambda-allow-dynamodb-access.json")}"
}

resource "aws_iam_role_policy_attachment" "role-policy-DynamoDB" {
  role       = "${aws_iam_role.iam_for_exec_lambda.name}"
  policy_arn = "${aws_iam_policy.DynamoDB_policy.arn}"
}

resource "aws_iam_policy" "APIGateway_policy" {
  name        = "${var.global_prefix}.${var.aws_region}.services.policy_apigateway"
  description = "Policy to access APIGateway endpoints secured with AWS_IAM authentication"
  policy      = "${file("policies/lambda-allow-apigateway-access.json")}"
}

resource "aws_iam_role_policy_attachment" "role-policy-api-gateway" {
  role       = "${aws_iam_role.iam_for_exec_lambda.name}"
  policy_arn = "${aws_iam_policy.APIGateway_policy.arn}"
}

resource "aws_iam_role_policy_attachment" "role-policy-lambda-full-access" {
  role       = "${aws_iam_role.iam_for_exec_lambda.name}"
  policy_arn = "arn:aws:iam::aws:policy/AWSLambdaFullAccess"
}

resource "aws_iam_policy" "steps_policy" {
  name        = "${var.global_prefix}.${var.aws_region}.services.policy_steps"
  description = "Policy to allow lambda functions manage step functions"
  policy      = "${file("policies/lambda-allow-steps-access.json")}"
}

resource "aws_iam_role_policy_attachment" "role-policy-steps" {
  role       = "${aws_iam_role.iam_for_exec_lambda.name}"
  policy_arn = "${aws_iam_policy.steps_policy.arn}"
}

resource "aws_iam_role_policy_attachment" "role-policy-amazon-transcribe-full-access" {
  role       = "${aws_iam_role.iam_for_exec_lambda.name}"
  policy_arn = "arn:aws:iam::aws:policy/AmazonTranscribeFullAccess"
}

resource "aws_iam_role_policy_attachment" "role-policy-amazon-translate-read-only" {
  role       = "${aws_iam_role.iam_for_exec_lambda.name}"
  policy_arn = "arn:aws:iam::aws:policy/TranslateReadOnly"
}
