#################################
#  aws_iam_role : job_processor_lambda_execution
#################################

resource "aws_iam_role" "job_processor_lambda_execution" {
  name               = format("%.64s", "${var.global_prefix}.${var.aws_region}.services.job-processor.lambda-exec-role")
  assume_role_policy = file("policies/assume-role-lambda.json")
}

resource "aws_iam_role_policy_attachment" "job_processor_allow_full_logs" {
  role       = aws_iam_role.job_processor_lambda_execution.id
  policy_arn = aws_iam_policy.allow_full_logs.arn
}

resource "aws_iam_role_policy_attachment" "job_processor_allow_full_dynamodb" {
  role       = aws_iam_role.job_processor_lambda_execution.id
  policy_arn = aws_iam_policy.allow_full_dynamodb.arn
}

resource "aws_iam_role_policy_attachment" "job_processor_allow_invoke_lambda" {
  role       = aws_iam_role.job_processor_lambda_execution.id
  policy_arn = aws_iam_policy.allow_invoke_lambda.arn
}

resource "aws_iam_role_policy_attachment" "job_processor_allow_invoke_api_gateway" {
  role       = aws_iam_role.job_processor_lambda_execution.id
  policy_arn = aws_iam_policy.allow_invoke_api_gateway.arn
}

resource "aws_iam_role_policy_attachment" "job_processor_allow_full_events" {
  role       = aws_iam_role.job_processor_lambda_execution.id
  policy_arn = aws_iam_policy.allow_full_events.arn
}

#################################
#  aws_lambda_function : job_processor_api_handler
#################################

resource "aws_lambda_function" "job_processor_api_handler" {
  filename         = "../services/job-processor/api-handler/build/dist/lambda.zip"
  function_name    = format("%.64s", "${var.global_prefix}-job-processor-api-handler")
  role             = aws_iam_role.job_processor_lambda_execution.arn
  handler          = "index.handler"
  source_code_hash = filebase64sha256("../services/job-processor/api-handler/build/dist/lambda.zip")
  runtime          = "nodejs10.x"
  timeout          = "30"
  memory_size      = "3008"

  environment {
    variables = {
      LogGroupName     = var.log_group.name
      TableName        = aws_dynamodb_table.job_processor_table.name
      PublicUrl        = local.job_processor_url
      WorkerFunctionId = aws_lambda_function.job_processor_worker.function_name
    }
  }
}

#################################
#  aws_lambda_function : job_processor_periodic_job_checker
#################################

resource "aws_lambda_function" "job_processor_periodic_job_checker" {
  filename         = "../services/job-processor/periodic-job-checker/build/dist/lambda.zip"
  function_name    = format("%.64s", "${var.global_prefix}-job-processor-periodic-job-checker")
  role             = aws_iam_role.job_processor_lambda_execution.arn
  handler          = "index.handler"
  source_code_hash = filebase64sha256("../services/job-processor/periodic-job-checker/build/dist/lambda.zip")
  runtime          = "nodejs10.x"
  timeout          = "900"
  memory_size      = "3008"

  environment {
    variables = {
      LogGroupName               = var.log_group.name
      TableName                  = aws_dynamodb_table.job_processor_table.name
      PublicUrl                  = local.job_processor_url
      ServicesUrl                = local.services_url
      ServicesAuthType           = local.service_registry_auth_type
      CloudwatchEventRule        = aws_cloudwatch_event_rule.job_processor_periodic_job_checker_trigger.name,
      DefaultJobTimeoutInMinutes = var.job_processor_default_job_timeout_in_minutes
      WorkerFunctionId           = aws_lambda_function.job_processor_worker.function_name
    }
  }
}

resource "aws_cloudwatch_event_rule" "job_processor_periodic_job_checker_trigger" {
  name                = format("%.64s", "${var.global_prefix}-job-processor-periodic-job-checker-trigger")
  schedule_expression = "cron(* * * * ? *)"
  is_enabled          = true
}

resource "aws_lambda_permission" "job_processor_periodic_job_checker_trigger" {
  statement_id  = "AllowInvocationFromCloudWatch"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.job_processor_periodic_job_checker.arn
  principal     = "events.amazonaws.com"
  source_arn    = aws_cloudwatch_event_rule.job_processor_periodic_job_checker_trigger.arn
}

resource "aws_cloudwatch_event_target" "job_processor_periodic_job_checker_trigger" {
  arn  = aws_lambda_function.job_processor_periodic_job_checker.arn
  rule = aws_cloudwatch_event_rule.job_processor_periodic_job_checker_trigger.name
}

