#################################
#  aws_lambda_function : workflow-service-api-handler
#################################

resource "aws_lambda_function" "workflow_service_api_handler" {
  filename         = "../services/workflow-service/api-handler/build/dist/lambda.zip"
  function_name    = format("%.64s", "${var.global_prefix}-workflow-service-api-handler")
  role             = aws_iam_role.iam_for_exec_lambda.arn
  handler          = "index.handler"
  source_code_hash = filebase64sha256("../services/workflow-service/api-handler/build/dist/lambda.zip")
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
#  aws_lambda_function : workflow-service-worker
#################################

resource "aws_lambda_function" "workflow_service_worker" {
  filename         = "../services/workflow-service/worker/build/dist/lambda.zip"
  function_name    = format("%.64s", "${var.global_prefix}-workflow-service-worker")
  role             = aws_iam_role.iam_for_exec_lambda.arn
  handler          = "index.handler"
  source_code_hash = filebase64sha256("../services/workflow-service/worker/build/dist/lambda.zip")
  runtime          = "nodejs10.x"
  timeout          = "900"
  memory_size      = "3008"

  environment {
    variables = {
      LogGroupName = var.global_prefix
    }
  }
}

##################################
# aws_dynamodb_table : workflow_service_table
##################################

resource "aws_dynamodb_table" "workflow_service_table" {
  name           = "${var.global_prefix}-workflow-service"
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
#  aws_api_gateway_rest_api:  workflow_service_api
##############################
resource "aws_api_gateway_rest_api" "workflow_service_api" {
  name        = "${var.global_prefix}-workflow-service"
  description = "Workflow Service Rest Api"
}

resource "aws_api_gateway_resource" "workflow_service_api_resource" {
  rest_api_id = aws_api_gateway_rest_api.workflow_service_api.id
  parent_id   = aws_api_gateway_rest_api.workflow_service_api.root_resource_id
  path_part   = "{proxy+}"
}

resource "aws_api_gateway_method" "workflow_service_api_method" {
  rest_api_id   = aws_api_gateway_rest_api.workflow_service_api.id
  resource_id   = aws_api_gateway_resource.workflow_service_api_resource.id
  http_method   = "ANY"
  authorization = "AWS_IAM"
}

resource "aws_api_gateway_integration" "workflow_service_api_method_integration" {
  rest_api_id             = aws_api_gateway_rest_api.workflow_service_api.id
  resource_id             = aws_api_gateway_resource.workflow_service_api_resource.id
  http_method             = aws_api_gateway_method.workflow_service_api_method.http_method
  type                    = "AWS_PROXY"
  uri                     = "arn:aws:apigateway:${var.aws_region}:lambda:path/2015-03-31/functions/arn:aws:lambda:${var.aws_region}:${var.aws_account_id}:function:${aws_lambda_function.workflow_service_api_handler.function_name}/invocations"
  integration_http_method = "POST"
}

resource "aws_lambda_permission" "apigw_workflow_service_api_handler" {
  statement_id  = "AllowExecutionFromAPIGateway"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.workflow_service_api_handler.arn
  principal     = "apigateway.amazonaws.com"
  source_arn    = "arn:aws:execute-api:${var.aws_region}:${var.aws_account_id}:${aws_api_gateway_rest_api.workflow_service_api.id}/*/${aws_api_gateway_method.workflow_service_api_method.http_method}/*"
}

resource "aws_api_gateway_deployment" "workflow_service_deployment" {
  depends_on = [aws_api_gateway_integration.workflow_service_api_method_integration]

  rest_api_id = aws_api_gateway_rest_api.workflow_service_api.id
}

resource "aws_api_gateway_stage" "workflow_service_gateway_stage" {
  stage_name    = var.environment_type
  deployment_id = aws_api_gateway_deployment.workflow_service_deployment.id
  rest_api_id   = aws_api_gateway_rest_api.workflow_service_api.id

  variables = {
    TableName        = aws_dynamodb_table.workflow_service_table.name
    PublicUrl        = local.workflow_service_url
    ServicesUrl      = local.services_url
    ServicesAuthType = local.service_registry_auth_type
    WorkerFunctionId = aws_lambda_function.workflow_service_worker.function_name
    DeploymentHash   = filesha256("./services/workflow-service.tf")

    AiWorkflowId      = var.ai_workflow_id
    ConformWorkflowId = var.conform_workflow_id
  }
}

locals {
  workflow_service_url = "https://${aws_api_gateway_rest_api.workflow_service_api.id}.execute-api.${var.aws_region}.amazonaws.com/${var.environment_type}"
}
