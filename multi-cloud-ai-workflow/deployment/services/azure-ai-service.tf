#################################
#  aws_lambda_function : azure-ai-service-api-handler
#################################

resource "aws_lambda_function" "azure_ai_service_api_handler" {
  filename         = "../services/azure-ai-service/api-handler/build/dist/lambda.zip"
  function_name    = format("%.64s", "${var.global_prefix}-azure-ai-service-api-handler")
  role             = aws_iam_role.iam_for_exec_lambda.arn
  handler          = "index.handler"
  source_code_hash = filebase64sha256("../services/azure-ai-service/api-handler/build/dist/lambda.zip")
  runtime          = "nodejs10.x"
  timeout          = "30"
  memory_size      = "3008"

  environment {
    variables = {
      LogGroupName = var.log_group.name
    }
  }
}

#################################
#  aws_lambda_function : azure-ai-service-api-handler-non-secure
#################################

resource "aws_lambda_function" "azure_ai_service_api_handler_non_secure" {
  filename         = "../services/azure-ai-service/api-handler-non-secure/build/dist/lambda.zip"
  function_name    = format("%.64s", "${var.global_prefix}-azure-ai-service-api-handler-non-secure")
  role             = aws_iam_role.iam_for_exec_lambda.arn
  handler          = "index.handler"
  source_code_hash = filebase64sha256("../services/azure-ai-service/api-handler-non-secure/build/dist/lambda.zip")
  runtime          = "nodejs10.x"
  timeout          = "900"
  memory_size      = "3008"

  environment {
    variables = {
      LogGroupName = var.log_group.name
    }
  }
}

#################################
#  aws_lambda_function : azure-ai-service-worker
#################################

resource "aws_lambda_function" "azure_ai_service_worker" {
  filename         = "../services/azure-ai-service/worker/build/dist/lambda.zip"
  function_name    = format("%.64s", "${var.global_prefix}-azure-ai-service-worker")
  role             = aws_iam_role.iam_for_exec_lambda.arn
  handler          = "index.handler"
  source_code_hash = filebase64sha256("../services/azure-ai-service/worker/build/dist/lambda.zip")
  runtime          = "nodejs10.x"
  timeout          = "900"
  memory_size      = "3008"

  environment {
    variables = {
      LogGroupName = var.log_group.name
    }
  }
}

##################################
# aws_dynamodb_table : azure_ai_service_table
##################################

resource "aws_dynamodb_table" "azure_ai_service_table" {
  name         = "${var.global_prefix}-azure-ai-service"
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
}

##############################
#  aws_api_gateway_rest_api:  azure_ai_service_api
##############################
resource "aws_api_gateway_rest_api" "azure_ai_service_api" {
  name        = "${var.global_prefix}-azure-ai-service"
  description = "Azure AI Service Rest Api"

  endpoint_configuration {
    types = ["REGIONAL"]
  }
}

resource "aws_api_gateway_resource" "azure_ai_service_api_resource" {
  rest_api_id = aws_api_gateway_rest_api.azure_ai_service_api.id
  parent_id   = aws_api_gateway_rest_api.azure_ai_service_api.root_resource_id
  path_part   = "{proxy+}"
}

resource "aws_api_gateway_method" "azure_ai_service_options_method" {
  rest_api_id   = aws_api_gateway_rest_api.azure_ai_service_api.id
  resource_id   = aws_api_gateway_resource.azure_ai_service_api_resource.id
  http_method   = "OPTIONS"
  authorization = "NONE"
}

