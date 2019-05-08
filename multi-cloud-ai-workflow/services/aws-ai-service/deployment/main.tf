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
  name               = "${format("%.64s", "${var.global_prefix}.${var.aws_region}.aws-ai-service.lambda_exec_role")}"
  assume_role_policy = "${file("./../../../deployment/policies/lambda-assume-role.json")}"
}

resource "aws_iam_policy" "log_policy" {
  name        = "${var.global_prefix}.${var.aws_region}.aws-ai-service.policy_log"
  description = "Policy to write to log"
  policy      = "${file("./../../../deployment/policies/lambda-allow-log-write.json")}"
}

resource "aws_iam_role_policy_attachment" "role-policy-log" {
  role       = "${aws_iam_role.iam_for_exec_lambda.name}"
  policy_arn = "${aws_iam_policy.log_policy.arn}"
}

resource "aws_iam_policy" "DynamoDB_policy" {
  name        = "${var.global_prefix}.${var.aws_region}.aws-ai-service.policy_dynamodb"
  description = "Policy to Access DynamoDB"
  policy      = "${file("./../../../deployment/policies/lambda-allow-dynamodb-access.json")}"
}

resource "aws_iam_role_policy_attachment" "role-policy-DynamoDB" {
  role       = "${aws_iam_role.iam_for_exec_lambda.name}"
  policy_arn = "${aws_iam_policy.DynamoDB_policy.arn}"
}


##################################
# AI Rekognition  - Roles
##################################

# Allows Rekognition to call AWS services on your behalf
resource "aws_iam_role" "iam_role_Reko_to_SNS" {
  name = "${format("%.64s", "${var.global_prefix}.${var.aws_region}.services.reko_to_sns_role")}"

  assume_role_policy = <<EOF
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": {
        "Service": "rekognition.amazonaws.com"
      },
      "Action": "sts:AssumeRole",
      "Condition": {}
    }
  ]
}
EOF
}

resource "aws_iam_policy" "aws_iam_policy_Reko_to_SNS" {
  name        = "${format("%.64s", "${var.global_prefix}.${var.aws_region}.reko_to_sns_policy")}"
  description = "Policy for Reko to access SNS"

  policy = <<EOF
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Effect": "Allow",
            "Action": [
                "sns:Publish"
            ],
            "Resource": "arn:aws:sns:*:*:AmazonRekognition*"
        },
        {
            "Effect": "Allow",
            "Action": [
                "kinesis:PutRecord",
                "kinesis:PutRecords"
            ],
            "Resource": "arn:aws:kinesis:*:*:stream/AmazonRekognition*"
        },
        {
            "Effect": "Allow",
            "Action": [
                "kinesisvideo:GetDataEndpoint",
                "kinesisvideo:GetMedia"
            ],
            "Resource": "*"
        }
    ]
}
EOF
}

resource "aws_iam_policy" "rekognition_policy" {
  name        = "${format("%.64s", "${var.global_prefix}.${var.aws_region}.reko_policy")}"
  description = "Policy to Access rekognition"

  policy = <<EOF
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": "rekognition:*",
      "Resource": "*"
    }
  ]
}
EOF
}

resource "aws_iam_role_policy_attachment" "role-policy-rekognition" {
  role       = "${aws_iam_role.iam_for_exec_lambda.name}"
  policy_arn = "${aws_iam_policy.rekognition_policy.arn}"
}

resource "aws_iam_role_policy_attachment" "role-policy-reko-to-SNS" {
  role       = "${aws_iam_role.iam_role_Reko_to_SNS.name}"
  policy_arn = "${aws_iam_policy.aws_iam_policy_Reko_to_SNS.arn}"
}

resource "aws_iam_role_policy_attachment" "role-policy-log-reko-to-SNS" {
  role       = "${aws_iam_role.iam_role_Reko_to_SNS.name}"
  policy_arn = "${aws_iam_policy.log_policy.arn}"
}

resource "aws_iam_role_policy_attachment" "role-policy-rekognition-reko-to-SNS" {
  role       = "${aws_iam_role.iam_role_Reko_to_SNS.name}"
  policy_arn = "${aws_iam_policy.rekognition_policy.arn}"
}

resource "aws_iam_role_policy_attachment" "role-policy-lambda-full-access-reko-to-SNS" {
  role       = "${aws_iam_role.iam_role_Reko_to_SNS.name}"
  policy_arn = "arn:aws:iam::aws:policy/AWSLambdaFullAccess"
}

