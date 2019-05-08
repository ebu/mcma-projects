#########################
# Provider registration 
#########################

provider "aws" {
  version = "~> 1.59"

  access_key = "${var.aws_access_key}"
  secret_key = "${var.aws_secret_key}"
  region     = "${var.aws_region}"
}

##################################
# aws_iam_role : iam_for_exec_lambda
##################################

resource "aws_iam_role" "iam_for_exec_lambda" {
  name               = "${format("%.64s", "${var.global_prefix}.${var.aws_region}.transform-service.lambda_exec_role")}"
  assume_role_policy = "${file("./../../../deployment/policies/lambda-assume-role.json")}"
}

resource "aws_iam_policy" "log_policy" {
  name        = "${var.global_prefix}.${var.aws_region}.transform-service.policy_log"
  description = "Policy to write to log"
  policy      = "${file("./../../../deployment/policies/lambda-allow-log-write.json")}"
}

resource "aws_iam_role_policy_attachment" "role-policy-log" {
  role       = "${aws_iam_role.iam_for_exec_lambda.name}"
  policy_arn = "${aws_iam_policy.log_policy.arn}"
}

resource "aws_iam_policy" "DynamoDB_policy" {
  name        = "${var.global_prefix}.${var.aws_region}.transform-service.policy_dynamodb"
  description = "Policy to Access DynamoDB"
  policy      = "${file("./../../../deployment/policies/lambda-allow-dynamodb-access.json")}"
}

resource "aws_iam_role_policy_attachment" "role-policy-DynamoDB" {
  role       = "${aws_iam_role.iam_for_exec_lambda.name}"
  policy_arn = "${aws_iam_policy.DynamoDB_policy.arn}"
}

##################################
# aws_dynamodb_table : transform_service_table
##################################

resource "aws_dynamodb_table" "transform_service_table" {
  name           = "${var.global_prefix}-transform-service"
  read_capacity  = 1
  write_capacity = 1
  hash_key       = "resource_type"
  range_key      = "resource_id"

  attribute {
    name = "resource_type"
    type = "S"
  }

  attribute {
    name = "resource_id"
    type = "S"
  }

  stream_enabled   = true
  stream_view_type = "NEW_IMAGE"
}

#################################
#  aws_lambda_function : transform-service-api-handler
#################################

resource "aws_lambda_function" "transform-service-api-handler" {
  filename         = "./../api-handler/dist/lambda.zip"
  function_name    = "${format("%.64s", "${var.global_prefix}-transform-service-api-handler")}"
  role             = "${aws_iam_role.iam_for_exec_lambda.arn}"
  handler          = "index.handler"
  source_code_hash = "${base64sha256(file("./../api-handler/dist/lambda.zip"))}"
  runtime          = "nodejs8.10"
  timeout          = "30"
  memory_size      = "256"
}

#################################
#  aws_lambda_function : transform-service-worker
#################################

resource "aws_lambda_function" "transform-service-worker" {
  filename         = "./../worker/dist/lambda.zip"
  function_name    = "${format("%.64s", "${var.global_prefix}-transform-service-worker")}"
  role             = "${aws_iam_role.iam_for_exec_lambda.arn}"
  handler          = "index.handler"
  source_code_hash = "${base64sha256(file("./../worker/dist/lambda.zip"))}"
  runtime          = "nodejs8.10"
  timeout          = "30"
  memory_size      = "256"
}

##############################
#  aws_api_gateway_rest_api:  transform_service_api
##############################
resource "aws_api_gateway_rest_api" "transform_service_api" {
  name        = "${var.global_prefix}-transform-service"
  description = "FFmpeg Transform Service Rest Api"
}

resource "aws_api_gateway_resource" "transform_service_api_resource" {
  rest_api_id = "${aws_api_gateway_rest_api.transform_service_api.id}"
  parent_id   = "${aws_api_gateway_rest_api.transform_service_api.root_resource_id}"
  path_part   = "{proxy+}"
}

resource "aws_api_gateway_method" "transform_service_options_method" {
  rest_api_id   = "${aws_api_gateway_rest_api.transform_service_api.id}"
  resource_id   = "${aws_api_gateway_resource.transform_service_api_resource.id}"
  http_method   = "OPTIONS"
  authorization = "NONE"
}

resource "aws_api_gateway_method_response" "transform_service_options_200" {
  rest_api_id = "${aws_api_gateway_rest_api.transform_service_api.id}"
  resource_id = "${aws_api_gateway_resource.transform_service_api_resource.id}"
  http_method = "${aws_api_gateway_method.transform_service_options_method.http_method}"
  status_code = "200"

  response_models = {
    "application/json" = "Empty"
  }

  response_parameters = {
    "method.response.header.Access-Control-Allow-Headers" = true
    "method.response.header.Access-Control-Allow-Methods" = true
    "method.response.header.Access-Control-Allow-Origin"  = true
  }
}

