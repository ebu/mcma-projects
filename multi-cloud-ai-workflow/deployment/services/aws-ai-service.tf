#################################
#  aws_iam_role : aws_ai_service_lambda_execution
#################################

resource "aws_iam_role" "aws_ai_service_lambda_execution" {
  name               = format("%.64s", "${var.global_prefix}.${var.aws_region}.services.aws_ai.lambda-exec-role")
  assume_role_policy = file("policies/assume-role-lambda.json")
}

resource "aws_iam_role_policy_attachment" "aws_ai_service_allow_full_logs" {
  role       = aws_iam_role.aws_ai_service_lambda_execution.id
  policy_arn = aws_iam_policy.allow_full_logs.arn
}

resource "aws_iam_role_policy_attachment" "aws_ai_service_allow_full_dynamodb" {
  role       = aws_iam_role.aws_ai_service_lambda_execution.id
  policy_arn = aws_iam_policy.allow_full_dynamodb.arn
}

resource "aws_iam_role_policy_attachment" "aws_ai_service_allow_full_s3" {
  role       = aws_iam_role.aws_ai_service_lambda_execution.id
  policy_arn = aws_iam_policy.allow_full_s3.arn
}

resource "aws_iam_role_policy_attachment" "aws_ai_service_allow_invoke_lambda" {
  role       = aws_iam_role.aws_ai_service_lambda_execution.id
  policy_arn = "arn:aws:iam::aws:policy/AWSLambdaFullAccess"
}

resource "aws_iam_role_policy_attachment" "aws_ai_service_allow_invoke_api_gateway" {
  role       = aws_iam_role.aws_ai_service_lambda_execution.id
  policy_arn = aws_iam_policy.allow_invoke_api_gateway.arn
}

resource "aws_iam_role_policy_attachment" "aws_ai_service_allow_full_rekognition" {
  role       = aws_iam_role.aws_ai_service_lambda_execution.name
  policy_arn = "arn:aws:iam::aws:policy/AmazonRekognitionFullAccess"
}

resource "aws_iam_role_policy_attachment" "aws_ai_service_allow_full_transcribe" {
  role       = aws_iam_role.aws_ai_service_lambda_execution.name
  policy_arn = "arn:aws:iam::aws:policy/AmazonTranscribeFullAccess"
}

resource "aws_iam_role_policy_attachment" "aws_ai_service_allow_translate_only" {
  role       = aws_iam_role.aws_ai_service_lambda_execution.name
  policy_arn = "arn:aws:iam::aws:policy/TranslateReadOnly"
}

resource "aws_iam_role_policy_attachment" "aws_ai_service_allow_full_amazon_polly" {
  role       = aws_iam_role.aws_ai_service_lambda_execution.name
  policy_arn = "arn:aws:iam::aws:policy/AmazonPollyFullAccess"
}

##################################
#  aws_iam_role : aws_ai_service_reko_to_sns_execution
##################################

resource "aws_iam_role" "aws_ai_service_reko_to_sns_execution" {
  name = format("%.64s", "${var.global_prefix}.${var.aws_region}.services.aws_ai.reko_to_sns_role")

  assume_role_policy = file("policies/assume-role-rekognition.json")
}

resource "aws_iam_policy" "aws_ai_service_allow_reko_to_sns" {
  name        = format("%.64s", "${var.global_prefix}.${var.aws_region}.reko_to_sns_policy")
  description = "Policy for Reko to access SNS"

  policy = jsonencode({
    Version: "2012-10-17",
    Statement: [
      {
        Effect: "Allow",
        Action: "sns:Publish",
        Resource: aws_sns_topic.sns_topic_reko_output.arn
      }
    ]
  })
}

resource "aws_iam_role_policy_attachment" "aws_ai_service_allow_reko_to_sns" {
  role       = aws_iam_role.aws_ai_service_reko_to_sns_execution.name
  policy_arn = aws_iam_policy.aws_ai_service_allow_reko_to_sns.arn
}