#################################
#  aws_lambda_function : job_processor_periodic_job_cleanup
#################################

resource "aws_lambda_function" "job_processor_periodic_job_cleanup" {
  filename         = "../services/job-processor/periodic-job-cleanup/build/dist/lambda.zip"
  function_name    = format("%.64s", "${var.global_prefix}-job-processor-periodic-job-cleanup")
  role             = aws_iam_role.job_processor_lambda_execution.arn
  handler          = "index.handler"
  source_code_hash = filebase64sha256("../services/job-processor/periodic-job-cleanup/build/dist/lambda.zip")
  runtime          = "nodejs10.x"
  timeout          = "900"
  memory_size      = "3008"

  environment {
    variables = {
      LogGroupName             = var.log_group.name
      TableName                = aws_dynamodb_table.job_processor_table.name
      PublicUrl                = local.job_processor_url
      ServicesUrl              = local.services_url
      ServicesAuthType         = local.service_registry_auth_type
      JobRetentionPeriodInDays = var.job_processor_job_retention_period_in_days
      WorkerFunctionId         = aws_lambda_function.job_processor_worker.function_name
    }
  }
}

resource "aws_cloudwatch_event_rule" "job_processor_periodic_job_cleanup_trigger" {
  name                = format("%.64s", "${var.global_prefix}-job-processor-periodic-job-cleanup-trigger")
  schedule_expression = "cron(0 0 * * ? *)"
  is_enabled          = true
}

resource "aws_lambda_permission" "job_processor_periodic_job_cleanup_trigger" {
  statement_id  = "AllowInvocationFromCloudWatch"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.job_processor_periodic_job_cleanup.arn
  principal     = "events.amazonaws.com"
  source_arn    = aws_cloudwatch_event_rule.job_processor_periodic_job_cleanup_trigger.arn
}

resource "aws_cloudwatch_event_target" "job_processor_periodic_job_cleanup_trigger" {
  arn  = aws_lambda_function.job_processor_periodic_job_cleanup.arn
  rule = aws_cloudwatch_event_rule.job_processor_periodic_job_cleanup_trigger.name
}

#################################
#  aws_lambda_function : job_processor_worker
#################################

resource "aws_lambda_function" "job_processor_worker" {
  filename         = "../services/job-processor/worker/build/dist/lambda.zip"
  function_name    = format("%.64s", "${var.global_prefix}-job-processor-worker")
  role             = aws_iam_role.job_processor_lambda_execution.arn
  handler          = "index.handler"
  source_code_hash = filebase64sha256("../services/job-processor/worker/build/dist/lambda.zip")
  runtime          = "nodejs10.x"
  timeout          = "900"
  memory_size      = "3008"

  environment {
    variables = {
      LogGroupName        = var.log_group.name
      TableName           = aws_dynamodb_table.job_processor_table.name
      PublicUrl           = local.job_processor_url
      CloudwatchEventRule = aws_cloudwatch_event_rule.job_processor_periodic_job_checker_trigger.name,
    }
  }
}

##################################
# aws_dynamodb_table : job_processor_table
##################################

resource "aws_dynamodb_table" "job_processor_table" {
  name         = "${var.global_prefix}-job-processor"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "resource_pkey"
  range_key    = "resource_id"

  attribute {
    name = "resource_pkey"
    type = "S"
  }

  attribute {
    name = "resource_id"
    type = "S"
  }

  attribute {
    name = "resource_status"
    type = "S"
  }

  attribute {
    name = "resource_created"
    type = "N"
  }

  global_secondary_index {
    name            = "ResourceCreatedIndex"
    hash_key        = "resource_pkey"
    range_key       = "resource_created"
    projection_type = "ALL"
  }

  global_secondary_index {
    name            = "ResourceStatusIndex"
    hash_key        = "resource_status"
    range_key       = "resource_created"
    projection_type = "ALL"
  }
}

##############################
#  aws_api_gateway_rest_api:  job_processor_api
##############################
resource "aws_api_gateway_rest_api" "job_processor_api" {
  name        = "${var.global_prefix}-job-processor"
  description = "Job Processor Rest Api"

  endpoint_configuration {
    types = ["REGIONAL"]
  }
}

resource "aws_api_gateway_resource" "job_processor_api_resource" {
  rest_api_id = aws_api_gateway_rest_api.job_processor_api.id
  parent_id   = aws_api_gateway_rest_api.job_processor_api.root_resource_id
  path_part   = "{proxy+}"
}

