#################################
#  aws_lambda_function : google-ai-service-api-handler
#################################

resource "aws_lambda_function" "google-ai-service-api-handler" {
  filename         = "./../services/google-ai-service/api-handler/dist/lambda.zip"
  function_name    = "${format("%.64s", "${var.global_prefix}-google-ai-service-api-handler")}"
  role             = "${aws_iam_role.iam_for_exec_lambda.arn}"
  handler          = "index.handler"
  source_code_hash = "${filebase64sha256("./../services/google-ai-service/api-handler/dist/lambda.zip")}"
  runtime          = "nodejs10.x"
  timeout          = "30"
  memory_size      = "256"
}


#################################
#  aws_lambda_function : google-ai-service-worker
#################################

resource "aws_lambda_function" "google-ai-service-worker" {
  filename         = "./../services/google-ai-service/worker/dist/lambda.zip"
  function_name    = "${format("%.64s", "${var.global_prefix}-google-ai-service-worker")}"
  role             = "${aws_iam_role.iam_for_exec_lambda.arn}"
  handler          = "index.handler"
  source_code_hash = "${filebase64sha256("./../services/google-ai-service/worker/dist/lambda.zip")}"
  runtime          = "nodejs10.x"
  timeout          = "300"
  memory_size      = "3008"
}

##################################
# aws_dynamodb_table : google_ai_service_table
##################################

resource "aws_dynamodb_table" "google_ai_service_table" {
  name           = "${var.global_prefix}-google-ai-service"
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
#  aws_api_gateway_rest_api:  google_ai_service_api
##############################
resource "aws_api_gateway_rest_api" "google_ai_service_api" {
  name        = "${var.global_prefix}-google-ai-service"
  description = "google AI Service Rest Api"
}

resource "aws_api_gateway_resource" "google_ai_service_api_resource" {
  rest_api_id = "${aws_api_gateway_rest_api.google_ai_service_api.id}"
  parent_id   = "${aws_api_gateway_rest_api.google_ai_service_api.root_resource_id}"
  path_part   = "{proxy+}"
}

resource "aws_api_gateway_method" "google_ai_service_api_method" {
  rest_api_id   = "${aws_api_gateway_rest_api.google_ai_service_api.id}"
  resource_id   = "${aws_api_gateway_resource.google_ai_service_api_resource.id}"
  http_method   = "ANY"
  authorization = "AWS_IAM"
}

resource "aws_api_gateway_integration" "google_ai_service_api_method-integration" {
  rest_api_id             = "${aws_api_gateway_rest_api.google_ai_service_api.id}"
  resource_id             = "${aws_api_gateway_resource.google_ai_service_api_resource.id}"
  http_method             = "${aws_api_gateway_method.google_ai_service_api_method.http_method}"
  type                    = "AWS_PROXY"
  uri                     = "arn:aws:apigateway:${var.aws_region}:lambda:path/2015-03-31/functions/arn:aws:lambda:${var.aws_region}:${var.aws_account_id}:function:${aws_lambda_function.google-ai-service-api-handler.function_name}/invocations"
  integration_http_method = "POST"
}

resource "aws_lambda_permission" "apigw_google-ai-service-api-handler" {
  statement_id  = "AllowExecutionFromAPIGateway"
  action        = "lambda:InvokeFunction"
  function_name = "${aws_lambda_function.google-ai-service-api-handler.arn}"
  principal     = "apigateway.amazonaws.com"

  # More: http://docs.aws.amazon.com/apigateway/latest/developerguide/api-gateway-control-access-using-iam-policies-to-invoke-api.html
  source_arn = "arn:aws:execute-api:${var.aws_region}:${var.aws_account_id}:${aws_api_gateway_rest_api.google_ai_service_api.id}/*/${aws_api_gateway_method.google_ai_service_api_method.http_method}/*"
}

resource "aws_api_gateway_deployment" "google_ai_service_deployment" {
  depends_on = [
    "aws_api_gateway_method.google_ai_service_api_method",
    "aws_api_gateway_integration.google_ai_service_api_method-integration",
  ]

  rest_api_id = "${aws_api_gateway_rest_api.google_ai_service_api.id}"
  stage_name  = "${var.environment_type}"

  variables = {
    "TableName"            = "${var.global_prefix}-google-ai-service"
    "PublicUrl"            = "${local.google_ai_service_url}"
    "ServicesUrl"          = "${local.services_url}"
    "ServicesAuthType"     = "${local.services_auth_type}"
    "ServicesAuthContext"  = "${local.services_auth_context}"
    "WorkerFunctionName"   = "${aws_lambda_function.google-ai-service-worker.function_name}"
    "DeploymentHash"       = "${filesha256("./services/google-ai-service.tf")}"
    "googleProjectId"      = "${var.google_project_id}"
    "googleBucketName"     = "${var.google_bucket_name}"
    "googleClientEmail"    = "${var.google_client_email}"
    "googlePrivateKey"     = "${var.azure_subscription_key}"
  }
}


###########################################################################

output "google_ai_service_url" {
  value = "${local.google_ai_service_url}"
}


locals {
  google_ai_service_url            = "https://${aws_api_gateway_rest_api.google_ai_service_api.id}.execute-api.${var.aws_region}.amazonaws.com/${var.environment_type}"
}