resource "aws_iam_role_policy_attachment" "aws_ai_service_allow_reko_full_logs" {
  role       = aws_iam_role.aws_ai_service_reko_to_sns_execution.name
  policy_arn = aws_iam_policy.allow_full_logs.arn
}

#################################
#  aws_lambda_function : aws-ai-service-api-handler
#################################

resource "aws_lambda_function" "aws_ai_service_api_handler" {
  filename         = "../services/aws-ai-service/api-handler/build/dist/lambda.zip"
  function_name    = format("%.64s", "${var.global_prefix}-aws-ai-service-api-handler")
  role             = aws_iam_role.aws_ai_service_lambda_execution.arn
  handler          = "index.handler"
  source_code_hash = filebase64sha256("../services/aws-ai-service/api-handler/build/dist/lambda.zip")
  runtime          = "nodejs10.x"
  timeout          = "30"
  memory_size      = "3008"

  environment {
    variables = {
      LogGroupName = var.global_prefix
    }
  }
}

#################################
#  aws_lambda_function : aws-ai-service-s3-trigger
#################################

resource "aws_lambda_function" "aws_ai_service_s3_trigger" {
  filename         = "../services/aws-ai-service/s3-trigger/build/dist/lambda.zip"
  function_name    = format("%.64s", "${var.global_prefix}-aws-ai-service-s3-trigger")
  role             = aws_iam_role.aws_ai_service_lambda_execution.arn
  handler          = "index.handler"
  source_code_hash = filebase64sha256("../services/aws-ai-service/s3-trigger/build/dist/lambda.zip")
  runtime          = "nodejs10.x"
  timeout          = "900"
  memory_size      = "3008"

  environment {
    variables = {
      LogGroupName        = var.global_prefix
      TableName           = aws_dynamodb_table.aws_ai_service_table.name
      PublicUrl           = local.aws_ai_service_url
      ServicesUrl         = local.services_url
      ServicesAuthType    = local.service_registry_auth_type
      WorkerFunctionId    = aws_lambda_function.aws_ai_service_worker.function_name
      ServiceOutputBucket = aws_s3_bucket.aws_ai_service_output.id
    }
  }
}

resource "aws_s3_bucket" "aws_ai_service_output" {
  bucket        = "${var.environment_name}.${var.aws_region}.${var.environment_type}.aws-ai-service-output"
  acl           = "private"
  force_destroy = true
}

resource "aws_lambda_permission" "allow_bucket" {
  statement_id  = "AllowExecutionFromS3Bucket"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.aws_ai_service_s3_trigger.arn
  principal     = "s3.amazonaws.com"
  source_arn    = aws_s3_bucket.aws_ai_service_output.arn
}

resource "aws_s3_bucket_notification" "aws_ai_service_output_bucket_notification" {
  bucket = aws_s3_bucket.aws_ai_service_output.id

  lambda_function {
    lambda_function_arn = aws_lambda_function.aws_ai_service_s3_trigger.arn
    events              = ["s3:ObjectCreated:*"]
  }
}

#################################
#  aws_lambda_function : aws-ai-service-sns-trigger
#################################

resource "aws_lambda_function" "aws_ai_service_sns_trigger" {
  filename         = "../services/aws-ai-service/sns-trigger/build/dist/lambda.zip"
  function_name    = format("%.64s", "${var.global_prefix}-aws-ai-service-sns-trigger")
  role             = aws_iam_role.aws_ai_service_lambda_execution.arn
  handler          = "index.handler"
  source_code_hash = filebase64sha256("../services/aws-ai-service/sns-trigger/build/dist/lambda.zip")
  runtime          = "nodejs10.x"
  timeout          = "900"
  memory_size      = "3008"

  environment {
    variables = {
      LogGroupName        = var.global_prefix
      TableName           = aws_dynamodb_table.aws_ai_service_table.name
      PublicUrl           = local.aws_ai_service_url
      ServicesUrl         = local.services_url
      ServicesAuthType    = local.service_registry_auth_type
      WorkerFunctionId    = aws_lambda_function.aws_ai_service_worker.function_name
      ServiceOutputBucket = aws_s3_bucket.aws_ai_service_output.id
    }
  }
}

