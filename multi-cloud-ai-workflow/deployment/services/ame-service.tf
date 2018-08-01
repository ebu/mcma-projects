#################################
#  aws_lambda_function : ame-service-api-handler
#################################

resource "aws_lambda_function" "ame-service-api-handler" {
  filename         = "./../services/ame-service/api-handler/dist/lambda.zip"
  function_name    = "${format("%.64s", "${var.global_prefix}-ame-service-api-handler")}"
  role             = "${aws_iam_role.iam_for_exec_lambda.arn}"
  handler          = "index.handler"
  source_code_hash = "${base64sha256(file("./../services/ame-service/api-handler/dist/lambda.zip"))}"
  runtime          = "nodejs8.10"
  timeout          = "30"
  memory_size      = "256"
}

#################################
#  aws_lambda_function : ame-service-worker
#################################

resource "aws_lambda_function" "ame-service-worker" {
  filename         = "./../services/ame-service/worker/dist/lambda.zip"
  function_name    = "${format("%.64s", "${var.global_prefix}-ame-service-worker")}"
  role             = "${aws_iam_role.iam_for_exec_lambda.arn}"
  handler          = "index.handler"
  source_code_hash = "${base64sha256(file("./../services/ame-service/worker/dist/lambda.zip"))}"
  runtime          = "nodejs8.10"
  timeout          = "300"
  memory_size      = "3008"
}

##################################
# aws_dynamodb_table : ame_service_table
##################################

resource "aws_dynamodb_table" "ame_service_table" {
  name           = "${var.global_prefix}-ame-service"
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

##############################
#  aws_api_gateway_rest_api:  ame_service_api
##############################
resource "aws_api_gateway_rest_api" "ame_service_api" {
  name        = "${var.global_prefix}-ame-service"
  description = "Service Registry Rest Api"
}

resource "aws_api_gateway_resource" "ame_service_api_resource" {
  rest_api_id = "${aws_api_gateway_rest_api.ame_service_api.id}"
  parent_id   = "${aws_api_gateway_rest_api.ame_service_api.root_resource_id}"
  path_part   = "{proxy+}"
}

resource "aws_api_gateway_method" "ame_service_api_method" {
  rest_api_id   = "${aws_api_gateway_rest_api.ame_service_api.id}"
  resource_id   = "${aws_api_gateway_resource.ame_service_api_resource.id}"
  http_method   = "ANY"
  authorization = "NONE"
}

resource "aws_api_gateway_integration" "ame_service_api_method-integration" {
  rest_api_id             = "${aws_api_gateway_rest_api.ame_service_api.id}"
  resource_id             = "${aws_api_gateway_resource.ame_service_api_resource.id}"
  http_method             = "${aws_api_gateway_method.ame_service_api_method.http_method}"
  type                    = "AWS_PROXY"
  uri                     = "arn:aws:apigateway:${var.aws_region}:lambda:path/2015-03-31/functions/arn:aws:lambda:${var.aws_region}:${var.aws_account_id}:function:${aws_lambda_function.ame-service-api-handler.function_name}/invocations"
  integration_http_method = "POST"
}

resource "aws_lambda_permission" "apigw_ame-service-api-handler" {
  statement_id  = "AllowExecutionFromAPIGateway"
  action        = "lambda:InvokeFunction"
  function_name = "${aws_lambda_function.ame-service-api-handler.arn}"
  principal     = "apigateway.amazonaws.com"

  # More: http://docs.aws.amazon.com/apigateway/latest/developerguide/api-gateway-control-access-using-iam-policies-to-invoke-api.html
  source_arn = "arn:aws:execute-api:${var.aws_region}:${var.aws_account_id}:${aws_api_gateway_rest_api.ame_service_api.id}/*/${aws_api_gateway_method.ame_service_api_method.http_method}/*"
}

resource "aws_api_gateway_deployment" "ame_service_deployment" {
  depends_on = [
    "aws_api_gateway_method.ame_service_api_method",
    "aws_api_gateway_integration.ame_service_api_method-integration",
  ]

  rest_api_id = "${aws_api_gateway_rest_api.ame_service_api.id}"
  stage_name  = "${var.environment_type}"

  variables = {
    "TableName"                = "${var.global_prefix}-ame-service"
    "PublicUrl"                = "${local.ame_service_url}"
    "ServicesUrl"              = "${local.service_registry_url}"
    "WorkerLambdaFunctionName" = "${aws_lambda_function.ame-service-worker.function_name}"
  }
}

output "ame_service_url" {
  value = "${local.ame_service_url}"
}

locals {
  ame_service_url = "https://${aws_api_gateway_rest_api.ame_service_api.id}.execute-api.${var.aws_region}.amazonaws.com/${var.environment_type}"
}