resource "aws_api_gateway_method_response" "azure_ai_service_options_200" {
  rest_api_id = aws_api_gateway_rest_api.azure_ai_service_api.id
  resource_id = aws_api_gateway_resource.azure_ai_service_api_resource.id
  http_method = aws_api_gateway_method.azure_ai_service_options_method.http_method
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

resource "aws_api_gateway_integration" "azure_ai_service_options_integration" {
  rest_api_id = aws_api_gateway_rest_api.azure_ai_service_api.id
  resource_id = aws_api_gateway_resource.azure_ai_service_api_resource.id
  http_method = aws_api_gateway_method.azure_ai_service_options_method.http_method
  type        = "MOCK"

  request_templates = {
    "application/json" = "{ \"statusCode\": 200 }"
  }
}

resource "aws_api_gateway_integration_response" "azure_ai_service_options_integration_response" {
  rest_api_id = aws_api_gateway_rest_api.azure_ai_service_api.id
  resource_id = aws_api_gateway_resource.azure_ai_service_api_resource.id
  http_method = aws_api_gateway_method.azure_ai_service_options_method.http_method
  status_code = aws_api_gateway_method_response.azure_ai_service_options_200.status_code

  response_parameters = {
    "method.response.header.Access-Control-Allow-Headers" = "'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token'"
    "method.response.header.Access-Control-Allow-Methods" = "'GET,OPTIONS,POST,PUT,PATCH,DELETE'"
    "method.response.header.Access-Control-Allow-Origin"  = "'*'"
  }

  response_templates = {
    "application/json" = ""
  }
}

resource "aws_api_gateway_method" "azure_ai_service_api_method" {
  rest_api_id   = aws_api_gateway_rest_api.azure_ai_service_api.id
  resource_id   = aws_api_gateway_resource.azure_ai_service_api_resource.id
  http_method   = "ANY"
  authorization = "AWS_IAM"
}

resource "aws_api_gateway_integration" "azure_ai_service_api_method_integration" {
  rest_api_id             = aws_api_gateway_rest_api.azure_ai_service_api.id
  resource_id             = aws_api_gateway_resource.azure_ai_service_api_resource.id
  http_method             = aws_api_gateway_method.azure_ai_service_api_method.http_method
  type                    = "AWS_PROXY"
  uri                     = "arn:aws:apigateway:${var.aws_region}:lambda:path/2015-03-31/functions/arn:aws:lambda:${var.aws_region}:${var.aws_account_id}:function:${aws_lambda_function.azure_ai_service_api_handler.function_name}/invocations"
  integration_http_method = "POST"
}

resource "aws_lambda_permission" "apigw_azure_ai_service_api_handler" {
  statement_id  = "AllowExecutionFromAPIGateway"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.azure_ai_service_api_handler.arn
  principal     = "apigateway.amazonaws.com"
  source_arn    = "arn:aws:execute-api:${var.aws_region}:${var.aws_account_id}:${aws_api_gateway_rest_api.azure_ai_service_api.id}/*/${aws_api_gateway_method.azure_ai_service_api_method.http_method}/*"
}

resource "aws_api_gateway_deployment" "azure_ai_service_deployment" {
  depends_on = [
    aws_api_gateway_integration.azure_ai_service_api_method_integration,
    aws_api_gateway_integration.azure_ai_service_options_integration,
    aws_api_gateway_integration_response.azure_ai_service_options_integration_response,
  ]

  rest_api_id = aws_api_gateway_rest_api.azure_ai_service_api.id
}

resource "aws_api_gateway_stage" "azure_ai_service_gateway_stage" {
  depends_on = [
    aws_api_gateway_integration.azure_ai_service_api_method_integration,
    aws_api_gateway_integration.azure_ai_service_options_integration,
    aws_api_gateway_integration_response.azure_ai_service_options_integration_response,
  ]

  stage_name    = var.environment_type
  deployment_id = aws_api_gateway_deployment.azure_ai_service_deployment.id
  rest_api_id   = aws_api_gateway_rest_api.azure_ai_service_api.id

  variables = {
    TableName            = aws_dynamodb_table.azure_ai_service_table.name
    PublicUrl            = local.azure_ai_service_url
    PublicUrlNonSecure   = local.azure_ai_service_non_secure_url
    ServicesUrl          = var.services_url
    ServicesAuthType     = var.services_auth_type
    WorkerFunctionId     = aws_lambda_function.azure_ai_service_worker.function_name
    AzureApiUrl          = var.azure_api_url
    AzureLocation        = var.azure_location
    AzureAccountID       = var.azure_account_id
    AzureSubscriptionKey = var.azure_subscription_key
    DeploymentHash       = filesha256("./services/azure-ai-service.tf")
  }
}

##############################
#  aws_api_gateway_rest_api:  azure_ai_service_api_non_secure
##############################
resource "aws_api_gateway_rest_api" "azure_ai_service_api_non_secure" {
  name        = "${var.global_prefix}-azure-ai-service-non-secure"
  description = "Azure AI Service Non Secure Rest Api For Callbacks by Azure Service"

  endpoint_configuration {
    types = ["REGIONAL"]
  }
}

resource "aws_api_gateway_resource" "azure_ai_service_api_resource_non_secure" {
  rest_api_id = aws_api_gateway_rest_api.azure_ai_service_api_non_secure.id
  parent_id   = aws_api_gateway_rest_api.azure_ai_service_api_non_secure.root_resource_id
  path_part   = "{proxy+}"
}

resource "aws_api_gateway_method" "azure_ai_service_api_method_non_secure" {
  rest_api_id   = aws_api_gateway_rest_api.azure_ai_service_api_non_secure.id
  resource_id   = aws_api_gateway_resource.azure_ai_service_api_resource_non_secure.id
  http_method   = "ANY"
  authorization = "NONE"
}

resource "aws_api_gateway_integration" "azure_ai_service_api_method_integration_non_secure" {
  rest_api_id             = aws_api_gateway_rest_api.azure_ai_service_api_non_secure.id
  resource_id             = aws_api_gateway_resource.azure_ai_service_api_resource_non_secure.id
  http_method             = aws_api_gateway_method.azure_ai_service_api_method_non_secure.http_method
  type                    = "AWS_PROXY"
  uri                     = "arn:aws:apigateway:${var.aws_region}:lambda:path/2015-03-31/functions/arn:aws:lambda:${var.aws_region}:${var.aws_account_id}:function:${aws_lambda_function.azure_ai_service_api_handler_non_secure.function_name}/invocations"
  integration_http_method = "POST"
}

resource "aws_lambda_permission" "apigw_azure_ai_service_api_handler_non_secure" {
  statement_id  = "AllowExecutionFromAPIGateway"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.azure_ai_service_api_handler_non_secure.arn
  principal     = "apigateway.amazonaws.com"
  source_arn    = "arn:aws:execute-api:${var.aws_region}:${var.aws_account_id}:${aws_api_gateway_rest_api.azure_ai_service_api_non_secure.id}/*/${aws_api_gateway_method.azure_ai_service_api_method_non_secure.http_method}/*"
}

resource "aws_api_gateway_deployment" "azure_ai_service_deployment_non_secure" {
  depends_on = [aws_api_gateway_integration.azure_ai_service_api_method_integration_non_secure,]

  rest_api_id = aws_api_gateway_rest_api.azure_ai_service_api_non_secure.id
}

resource "aws_api_gateway_stage" "azure_ai_service_gateway_stage_non_secure" {
  depends_on = [aws_api_gateway_integration.azure_ai_service_api_method_integration_non_secure,]

  stage_name    = var.environment_type
  deployment_id = aws_api_gateway_deployment.azure_ai_service_deployment_non_secure.id
  rest_api_id   = aws_api_gateway_rest_api.azure_ai_service_api_non_secure.id

  variables = {
    TableName            = aws_dynamodb_table.azure_ai_service_table.name
    PublicUrl            = local.azure_ai_service_url
    PublicUrlNonSecure   = local.azure_ai_service_non_secure_url
    ServicesUrl          = var.services_url
    ServicesAuthType     = var.services_auth_type
    WorkerFunctionId     = aws_lambda_function.azure_ai_service_worker.function_name
    AzureApiUrl          = var.azure_api_url
    AzureLocation        = var.azure_location
    AzureAccountID       = var.azure_account_id
    AzureSubscriptionKey = var.azure_subscription_key
    DeploymentHash       = filesha256("./services/azure-ai-service.tf")
  }
}

###########################################################################

locals {
  azure_ai_service_url            = "https://${aws_api_gateway_rest_api.azure_ai_service_api.id}.execute-api.${var.aws_region}.amazonaws.com/${var.environment_type}"
  azure_ai_service_non_secure_url = "https://${aws_api_gateway_rest_api.azure_ai_service_api_non_secure.id}.execute-api.${var.aws_region}.amazonaws.com/${var.environment_type}"
}
