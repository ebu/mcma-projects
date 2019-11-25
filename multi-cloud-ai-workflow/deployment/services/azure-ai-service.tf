#################################
#  aws_lambda_function : azure-ai-service-api-handler
#################################

resource "aws_lambda_function" "azure-ai-service-api-handler" {
  filename         = "./../services/azure-ai-service/api-handler/dist/lambda.zip"
  function_name    = "${format("%.64s", "${var.global_prefix}-azure-ai-service-api-handler")}"
  role             = "${aws_iam_role.iam_for_exec_lambda.arn}"
  handler          = "index.handler"
  source_code_hash = "${filebase64sha256("./../services/azure-ai-service/api-handler/dist/lambda.zip")}"
  runtime          = "nodejs10.x"
  timeout          = "30"
  memory_size      = "256"
}

#################################
#  aws_lambda_function : azure-ai-service-api-handler-non-secure
#################################

resource "aws_lambda_function" "azure-ai-service-api-handler-non-secure" {
  filename         = "./../services/azure-ai-service/api-handler-non-secure/dist/lambda.zip"
  function_name    = "${format("%.64s", "${var.global_prefix}-azure-ai-service-api-handler-non-secure")}"
  role             = "${aws_iam_role.iam_for_exec_lambda.arn}"
  handler          = "index.handler"
  source_code_hash = "${filebase64sha256("./../services/azure-ai-service/api-handler-non-secure/dist/lambda.zip")}"
  runtime          = "nodejs10.x"
  timeout          = "30"
  memory_size      = "256"
}

#################################
#  aws_lambda_function : azure-ai-service-worker
#################################

resource "aws_lambda_function" "azure-ai-service-worker" {
  filename         = "./../services/azure-ai-service/worker/dist/lambda.zip"
  function_name    = "${format("%.64s", "${var.global_prefix}-azure-ai-service-worker")}"
  role             = "${aws_iam_role.iam_for_exec_lambda.arn}"
  handler          = "index.handler"
  source_code_hash = "${filebase64sha256("./../services/azure-ai-service/worker/dist/lambda.zip")}"
  runtime          = "nodejs10.x"
  timeout          = "300"
  memory_size      = "3008"
}

##################################
# aws_dynamodb_table : azure_ai_service_table
##################################

