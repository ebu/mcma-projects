###################
# Policies used by services
###################

resource "aws_iam_policy" "allow_full_logs" {
  name        = "${var.global_prefix}.${var.aws_region}.services.allow-full-logs"
  description = "Policy to write to log"
  policy      = file("policies/allow-full-logs.json")
}

resource "aws_iam_policy" "allow_full_s3" {
  name        = "${var.global_prefix}.${var.aws_region}.services.allow-full-s3"
  description = "Policy to access S3 bucket objects"
  policy      = file("policies/allow-full-s3.json")
}

resource "aws_iam_policy" "allow_full_dynamodb" {
  name        = "${var.global_prefix}.${var.aws_region}.services.allow-full-dynamodb"
  description = "Policy to Access DynamoDB"
  policy      = file("policies/allow-full-dynamodb.json")
}

resource "aws_iam_policy" "allow_full_events" {
  name        = "${var.global_prefix}.${var.aws_region}.services.allow-full-events"
  description = "Policy to allow full access to Cloudwatch Events"
  policy      = file("policies/allow-full-events.json")
}

resource "aws_iam_policy" "allow_invoke_api_gateway" {
  name        = "${var.global_prefix}.${var.aws_region}.services.allow-invoke-api-gateway"
  description = "Policy to access APIGateway endpoints secured with AWS_IAM authentication"
  policy      = file("policies/allow-invoke-api-gateway.json")
}

resource "aws_iam_policy" "allow_invoke_lambda" {
  name        = "${var.global_prefix}.${var.aws_region}.services.allow-invoke-lambda"
  path        = "/app/"
  description = "Policy to allow to invoke lambdas"
  policy      = file("policies/allow-invoke-lambda.json")
}

###################
# Lambda Role used by (most) services
###################

resource "aws_iam_role" "iam_for_exec_lambda" {
  name               = format("%.64s", "${var.global_prefix}.${var.aws_region}.services.lambda_exec_role")
  assume_role_policy = file("policies/assume-role-lambda.json")
}

resource "aws_iam_role_policy_attachment" "service_allow_full_logs" {
  role       = aws_iam_role.iam_for_exec_lambda.name
  policy_arn = aws_iam_policy.allow_full_logs.arn
}

resource "aws_iam_role_policy_attachment" "service_allow_full_s3" {
  role       = aws_iam_role.iam_for_exec_lambda.name
  policy_arn = aws_iam_policy.allow_full_s3.arn
}

resource "aws_iam_role_policy_attachment" "service_allow_full_dynamodb" {
  role       = aws_iam_role.iam_for_exec_lambda.name
  policy_arn = aws_iam_policy.allow_full_dynamodb.arn
}

resource "aws_iam_role_policy_attachment" "service_allow_invoke_api_gateway" {
  role       = aws_iam_role.iam_for_exec_lambda.name
  policy_arn = aws_iam_policy.allow_invoke_api_gateway.arn
}

resource "aws_iam_role_policy_attachment" "service_allow_invoke_lambda" {
  role       = aws_iam_role.iam_for_exec_lambda.name
  policy_arn = aws_iam_policy.allow_invoke_lambda.arn
}
