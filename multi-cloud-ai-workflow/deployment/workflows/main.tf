#################################
#  aws_iam_policy : policies
#################################

resource "aws_iam_policy" "allow_full_logs" {
  name        = "${var.global_prefix}.${var.aws_region}.workflows.allow-full-logs"
  description = "Policy to write to log"
  policy      = file("policies/allow-full-logs.json")
}

resource "aws_iam_policy" "allow_full_s3" {
  name        = "${var.global_prefix}.${var.aws_region}.workflows.allow-full-s3"
  description = "Policy to access S3 bucket objects"
  policy      = file("policies/allow-full-s3.json")
}

resource "aws_iam_policy" "allow_full_step_functions" {
  name        = "${var.global_prefix}.${var.aws_region}.workflows.allow-full-step-functions"
  description = "Policy to allow lambda functions manage step functions"
  policy      = file("policies/allow-full-step-functions.json")
}

resource "aws_iam_policy" "allow_invoke_lambda" {
  name        = "${var.global_prefix}.${var.aws_region}.workflows.allow-invoke-lambda"
  description = "Policy to allow step functions to invoke lambdas"
  policy      = file("policies/allow-invoke-lambda.json")
}

resource "aws_iam_policy" "allow_invoke_api_gateway" {
  name        = "${var.global_prefix}.${var.aws_region}.workflows.allow-invoke-api-gateway"
  description = "Policy to access APIGateway endpoints secured with AWS_IAM authentication"
  policy      = file("policies/allow-invoke-api-gateway.json")
}

#################################
#  aws_iam_role : iam_for_exec_lambda
#################################

resource "aws_iam_role" "iam_for_exec_lambda" {
  name               = format("${var.global_prefix}.${var.aws_region}.workflows.lambda_exec_role")
  assume_role_policy = file("policies/assume-role-lambda.json")
}

resource "aws_iam_role_policy_attachment" "role_policy_log" {
  role       = aws_iam_role.iam_for_exec_lambda.name
  policy_arn = aws_iam_policy.allow_full_logs.arn
}

resource "aws_iam_role_policy_attachment" "role_policy_S3" {
  role       = aws_iam_role.iam_for_exec_lambda.name
  policy_arn = aws_iam_policy.allow_full_s3.arn
}

resource "aws_iam_role_policy_attachment" "role_policy_steps" {
  role       = aws_iam_role.iam_for_exec_lambda.name
  policy_arn = aws_iam_policy.allow_full_step_functions.arn
}

resource "aws_iam_role_policy_attachment" "role_policy_api_gateway" {
  role       = aws_iam_role.iam_for_exec_lambda.name
  policy_arn = aws_iam_policy.allow_invoke_api_gateway.arn
}

#################################
#  aws_iam_role : iam_for_state_machine_execution
#################################

resource "aws_iam_role" "iam_for_state_machine_execution" {
  name               = format("${var.global_prefix}.${var.aws_region}.workflows.steps_exec_role")
  assume_role_policy = templatefile("policies/assume-role-step-functions.json", {
    aws_region = var.aws_region
  })
}

resource "aws_iam_role_policy_attachment" "role_policy_allow_steps_invoke_lambda" {
  role       = aws_iam_role.iam_for_state_machine_execution.name
  policy_arn = aws_iam_policy.allow_invoke_lambda.arn
}

#################################
#  Step Functions : Lambdas used in all workflows
#################################

resource "aws_lambda_function" "process_workflow_completion" {
  filename         = "../workflows/process-workflow-completion/build/dist/lambda.zip"
  function_name    = format("%.64s", "${var.global_prefix}-process-workflow-completion")
  role             = aws_iam_role.iam_for_exec_lambda.arn
  handler          = "index.handler"
  source_code_hash = filebase64sha256("../workflows/process-workflow-completion/build/dist/lambda.zip")
  runtime          = "nodejs10.x"
  timeout          = "900"
  memory_size      = "3008"

  environment {
    variables = {
      LogGroupName     = var.global_prefix
      ServicesUrl      = var.services_url
      ServicesAuthType = var.service_registry_auth_type
    }
  }
}

