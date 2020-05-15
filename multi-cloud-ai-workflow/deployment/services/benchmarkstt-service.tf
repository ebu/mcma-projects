#################################
#  aws_iam_role : benchmarkstt_service_lambda_execution
#################################

resource "aws_iam_role" "benchmarkstt_service_lambda_execution" {
  name               = format("%.64s", "${var.global_prefix}.${var.aws_region}.services.benchmarkstt.lambda-exec-role")
  assume_role_policy = file("policies/assume-role-lambda.json")
}

resource "aws_iam_role_policy_attachment" "benchmarkstt_service_allow_full_logs" {
  role       = aws_iam_role.benchmarkstt_service_lambda_execution.id
  policy_arn = aws_iam_policy.allow_full_logs.arn
}

resource "aws_iam_role_policy_attachment" "benchmarkstt_service_allow_full_dynamodb" {
  role       = aws_iam_role.benchmarkstt_service_lambda_execution.id
  policy_arn = aws_iam_policy.allow_full_dynamodb.arn
}

resource "aws_iam_role_policy_attachment" "benchmarkstt_service_allow_full_s3" {
  role       = aws_iam_role.benchmarkstt_service_lambda_execution.id
  policy_arn = aws_iam_policy.allow_full_s3.arn
}

resource "aws_iam_role_policy_attachment" "benchmarkstt_service_allow_invoke_lambda" {
  role       = aws_iam_role.benchmarkstt_service_lambda_execution.id
  policy_arn = aws_iam_policy.allow_invoke_lambda.arn
}

resource "aws_iam_role_policy_attachment" "benchmarkstt_service_allow_invoke_api_gateway" {
  role       = aws_iam_role.benchmarkstt_service_lambda_execution.id
  policy_arn = aws_iam_policy.allow_invoke_api_gateway.arn
}

resource "aws_iam_role_policy_attachment" "benchmarkstt_service_allow_read_only_ecs" {
  role       = aws_iam_role.benchmarkstt_service_lambda_execution.id
  policy_arn = aws_iam_policy.allow_read_only_ecs.arn
}

#################################
#  aws_lambda_function : benchmarkstt-service-api-handler
#################################

resource "aws_lambda_function" "benchmarkstt_service_api_handler" {
  filename         = "../services/benchmarkstt-service/api-handler/build/dist/lambda.zip"
  function_name    = format("%.64s", "${var.global_prefix}-benchmarkstt-service-api-handler")
  role             = aws_iam_role.benchmarkstt_service_lambda_execution.arn
  handler          = "index.handler"
  source_code_hash = filebase64sha256("../services/benchmarkstt-service/api-handler/build/dist/lambda.zip")
  runtime          = "nodejs10.x"
  timeout          = "900"
  memory_size      = "3008"

  environment {
    variables = {
      LogGroupName = var.global_prefix
    }
  }
}

#################################
#  aws_lambda_function : benchmarkstt-service-worker
#################################

resource "aws_lambda_function" "benchmarkstt_service_worker" {
  filename         = "../services/benchmarkstt-service/worker/build/dist/lambda.zip"
  function_name    = format("%.64s", "${var.global_prefix}-benchmarkstt-service-worker")
  role             = aws_iam_role.benchmarkstt_service_lambda_execution.arn
  handler          = "index.handler"
  source_code_hash = filebase64sha256("../services/benchmarkstt-service/worker/build/dist/lambda.zip")
  runtime          = "nodejs10.x"
  timeout          = "900"
  memory_size      = "3008"

  environment {
    variables = {
      LogGroupName               = var.global_prefix
      EcsClusterName             = var.ecs_cluster_name
      EcsBenchmarksttServiceName = var.ecs_benchmarkstt_service_name
    }
  }

  vpc_config {
    subnet_ids         = var.ecs_enabled ? [var.vpc_private_subnet_id] : []
    security_group_ids = var.ecs_enabled ? [var.vpc_default_security_group_id] : []
  }
}

##################################
# aws_dynamodb_table : benchmarkstt_service_table
##################################