##################################
# aws_dynamodb_table : aws_ai_service_table
##################################

resource "aws_dynamodb_table" "aws_ai_service_table" {
  name           = "${var.global_prefix}-aws-ai-service"
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
#  aws_lambda_function : aws-ai-service-api-handler
#################################

resource "aws_lambda_function" "aws-ai-service-api-handler" {
  filename         = "./../api-handler/dist/lambda.zip"
  function_name    = "${format("%.64s", "${var.global_prefix}-aws-ai-service-api-handler")}"
  role             = "${aws_iam_role.iam_for_exec_lambda.arn}"
  handler          = "index.handler"
  source_code_hash = "${base64sha256(file("./../api-handler/dist/lambda.zip"))}"
  runtime          = "nodejs8.10"
  timeout          = "30"
  memory_size      = "256"
}

#################################
#  aws_lambda_function : aws-ai-service-s3-trigger
#################################

resource "aws_lambda_function" "aws-ai-service-s3-trigger" {
  filename         = "./../s3-trigger/dist/lambda.zip"
  function_name    = "${format("%.64s", "${var.global_prefix}-aws-ai-service-s3-trigger")}"
  role             = "${aws_iam_role.iam_for_exec_lambda.arn}"
  handler          = "index.handler"
  source_code_hash = "${base64sha256(file("./../s3-trigger/dist/lambda.zip"))}"
  runtime          = "nodejs8.10"
  timeout          = "30"
  memory_size      = "256"

  environment {
    variables = {
      "TableName"                = "${aws_dynamodb_table.aws_ai_service_table.name}"
      "PublicUrl"                = "${local.aws_ai_service_url}"
      "ServicesUrl"              = "${var.services_url}"
      "ServicesAuthType"         = "${var.services_auth_type}"
      "ServicesAuthContext"      = "${var.services_auth_context}"
      "WorkerLambdaFunctionName" = "${aws_lambda_function.aws-ai-service-worker.function_name}"
      "ServiceOutputBucket"      = "${aws_s3_bucket.aws-ai-service-output.id}"
    }
  }
}

resource "aws_s3_bucket" "aws-ai-service-output" {
  bucket        = "${var.environment_name}.${var.aws_region}.${var.environment_type}.aws-ai-service-output"
  acl           = "private"
  force_destroy = true
}

resource "aws_lambda_permission" "allow_bucket" {
  statement_id  = "AllowExecutionFromS3Bucket"
  action        = "lambda:InvokeFunction"
  function_name = "${aws_lambda_function.aws-ai-service-s3-trigger.arn}"
  principal     = "s3.amazonaws.com"
  source_arn    = "${aws_s3_bucket.aws-ai-service-output.arn}"
}

resource "aws_s3_bucket_notification" "aws-ai-service-output-bucket-notification" {
  bucket = "${aws_s3_bucket.aws-ai-service-output.id}"

  lambda_function {
    lambda_function_arn = "${aws_lambda_function.aws-ai-service-s3-trigger.arn}"
    events              = ["s3:ObjectCreated:*"]
    filter_suffix       = "json"
  }
}

#################################
#  aws_lambda_function : aws-ai-service-sns-trigger
#################################

resource "aws_lambda_function" "aws-ai-service-sns-trigger" {
  filename         = "./../sns-trigger/dist/lambda.zip"
  function_name    = "${format("%.64s", "${var.global_prefix}-aws-ai-service-sns-trigger")}"
  role             = "${aws_iam_role.iam_for_exec_lambda.arn}"
  handler          = "index.handler"
  source_code_hash = "${base64sha256(file("./../sns-trigger/dist/lambda.zip"))}"
  runtime          = "nodejs8.10"
  timeout          = "30"
  memory_size      = "256"

  environment {
    variables = {
      "TableName"                = "${aws_dynamodb_table.aws_ai_service_table.name}"
      "PublicUrl"                = "${local.aws_ai_service_url}"
      "ServicesUrl"              = "${var.services_url}"
      "ServicesAuthType"         = "${var.services_auth_type}"
      "ServicesAuthContext"      = "${var.services_auth_context}"
      "WorkerLambdaFunctionName" = "${aws_lambda_function.aws-ai-service-worker.function_name}"
      "ServiceOutputBucket"      = "${aws_s3_bucket.aws-ai-service-output.id}"
    }
  }
}

#################################
#  aws_lambda_function : aws-ai-service-worker
#################################

resource "aws_lambda_function" "aws-ai-service-worker" {
  filename         = "./../worker/dist/lambda.zip"
  function_name    = "${format("%.64s", "${var.global_prefix}-aws-ai-service-worker")}"
  role             = "${aws_iam_role.iam_for_exec_lambda.arn}"
  handler          = "index.handler"
  source_code_hash = "${base64sha256(file("./../worker/dist/lambda.zip"))}"
  runtime          = "nodejs8.10"
  timeout          = "300"
  memory_size      = "3008"

  environment {
    variables = {
      REKO_SNS_ROLE_ARN = "${aws_iam_role.iam_role_Reko_to_SNS.arn}"
      SNS_TOPIC_ARN     = "${aws_sns_topic.sns_topic_reko_output.arn}"
    }
  }
}


##################################
# AI Rekognition  - SNS
##################################

resource "aws_lambda_permission" "aws_lambda_permission_with_sns" {
  statement_id  = "AllowExecutionFromSNS"
  action        = "lambda:InvokeFunction"
  function_name = "${aws_lambda_function.aws-ai-service-sns-trigger.function_name}"
  principal     = "sns.amazonaws.com"
  source_arn    = "${aws_sns_topic.sns_topic_reko_output.arn}"
}

resource "aws_sns_topic" "sns_topic_reko_output" {
  name = "${format("%.256s", "AmazonRekognition_${var.global_prefix}_${var.aws_region}")}"
}

resource "aws_sns_topic_subscription" "aws_sns_topic_sub_lambda" {
  topic_arn = "${aws_sns_topic.sns_topic_reko_output.arn}"
  protocol  = "lambda"
  endpoint  = "${aws_lambda_function.aws-ai-service-sns-trigger.arn}"
}

resource "aws_iam_role" "aws_iam_role_sns_to_lambda" {
  name = "${format("%.64s", "${var.global_prefix}.${var.aws_region}.services.sns_to_lambda_role")}"

  assume_role_policy = <<EOF
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Action": "sts:AssumeRole",
      "Principal": {
        "Service": "lambda.amazonaws.com"
      },
      "Effect": "Allow",
      "Sid": ""
    }
  ]
}
EOF
}