resource "aws_dynamodb_table" "azure_ai_service_table" {
  name           = "${var.global_prefix}-azure-ai-service"
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
#  aws_api_gateway_rest_api:  azure_ai_service_api
##############################
resource "aws_api_gateway_rest_api" "azure_ai_service_api" {
  name        = "${var.global_prefix}-azure-ai-service"
  description = "Azure AI Service Rest Api"
}

resource "aws_api_gateway_resource" "azure_ai_service_api_resource" {
  rest_api_id = "${aws_api_gateway_rest_api.azure_ai_service_api.id}"
  parent_id   = "${aws_api_gateway_rest_api.azure_ai_service_api.root_resource_id}"
  path_part   = "{proxy+}"
}

resource "aws_api_gateway_method" "azure_ai_service_api_method" {
  rest_api_id   = "${aws_api_gateway_rest_api.azure_ai_service_api.id}"
  resource_id   = "${aws_api_gateway_resource.azure_ai_service_api_resource.id}"
  http_method   = "ANY"
  authorization = "AWS_IAM"
}

resource "aws_api_gateway_integration" "azure_ai_service_api_method-integration" {
  rest_api_id             = "${aws_api_gateway_rest_api.azure_ai_service_api.id}"
  resource_id             = "${aws_api_gateway_resource.azure_ai_service_api_resource.id}"
  http_method             = "${aws_api_gateway_method.azure_ai_service_api_method.http_method}"
  type                    = "AWS_PROXY"
  uri                     = "arn:aws:apigateway:${var.aws_region}:lambda:path/2015-03-31/functions/arn:aws:lambda:${var.aws_region}:${var.aws_account_id}:function:${aws_lambda_function.azure-ai-service-api-handler.function_name}/invocations"
  integration_http_method = "POST"
}

resource "aws_lambda_permission" "apigw_azure-ai-service-api-handler" {
  statement_id  = "AllowExecutionFromAPIGateway"
  action        = "lambda:InvokeFunction"
  function_name = "${aws_lambda_function.azure-ai-service-api-handler.arn}"
  principal     = "apigateway.amazonaws.com"

  # More: http://docs.aws.amazon.com/apigateway/latest/developerguide/api-gateway-control-access-using-iam-policies-to-invoke-api.html
  source_arn = "arn:aws:execute-api:${var.aws_region}:${var.aws_account_id}:${aws_api_gateway_rest_api.azure_ai_service_api.id}/*/${aws_api_gateway_method.azure_ai_service_api_method.http_method}/*"
}

resource "aws_api_gateway_deployment" "azure_ai_service_deployment" {
  depends_on = [
    "aws_api_gateway_method.azure_ai_service_api_method",
    "aws_api_gateway_integration.azure_ai_service_api_method-integration",
  ]

  rest_api_id = "${aws_api_gateway_rest_api.azure_ai_service_api.id}"
  stage_name  = "${var.environment_type}"

  variables = {
    "TableName"            = "${var.global_prefix}-azure-ai-service"
    "PublicUrl"            = "${local.azure_ai_service_url}"
    "PublicUrlNonSecure"   = "${local.azure_ai_service_non_secure_url}"
    "ServicesUrl"          = "${local.services_url}"
    "ServicesAuthType"     = "${local.services_auth_type}"
    "ServicesAuthContext"  = "${local.services_auth_context}"
    "WorkerFunctionName"   = "${aws_lambda_function.azure-ai-service-worker.function_name}"
    "AzureApiUrl"          = "${var.azure_api_url}"
    "AzureLocation"        = "${var.azure_location}"
    "AzureAccountID"       = "${var.azure_account_id}"
    "AzureSubscriptionKey" = "${var.azure_subscription_key}"
    "DeploymentHash"       = "${filesha256("./services/azure-ai-service.tf")}"
  }
}

##############################
#  aws_api_gateway_rest_api:  azure_ai_service_api_non_secure
##############################
resource "aws_api_gateway_rest_api" "azure_ai_service_api_non_secure" {
  name        = "${var.global_prefix}-azure-ai-service-non-secure"
  description = "Azure AI Service Non Secure Rest Api For Callbacks by Azure Service"
}

resource "aws_api_gateway_resource" "azure_ai_service_api_resource_non_secure" {
  rest_api_id = "${aws_api_gateway_rest_api.azure_ai_service_api_non_secure.id}"
  parent_id   = "${aws_api_gateway_rest_api.azure_ai_service_api_non_secure.root_resource_id}"
  path_part   = "{proxy+}"
}

resource "aws_api_gateway_method" "azure_ai_service_api_method_non_secure" {
  rest_api_id   = "${aws_api_gateway_rest_api.azure_ai_service_api_non_secure.id}"
  resource_id   = "${aws_api_gateway_resource.azure_ai_service_api_resource_non_secure.id}"
  http_method   = "ANY"
  authorization = "NONE"
}

resource "aws_api_gateway_integration" "azure_ai_service_api_method-integration_non_secure" {
  rest_api_id             = "${aws_api_gateway_rest_api.azure_ai_service_api_non_secure.id}"
  resource_id             = "${aws_api_gateway_resource.azure_ai_service_api_resource_non_secure.id}"
  http_method             = "${aws_api_gateway_method.azure_ai_service_api_method_non_secure.http_method}"
  type                    = "AWS_PROXY"
  uri                     = "arn:aws:apigateway:${var.aws_region}:lambda:path/2015-03-31/functions/arn:aws:lambda:${var.aws_region}:${var.aws_account_id}:function:${aws_lambda_function.azure-ai-service-api-handler-non-secure.function_name}/invocations"
  integration_http_method = "POST"
}

resource "aws_lambda_permission" "apigw_azure-ai-service-api-handler-non-secure" {
  statement_id  = "AllowExecutionFromAPIGateway"
  action        = "lambda:InvokeFunction"
  function_name = "${aws_lambda_function.azure-ai-service-api-handler-non-secure.arn}"
  principal     = "apigateway.amazonaws.com"

  # More: http://docs.aws.amazon.com/apigateway/latest/developerguide/api-gateway-control-access-using-iam-policies-to-invoke-api.html
  source_arn = "arn:aws:execute-api:${var.aws_region}:${var.aws_account_id}:${aws_api_gateway_rest_api.azure_ai_service_api_non_secure.id}/*/${aws_api_gateway_method.azure_ai_service_api_method_non_secure.http_method}/*"
}

resource "aws_api_gateway_deployment" "azure_ai_service_deployment_non_secure" {
  depends_on = [
    "aws_api_gateway_method.azure_ai_service_api_method_non_secure",
    "aws_api_gateway_integration.azure_ai_service_api_method-integration_non_secure",
  ]

  rest_api_id = "${aws_api_gateway_rest_api.azure_ai_service_api_non_secure.id}"
  stage_name  = "${var.environment_type}"

  variables = {
    "TableName"            = "${var.global_prefix}-azure-ai-service"
    "PublicUrl"            = "${local.azure_ai_service_url}"
    "PublicUrlNonSecure"   = "${local.azure_ai_service_non_secure_url}"
    "ServicesUrl"          = "${local.services_url}"
    "ServicesAuthType"     = "${local.services_auth_type}"
    "ServicesAuthContext"  = "${local.services_auth_context}"
    "WorkerFunctionName"   = "${aws_lambda_function.azure-ai-service-worker.function_name}"
    "AzureApiUrl"          = "${var.azure_api_url}"
    "AzureLocation"        = "${var.azure_location}"
    "AzureAccountID"       = "${var.azure_account_id}"
    "AzureSubscriptionKey" = "${var.azure_subscription_key}"
    "DeploymentHash"       = "${filesha256("./services/azure-ai-service.tf")}"
  }
}

###########################################################################

output "azure_ai_service_url" {
  value = "${local.azure_ai_service_url}"
}

output "azure_ai_service_non_secure_url" {
  value = "${local.azure_ai_service_non_secure_url}"
}

locals {
  azure_ai_service_url            = "https://${aws_api_gateway_rest_api.azure_ai_service_api.id}.execute-api.${var.aws_region}.amazonaws.com/${var.environment_type}"
  azure_ai_service_non_secure_url = "https://${aws_api_gateway_rest_api.azure_ai_service_api_non_secure.id}.execute-api.${var.aws_region}.amazonaws.com/${var.environment_type}"
}