resource "aws_dynamodb_table" "benchmarkstt_service_table" {
  name         = "${var.global_prefix}-benchmarkstt-service"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "resource_type"
  range_key    = "resource_id"

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
#  aws_api_gateway_rest_api:  benchmarkstt_service_api
##############################
resource "aws_api_gateway_rest_api" "benchmarkstt_service_api" {
  name        = "${var.global_prefix}-benchmarkstt-service"
  description = "BenchmarkSTT Service Rest Api"

  endpoint_configuration {
    types = ["REGIONAL"]
  }
}

resource "aws_api_gateway_resource" "benchmarkstt_service_api_resource" {
  rest_api_id = aws_api_gateway_rest_api.benchmarkstt_service_api.id
  parent_id   = aws_api_gateway_rest_api.benchmarkstt_service_api.root_resource_id
  path_part   = "{proxy+}"
}

resource "aws_api_gateway_method" "benchmarkstt_service_options_method" {
  rest_api_id   = aws_api_gateway_rest_api.benchmarkstt_service_api.id
  resource_id   = aws_api_gateway_resource.benchmarkstt_service_api_resource.id
  http_method   = "OPTIONS"
  authorization = "NONE"
}

resource "aws_api_gateway_method_response" "benchmarkstt_service_options_200" {
  rest_api_id = aws_api_gateway_rest_api.benchmarkstt_service_api.id
  resource_id = aws_api_gateway_resource.benchmarkstt_service_api_resource.id
  http_method = aws_api_gateway_method.benchmarkstt_service_options_method.http_method
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

resource "aws_api_gateway_integration" "benchmarkstt_service_options_integration" {
  rest_api_id = aws_api_gateway_rest_api.benchmarkstt_service_api.id
  resource_id = aws_api_gateway_resource.benchmarkstt_service_api_resource.id
  http_method = aws_api_gateway_method.benchmarkstt_service_options_method.http_method
  type        = "MOCK"

  request_templates = {
    "application/json" = "{ \"statusCode\": 200 }"
  }
}

resource "aws_api_gateway_integration_response" "benchmarkstt_service_options_integration_response" {
  rest_api_id = aws_api_gateway_rest_api.benchmarkstt_service_api.id
  resource_id = aws_api_gateway_resource.benchmarkstt_service_api_resource.id
  http_method = aws_api_gateway_method.benchmarkstt_service_options_method.http_method
  status_code = aws_api_gateway_method_response.benchmarkstt_service_options_200.status_code

  response_parameters = {
    "method.response.header.Access-Control-Allow-Headers" = "'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token'"
    "method.response.header.Access-Control-Allow-Methods" = "'GET,OPTIONS,POST,PUT,PATCH,DELETE'"
    "method.response.header.Access-Control-Allow-Origin"  = "'*'"
  }

  response_templates = {
    "application/json" = ""
  }
}

resource "aws_api_gateway_method" "benchmarkstt_service_api_method" {
  rest_api_id   = aws_api_gateway_rest_api.benchmarkstt_service_api.id
  resource_id   = aws_api_gateway_resource.benchmarkstt_service_api_resource.id
  http_method   = "ANY"
  authorization = "AWS_IAM"
}

resource "aws_api_gateway_integration" "benchmarkstt_service_api_method_integration" {
  rest_api_id             = aws_api_gateway_rest_api.benchmarkstt_service_api.id
  resource_id             = aws_api_gateway_resource.benchmarkstt_service_api_resource.id
  http_method             = aws_api_gateway_method.benchmarkstt_service_api_method.http_method
  type                    = "AWS_PROXY"
  uri                     = "arn:aws:apigateway:${var.aws_region}:lambda:path/2015-03-31/functions/arn:aws:lambda:${var.aws_region}:${var.aws_account_id}:function:${aws_lambda_function.benchmarkstt_service_api_handler.function_name}/invocations"
  integration_http_method = "POST"
}

resource "aws_lambda_permission" "apigw_benchmarkstt_service_api_handler" {
  statement_id  = "AllowExecutionFromAPIGateway"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.benchmarkstt_service_api_handler.arn
  principal     = "apigateway.amazonaws.com"
  source_arn    = "arn:aws:execute-api:${var.aws_region}:${var.aws_account_id}:${aws_api_gateway_rest_api.benchmarkstt_service_api.id}/*/${aws_api_gateway_method.benchmarkstt_service_api_method.http_method}/*"
}

resource "aws_api_gateway_deployment" "benchmarkstt_service_deployment" {
  depends_on = [
    aws_api_gateway_integration.benchmarkstt_service_api_method_integration,
    aws_api_gateway_integration.benchmarkstt_service_options_integration,
  ]

  rest_api_id = aws_api_gateway_rest_api.benchmarkstt_service_api.id
}

resource "aws_api_gateway_stage" "benchmarkstt_service_gateway_stage" {
  stage_name    = var.environment_type
  deployment_id = aws_api_gateway_deployment.benchmarkstt_service_deployment.id
  rest_api_id   = aws_api_gateway_rest_api.benchmarkstt_service_api.id

  variables = {
    TableName        = aws_dynamodb_table.benchmarkstt_service_table.name
    PublicUrl        = local.benchmarkstt_service_url
    ServicesUrl      = local.services_url
    ServicesAuthType = local.service_registry_auth_type
    WorkerFunctionId = aws_lambda_function.benchmarkstt_service_worker.function_name
    DeploymentHash   = filesha256("./services/benchmarkstt-service.tf")
  }
}

locals {
  benchmarkstt_service_url = "https://${aws_api_gateway_rest_api.benchmarkstt_service_api.id}.execute-api.${var.aws_region}.amazonaws.com/${var.environment_type}"
}