resource "aws_iam_role_policy_attachment" "role-policy-SNS-to-Lambda" {
  role       = "${aws_iam_role.aws_iam_role_sns_to_lambda.name}"
  policy_arn = "${aws_iam_policy.aws_iam_policy_Reko_to_SNS.arn}"
}

resource "aws_iam_role_policy_attachment" "role-policy-log-SNS-to-Lambda" {
  role       = "${aws_iam_role.aws_iam_role_sns_to_lambda.name}"
  policy_arn = "${aws_iam_policy.log_policy.arn}"
}

resource "aws_iam_role_policy_attachment" "role-policy-rekognition-SNS-to-Lambda" {
  role       = "${aws_iam_role.aws_iam_role_sns_to_lambda.name}"
  policy_arn = "${aws_iam_policy.rekognition_policy.arn}"
}

resource "aws_iam_role_policy_attachment" "role-policy-DynamoDB-SNS-to-Lambda" {
  role       = "${aws_iam_role.aws_iam_role_sns_to_lambda.name}"
  policy_arn = "${aws_iam_policy.DynamoDB_policy.arn}"
}

resource "aws_iam_role_policy_attachment" "role-policy-lambda-full-access-SNS-to-Lambda" {
  role       = "${aws_iam_role.aws_iam_role_sns_to_lambda.name}"
  policy_arn = "arn:aws:iam::aws:policy/AWSLambdaFullAccess"
}


##############################
#  aws_api_gateway_rest_api:  aws_ai_service_api
##############################
resource "aws_api_gateway_rest_api" "aws_ai_service_api" {
  name        = "${var.global_prefix}-aws-ai-service"
  description = "AWS AI Service Rest Api"
}

resource "aws_api_gateway_resource" "aws_ai_service_api_resource" {
  rest_api_id = "${aws_api_gateway_rest_api.aws_ai_service_api.id}"
  parent_id   = "${aws_api_gateway_rest_api.aws_ai_service_api.root_resource_id}"
  path_part   = "{proxy+}"
}


resource "aws_api_gateway_method" "aws_ai_service_options_method" {
  rest_api_id   = "${aws_api_gateway_rest_api.aws_ai_service_api.id}"
  resource_id   = "${aws_api_gateway_resource.aws_ai_service_api_resource.id}"
  http_method   = "OPTIONS"
  authorization = "NONE"
}