resource "aws_lambda_function" "process_workflow_failure" {
  filename         = "../workflows/process-workflow-failure/build/dist/lambda.zip"
  function_name    = format("%.64s", "${var.global_prefix}-process-workflow-failure")
  role             = aws_iam_role.iam_for_exec_lambda.arn
  handler          = "index.handler"
  source_code_hash = filebase64sha256("../workflows/process-workflow-failure/build/dist/lambda.zip")
  runtime          = "nodejs10.x"
  timeout          = "900"
  memory_size      = "3008"

  environment {
    variables = {
      LogGroupName     = var.global_prefix
      ServicesUrl      = var.services_url
      ServicesAuthType = var.service_registry_auth_type
    }
  }
}

#################################
#  Step Functions : Workflow activity callback handler
#################################

resource "aws_lambda_function" "workflow_activity_callback_handler" {
  filename         = "../workflows/workflow-activity-callback-handler/build/dist/lambda.zip"
  function_name    = format("%.64s", "${var.global_prefix}-workflow-activity-callback-handler")
  role             = aws_iam_role.iam_for_exec_lambda.arn
  handler          = "index.handler"
  source_code_hash = filebase64sha256("../workflows/workflow-activity-callback-handler/build/dist/lambda.zip")
  runtime          = "nodejs10.x"
  timeout          = "30"
  memory_size      = "3008"

  environment {
    variables = {
      LogGroupName = var.global_prefix
    }
  }
}

##############################
#  aws_api_gateway_rest_api:  workflow_activity_callback_handler
##############################
resource "aws_api_gateway_rest_api" "workflow_activity_callback_handler" {
  name        = "${var.global_prefix}-workflow-activity-callback-handler"
  description = "Workflow Activity Callback Rest Api"

  endpoint_configuration {
    types = ["REGIONAL"]
  }
}

resource "aws_api_gateway_resource" "workflow_activity_callback_handler_resource" {
  rest_api_id = aws_api_gateway_rest_api.workflow_activity_callback_handler.id
  parent_id   = aws_api_gateway_rest_api.workflow_activity_callback_handler.root_resource_id
  path_part   = "{proxy+}"
}

resource "aws_api_gateway_method" "workflow_activity_callback_handler_method" {
  rest_api_id   = aws_api_gateway_rest_api.workflow_activity_callback_handler.id
  resource_id   = aws_api_gateway_resource.workflow_activity_callback_handler_resource.id
  http_method   = "ANY"
  authorization = "AWS_IAM"
}

resource "aws_api_gateway_integration" "workflow_activity_callback_handler_method_integration" {
  rest_api_id             = aws_api_gateway_rest_api.workflow_activity_callback_handler.id
  resource_id             = aws_api_gateway_resource.workflow_activity_callback_handler_resource.id
  http_method             = aws_api_gateway_method.workflow_activity_callback_handler_method.http_method
  type                    = "AWS_PROXY"
  uri                     = "arn:aws:apigateway:${var.aws_region}:lambda:path/2015-03-31/functions/arn:aws:lambda:${var.aws_region}:${var.aws_account_id}:function:${aws_lambda_function.workflow_activity_callback_handler.function_name}/invocations"
  integration_http_method = "POST"
}

resource "aws_lambda_permission" "apigw_workflow_activity_callback_handler" {
  statement_id  = "AllowExecutionFromAPIGateway"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.workflow_activity_callback_handler.arn
  principal     = "apigateway.amazonaws.com"
  source_arn    = "arn:aws:execute-api:${var.aws_region}:${var.aws_account_id}:${aws_api_gateway_rest_api.workflow_activity_callback_handler.id}/*/${aws_api_gateway_method.workflow_activity_callback_handler_method.http_method}/*"
}

resource "aws_api_gateway_deployment" "workflow_activity_callback_handler_deployment" {
  depends_on = [aws_api_gateway_integration.workflow_activity_callback_handler_method_integration]

  rest_api_id = aws_api_gateway_rest_api.workflow_activity_callback_handler.id
  stage_name  = var.environment_type

  variables = {
    PublicUrl      = local.workflow_activity_callback_handler_url
    DeploymentHash = filesha256("./workflows/main.tf")
  }
}

locals {
  workflow_activity_callback_handler_url = "https://${aws_api_gateway_rest_api.workflow_activity_callback_handler.id}.execute-api.${var.aws_region}.amazonaws.com/${var.environment_type}/notifications"
}