#################################
#  aws_lambda_function : aws-ai-service-worker
#################################

resource "aws_lambda_function" "aws_ai_service_worker" {
  filename         = "../services/aws-ai-service/worker/build/dist/lambda.zip"
  function_name    = format("%.64s", "${var.global_prefix}-aws-ai-service-worker")
  role             = aws_iam_role.aws_ai_service_lambda_execution.arn
  handler          = "index.handler"
  source_code_hash = filebase64sha256("../services/aws-ai-service/worker/build/dist/lambda.zip")
  runtime          = "nodejs10.x"
  timeout          = "900"
  memory_size      = "3008"

  environment {
    variables = {
      LogGroupName   = var.global_prefix
      RekoSnsRoleArn = aws_iam_role.aws_ai_service_reko_to_sns_execution.arn
      SnsTopicArn    = aws_sns_topic.sns_topic_reko_output.arn
    }
  }
}

##################################
# AI Rekognition  - SNS
##################################

resource "aws_sns_topic" "sns_topic_reko_output" {
  name = format("%.256s", "${var.global_prefix}-aws-ai-service")
}

resource "aws_lambda_permission" "aws_lambda_permission_with_sns" {
  statement_id  = "AllowExecutionFromSNS"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.aws_ai_service_sns_trigger.function_name
  principal     = "sns.amazonaws.com"
  source_arn    = aws_sns_topic.sns_topic_reko_output.arn
}

resource "aws_sns_topic_subscription" "aws_sns_topic_sub_lambda" {
  topic_arn = aws_sns_topic.sns_topic_reko_output.arn
  protocol  = "lambda"
  endpoint  = aws_lambda_function.aws_ai_service_sns_trigger.arn
}

##################################
# aws_dynamodb_table : aws_ai_service_table
##################################