resource "aws_api_gateway_integration" "transform_service_options_integration" {
  rest_api_id = "${aws_api_gateway_rest_api.transform_service_api.id}"
  resource_id = "${aws_api_gateway_resource.transform_service_api_resource.id}"
  http_method = "${aws_api_gateway_method.transform_service_options_method.http_method}"
  type        = "MOCK"

  request_templates = {
    "application/json" = "{ \"statusCode\": 200 }"
  }
}

resource "aws_api_gateway_integration_response" "transform_service_options_integration_response" {
  rest_api_id = "${aws_api_gateway_rest_api.transform_service_api.id}"
  resource_id = "${aws_api_gateway_resource.transform_service_api_resource.id}"
  http_method = "${aws_api_gateway_method.transform_service_options_method.http_method}"
  status_code = "${aws_api_gateway_method_response.transform_service_options_200.status_code}"

  response_parameters = {
    "method.response.header.Access-Control-Allow-Headers" = "'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token'"
    "method.response.header.Access-Control-Allow-Methods" = "'GET,OPTIONS,POST,PUT,PATCH,DELETE'"
    "method.response.header.Access-Control-Allow-Origin"  = "'*'"
  }

  response_templates = {
    "application/json" = ""
  }
}

resource "aws_api_gateway_method" "transform_service_api_method" {
  rest_api_id   = "${aws_api_gateway_rest_api.transform_service_api.id}"
  resource_id   = "${aws_api_gateway_resource.transform_service_api_resource.id}"
  http_method   = "ANY"
  authorization = "AWS_IAM"
}

resource "aws_api_gateway_integration" "transform_service_api_method-integration" {
  rest_api_id             = "${aws_api_gateway_rest_api.transform_service_api.id}"
  resource_id             = "${aws_api_gateway_resource.transform_service_api_resource.id}"
  http_method             = "${aws_api_gateway_method.transform_service_api_method.http_method}"
  type                    = "AWS_PROXY"
  uri                     = "arn:aws:apigateway:${var.aws_region}:lambda:path/2015-03-31/functions/arn:aws:lambda:${var.aws_region}:${var.aws_account_id}:function:${aws_lambda_function.transform-service-api-handler.function_name}/invocations"
  integration_http_method = "POST"
}

resource "aws_lambda_permission" "apigw_transform-service-api-handler" {
  statement_id  = "AllowExecutionFromAPIGateway"
  action        = "lambda:InvokeFunction"
  function_name = "${aws_lambda_function.transform-service-api-handler.arn}"
  principal     = "apigateway.amazonaws.com"
  source_arn    = "arn:aws:execute-api:${var.aws_region}:${var.aws_account_id}:${aws_api_gateway_rest_api.transform_service_api.id}/*/${aws_api_gateway_method.transform_service_api_method.http_method}/*"
}

resource "aws_api_gateway_deployment" "transform_service_deployment" {
  depends_on = [
    "aws_api_gateway_method.transform_service_api_method",
    "aws_api_gateway_integration.transform_service_api_method-integration",
  ]

  rest_api_id = "${aws_api_gateway_rest_api.transform_service_api.id}"
  stage_name  = "${var.environment_type}"

  variables = {
    "TableName"                = "${var.global_prefix}-transform-service"
    "PublicUrl"                = "${local.transform_service_url}"
    "ServicesUrl"              = "${var.services_url}"
    "ServicesAuthType"         = "${var.services_auth_type}"
    "ServicesAuthContext"      = "${var.services_auth_context}"
    "WorkerLambdaFunctionName" = "${aws_lambda_function.transform-service-worker.function_name}"
    "DeploymentHash"           = "${sha256(file("./main.tf"))}"
  }
}

output "services_url" {
  value = "${var.services_url}"
}

output "services_auth_type" {
  value = "${var.services_auth_type}"
}

output "services_auth_context" {
  value = "${var.services_auth_context}"
}

output "transform_service_url" {
  value = "${local.transform_service_url}"
}

output "transform_service_auth_type" {
  value = "AWS4"
}

# output "transform_service_auth_context" {
#   value = ""
# }

locals {
  transform_service_url = "https://${aws_api_gateway_rest_api.transform_service_api.id}.execute-api.${var.aws_region}.amazonaws.com/${var.environment_type}"
}