resource "aws_api_gateway_method" "job_processor_options_method" {
  rest_api_id   = aws_api_gateway_rest_api.job_processor_api.id
  resource_id   = aws_api_gateway_resource.job_processor_api_resource.id
  http_method   = "OPTIONS"
  authorization = "NONE"
}

resource "aws_api_gateway_method_response" "job_processor_options_200" {
  rest_api_id = aws_api_gateway_rest_api.job_processor_api.id
  resource_id = aws_api_gateway_resource.job_processor_api_resource.id
  http_method = aws_api_gateway_method.job_processor_options_method.http_method
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

resource "aws_api_gateway_integration" "job_processor_options_integration" {
  rest_api_id = aws_api_gateway_rest_api.job_processor_api.id
  resource_id = aws_api_gateway_resource.job_processor_api_resource.id
  http_method = aws_api_gateway_method.job_processor_options_method.http_method
  type        = "MOCK"

  request_templates = {
    "application/json" = "{ \"statusCode\": 200 }"
  }
}

resource "aws_api_gateway_integration_response" "job_processor_options_integration_response" {
  rest_api_id = aws_api_gateway_rest_api.job_processor_api.id
  resource_id = aws_api_gateway_resource.job_processor_api_resource.id
  http_method = aws_api_gateway_method.job_processor_options_method.http_method
  status_code = aws_api_gateway_method_response.job_processor_options_200.status_code

  response_parameters = {
    "method.response.header.Access-Control-Allow-Headers" = "'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token'"
    "method.response.header.Access-Control-Allow-Methods" = "'GET,OPTIONS,POST,PUT,PATCH,DELETE'"
    "method.response.header.Access-Control-Allow-Origin"  = "'*'"
  }

  response_templates = {
    "application/json" = ""
  }
}

resource "aws_api_gateway_method" "job_processor_api_method" {
  rest_api_id   = aws_api_gateway_rest_api.job_processor_api.id
  resource_id   = aws_api_gateway_resource.job_processor_api_resource.id
  http_method   = "ANY"
  authorization = "AWS_IAM"
}

resource "aws_api_gateway_integration" "job_processor_api_method_integration" {
  rest_api_id             = aws_api_gateway_rest_api.job_processor_api.id
  resource_id             = aws_api_gateway_resource.job_processor_api_resource.id
  http_method             = aws_api_gateway_method.job_processor_api_method.http_method
  type                    = "AWS_PROXY"
  uri                     = "arn:aws:apigateway:${var.aws_region}:lambda:path/2015-03-31/functions/arn:aws:lambda:${var.aws_region}:${var.aws_account_id}:function:${aws_lambda_function.job_processor_api_handler.function_name}/invocations"
  integration_http_method = "POST"
}

resource "aws_lambda_permission" "apigw_job_processor_api_handler" {
  statement_id  = "AllowExecutionFromAPIGateway"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.job_processor_api_handler.arn
  principal     = "apigateway.amazonaws.com"
  source_arn    = "arn:aws:execute-api:${var.aws_region}:${var.aws_account_id}:${aws_api_gateway_rest_api.job_processor_api.id}/*/${aws_api_gateway_method.job_processor_api_method.http_method}/*"
}

resource "aws_api_gateway_deployment" "job_processor_deployment" {
  depends_on = [
    aws_api_gateway_integration.job_processor_api_method_integration,
    aws_api_gateway_integration.job_processor_options_integration,
    aws_api_gateway_integration_response.job_processor_options_integration_response,
  ]

  rest_api_id = aws_api_gateway_rest_api.job_processor_api.id
}

resource "aws_api_gateway_stage" "job_processor_gateway_stage" {
  depends_on = [
    aws_api_gateway_integration.job_processor_api_method_integration,
    aws_api_gateway_integration.job_processor_options_integration,
    aws_api_gateway_integration_response.job_processor_options_integration_response,
  ]

  stage_name    = var.environment_type
  deployment_id = aws_api_gateway_deployment.job_processor_deployment.id
  rest_api_id   = aws_api_gateway_rest_api.job_processor_api.id

  variables = {
    TableName        = aws_dynamodb_table.job_processor_table.name
    PublicUrl        = local.job_processor_url
    ServicesUrl      = local.services_url
    ServicesAuthType = local.service_registry_auth_type
    WorkerFunctionId = aws_lambda_function.job_processor_worker.function_name
    DeploymentHash   = filesha256("./services/job-processor.tf")
  }
}

locals {
  job_processor_url = "https://${aws_api_gateway_rest_api.job_processor_api.id}.execute-api.${var.aws_region}.amazonaws.com/${var.environment_type}"
}