resource "aws_api_gateway_method_response" "aws_ai_service_options_200" {
  rest_api_id = "${aws_api_gateway_rest_api.aws_ai_service_api.id}"
  resource_id = "${aws_api_gateway_resource.aws_ai_service_api_resource.id}"
  http_method = "${aws_api_gateway_method.aws_ai_service_options_method.http_method}"
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
  rest_api_id = "${aws_api_gateway_rest_api.aws_ai_service_api.id}"
  resource_id = "${aws_api_gateway_resource.aws_ai_service_api_resource.id}"
  http_method = "${aws_api_gateway_method.aws_ai_service_options_method.http_method}"
  type        = "MOCK"

  request_templates = {
    "application/json" = "{ \"statusCode\": 200 }"
  }
}

resource "aws_api_gateway_integration_response" "aws_ai_service_options_integration_response" {
  rest_api_id = "${aws_api_gateway_rest_api.aws_ai_service_api.id}"
  resource_id = "${aws_api_gateway_resource.aws_ai_service_api_resource.id}"
  http_method = "${aws_api_gateway_method.aws_ai_service_options_method.http_method}"
  status_code = "${aws_api_gateway_method_response.aws_ai_service_options_200.status_code}"

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
  rest_api_id   = "${aws_api_gateway_rest_api.aws_ai_service_api.id}"
  resource_id   = "${aws_api_gateway_resource.aws_ai_service_api_resource.id}"
  http_method   = "ANY"
  authorization = "AWS_IAM"
}

resource "aws_api_gateway_integration" "aws_ai_service_api_method-integration" {
  rest_api_id             = "${aws_api_gateway_rest_api.aws_ai_service_api.id}"
  resource_id             = "${aws_api_gateway_resource.aws_ai_service_api_resource.id}"
  http_method             = "${aws_api_gateway_method.aws_ai_service_api_method.http_method}"
  type                    = "AWS_PROXY"
  uri                     = "arn:aws:apigateway:${var.aws_region}:lambda:path/2015-03-31/functions/arn:aws:lambda:${var.aws_region}:${var.aws_account_id}:function:${aws_lambda_function.aws-ai-service-api-handler.function_name}/invocations"
  integration_http_method = "POST"
}

resource "aws_lambda_permission" "apigw_aws-ai-service-api-handler" {
  statement_id  = "AllowExecutionFromAPIGateway"
  action        = "lambda:InvokeFunction"
  function_name = "${aws_lambda_function.aws-ai-service-api-handler.arn}"
  principal     = "apigateway.amazonaws.com"
  source_arn = "arn:aws:execute-api:${var.aws_region}:${var.aws_account_id}:${aws_api_gateway_rest_api.aws_ai_service_api.id}/*/${aws_api_gateway_method.aws_ai_service_api_method.http_method}/*"
}

resource "aws_api_gateway_deployment" "aws_ai_service_deployment" {
  depends_on = [
    "aws_api_gateway_method.aws_ai_service_api_method",
    "aws_api_gateway_integration.aws_ai_service_api_method-integration",
  ]

  rest_api_id = "${aws_api_gateway_rest_api.aws_ai_service_api.id}"
  stage_name  = "${var.environment_type}"

  variables = {
    "TableName"                = "${aws_dynamodb_table.aws_ai_service_table.name}"
    "PublicUrl"                = "${local.aws_ai_service_url}"
    "ServicesUrl"              = "${var.services_url}"
    "ServicesAuthType"         = "${var.services_auth_type}"
    "ServicesAuthContext"      = "${var.services_auth_context}"
    "WorkerLambdaFunctionName" = "${aws_lambda_function.aws-ai-service-worker.function_name}"
    "ServiceOutputBucket"      = "${aws_s3_bucket.aws-ai-service-output.id}"
    "DeploymentHash"           = "${sha256(file("main.tf"))}"
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

output "aws_ai_service_url" {
  value = "${local.aws_ai_service_url}"
}

output "aws_ai_service_auth_type" {
  value = "AWS4"
}

# output "aws_ai_service_auth_context" {
#   value = ""
# }

locals {
  aws_ai_service_url = "https://${aws_api_gateway_rest_api.aws_ai_service_api.id}.execute-api.${var.aws_region}.amazonaws.com/${var.environment_type}"
}