resource "aws_dynamodb_table" "aws_ai_service_table" {
  name         = "${var.global_prefix}-aws-ai-service"
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
#  aws_api_gateway_rest_api:  aws_ai_service_api
##############################
resource "aws_api_gateway_rest_api" "aws_ai_service_api" {
  name        = "${var.global_prefix}-aws-ai-service"
  description = "AWS AI Service Rest Api"

  endpoint_configuration {
    types = ["REGIONAL"]
  }
}

resource "aws_api_gateway_resource" "aws_ai_service_api_resource" {
  rest_api_id = aws_api_gateway_rest_api.aws_ai_service_api.id
  parent_id   = aws_api_gateway_rest_api.aws_ai_service_api.root_resource_id
  path_part   = "{proxy+}"
}

resource "aws_api_gateway_method" "aws_ai_service_options_method" {
  rest_api_id   = aws_api_gateway_rest_api.aws_ai_service_api.id
  resource_id   = aws_api_gateway_resource.aws_ai_service_api_resource.id
  http_method   = "OPTIONS"
  authorization = "NONE"
}

resource "aws_api_gateway_method_response" "aws_ai_service_options_200" {
  rest_api_id = aws_api_gateway_rest_api.aws_ai_service_api.id
  resource_id = aws_api_gateway_resource.aws_ai_service_api_resource.id
  http_method = aws_api_gateway_method.aws_ai_service_options_method.http_method
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

resource "aws_api_gateway_integration" "aws_ai_service_options_integration" {
  rest_api_id = aws_api_gateway_rest_api.aws_ai_service_api.id
  resource_id = aws_api_gateway_resource.aws_ai_service_api_resource.id
  http_method = aws_api_gateway_method.aws_ai_service_options_method.http_method
  type        = "MOCK"

  request_templates = {
    "application/json" = "{ \"statusCode\": 200 }"
  }
}

resource "aws_api_gateway_integration_response" "aws_ai_service_options_integration_response" {
  rest_api_id = aws_api_gateway_rest_api.aws_ai_service_api.id
  resource_id = aws_api_gateway_resource.aws_ai_service_api_resource.id
  http_method = aws_api_gateway_method.aws_ai_service_options_method.http_method
  status_code = aws_api_gateway_method_response.aws_ai_service_options_200.status_code

  response_parameters = {
    "method.response.header.Access-Control-Allow-Headers" = "'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token'"
    "method.response.header.Access-Control-Allow-Methods" = "'GET,OPTIONS,POST,PUT,PATCH,DELETE'"
    "method.response.header.Access-Control-Allow-Origin"  = "'*'"
  }

  response_templates = {
    "application/json" = ""
  }
}

resource "aws_api_gateway_method" "aws_ai_service_api_method" {
  rest_api_id   = aws_api_gateway_rest_api.aws_ai_service_api.id
  resource_id   = aws_api_gateway_resource.aws_ai_service_api_resource.id
  http_method   = "ANY"
  authorization = "AWS_IAM"
}

resource "aws_api_gateway_integration" "aws_ai_service_api_method_integration" {
  rest_api_id             = aws_api_gateway_rest_api.aws_ai_service_api.id
  resource_id             = aws_api_gateway_resource.aws_ai_service_api_resource.id
  http_method             = aws_api_gateway_method.aws_ai_service_api_method.http_method
  type                    = "AWS_PROXY"
  uri                     = "arn:aws:apigateway:${var.aws_region}:lambda:path/2015-03-31/functions/arn:aws:lambda:${var.aws_region}:${var.aws_account_id}:function:${aws_lambda_function.aws_ai_service_api_handler.function_name}/invocations"
  integration_http_method = "POST"
}

resource "aws_lambda_permission" "apigw_aws_ai_service_api_handler" {
  statement_id  = "AllowExecutionFromAPIGateway"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.aws_ai_service_api_handler.arn
  principal     = "apigateway.amazonaws.com"
  source_arn    = "arn:aws:execute-api:${var.aws_region}:${var.aws_account_id}:${aws_api_gateway_rest_api.aws_ai_service_api.id}/*/${aws_api_gateway_method.aws_ai_service_api_method.http_method}/*"
}

resource "aws_api_gateway_deployment" "aws_ai_service_deployment" {
  depends_on = [
    aws_api_gateway_integration.aws_ai_service_api_method_integration,
    aws_api_gateway_integration.aws_ai_service_options_integration,
    aws_api_gateway_integration_response.aws_ai_service_options_integration_response,
  ]

  rest_api_id = aws_api_gateway_rest_api.aws_ai_service_api.id
}

resource "aws_api_gateway_stage" "aws_ai_service_gateway_stage" {
  depends_on = [
    aws_api_gateway_integration.aws_ai_service_api_method_integration,
    aws_api_gateway_integration.aws_ai_service_options_integration,
    aws_api_gateway_integration_response.aws_ai_service_options_integration_response,
  ]

  stage_name    = var.environment_type
  deployment_id = aws_api_gateway_deployment.aws_ai_service_deployment.id
  rest_api_id   = aws_api_gateway_rest_api.aws_ai_service_api.id

  variables = {
    TableName           = aws_dynamodb_table.aws_ai_service_table.name
    PublicUrl           = local.aws_ai_service_url
    ServicesUrl         = local.services_url
    ServicesAuthType    = local.service_registry_auth_type
    WorkerFunctionId    = aws_lambda_function.aws_ai_service_worker.function_name
    ServiceOutputBucket = aws_s3_bucket.aws_ai_service_output.id
    DeploymentHash      = filesha256("./services/aws-ai-service.tf")
  }
}

locals {
  aws_ai_service_url = "https://${aws_api_gateway_rest_api.aws_ai_service_api.id}.execute-api.${var.aws_region}.amazonaws.com/${var.environment_type}"
}
