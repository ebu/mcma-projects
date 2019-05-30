#########################
# Provider registration 
#########################

provider "aws" {
  version = "~> 2.7"

  access_key = "${var.aws_access_key}"
  secret_key = "${var.aws_secret_key}"
  region     = "${var.aws_region}"
}

#######################################
#  aws_iam_role : iam_for_exec_lambda
#######################################

resource "aws_iam_role" "iam_for_exec_lambda" {
  name               = "${format("%.64s", "${var.global_prefix}-lambda-exec-role")}"
  assume_role_policy = "${file("../../../policies/lambda-allow-assume-role.json")}"
}

resource "aws_iam_policy" "log_policy" {
  name        = "${var.global_prefix}-policy-log"
  description = "Policy to write to log"
  policy      = "${file("../../../policies/allow-full-logs.json")}"
}

resource "aws_iam_role_policy_attachment" "lambda_role_policy_log" {
  role       = "${aws_iam_role.iam_for_exec_lambda.name}"
  policy_arn = "${aws_iam_policy.log_policy.arn}"
}

resource "aws_iam_policy" "s3_policy" {
  name        = "${var.global_prefix}-policy-s3"
  description = "Policy to allow S3 access"
  policy      = "${file("../../../policies/allow-full-s3.json")}"
}

resource "aws_iam_role_policy_attachment" "lambda_role_policy_s3" {
  role       = "${aws_iam_role.iam_for_exec_lambda.name}"
  policy_arn = "${aws_iam_policy.s3_policy.arn}"
}

resource "aws_iam_policy" "apigateway_policy" {
  name        = "${var.global_prefix}-policy-apigateway"
  description = "Policy to allow invoking AWS4 secured Api gateway endpoints"
  policy      = "${file("../../../policies/allow-invoke-apigateway.json")}"
}

resource "aws_iam_role_policy_attachment" "role_policy_apigateway" {
  role       = "${aws_iam_role.iam_for_exec_lambda.name}"
  policy_arn = "${aws_iam_policy.apigateway_policy.arn}"
}

resource "aws_iam_policy" "states_policy" {
  name        = "${var.global_prefix}-policy-states"
  description = "Policy to allow accessing AWS Step function state machines"
  policy      = "${file("../../../policies/allow-full-states.json")}"
}

resource "aws_iam_role_policy_attachment" "lambda_role_policy_states" {
  role       = "${aws_iam_role.iam_for_exec_lambda.name}"
  policy_arn = "${aws_iam_policy.states_policy.arn}"
}

###################################################
#  aws_iam_role : iam_for_state_machine_execution
###################################################

data "template_file" "states_assume_role" {
  template = "${file("../../../policies/states-allow-assume-role.json")}"

  vars = {
    aws_region = "${var.aws_region}"
  }
}

resource "aws_iam_role" "iam_for_state_machine_execution" {
  name               = "${format("%.64s", "${var.global_prefix}-states-exec-role")}"
  assume_role_policy = "${data.template_file.states_assume_role.rendered}"
}

resource "aws_iam_policy" "lambda_policy" {
  name        = "${var.global_prefix}-policy-lambda"
  description = "Policy to allow invoking lambda functions"
  policy      = "${file("../../../policies/allow-invoke-lambda.json")}"
}

resource "aws_iam_role_policy_attachment" "states_role_policy_lambda" {
  role       = "${aws_iam_role.iam_for_state_machine_execution.name}"
  policy_arn = "${aws_iam_policy.lambda_policy.arn}"
}

#################################
#  Step Functions : Workflow activity callback handler
#################################

resource "aws_lambda_function" "workflow-activity-callback-handler" {
  filename         = "../activity-callback-handler/dist/lambda.zip"
  function_name    = "${format("%.64s", "${var.global_prefix}-activity-callback-handler")}"
  role             = "${aws_iam_role.iam_for_exec_lambda.arn}"
  handler          = "index.handler"
  source_code_hash = "${filebase64sha256("../activity-callback-handler/dist/lambda.zip")}"
  runtime          = "nodejs8.10"
  timeout          = "30"
  memory_size      = "256"
}

##############################
#  aws_api_gateway_rest_api:  workflow_activity_callback_handler
##############################
resource "aws_api_gateway_rest_api" "workflow_activity_callback_handler" {
  name        = "${var.global_prefix}-activity-callback-handler"
  description = "Workflow Activity Callback Rest Api"
}

resource "aws_api_gateway_resource" "workflow_activity_callback_handler_resource" {
  rest_api_id = "${aws_api_gateway_rest_api.workflow_activity_callback_handler.id}"
  parent_id   = "${aws_api_gateway_rest_api.workflow_activity_callback_handler.root_resource_id}"
  path_part   = "{proxy+}"
}

resource "aws_api_gateway_method" "workflow_activity_callback_handler_method" {
  rest_api_id   = "${aws_api_gateway_rest_api.workflow_activity_callback_handler.id}"
  resource_id   = "${aws_api_gateway_resource.workflow_activity_callback_handler_resource.id}"
  http_method   = "ANY"
  authorization = "NONE"
}

resource "aws_api_gateway_integration" "workflow_activity_callback_handler_method-integration" {
  rest_api_id             = "${aws_api_gateway_rest_api.workflow_activity_callback_handler.id}"
  resource_id             = "${aws_api_gateway_resource.workflow_activity_callback_handler_resource.id}"
  http_method             = "${aws_api_gateway_method.workflow_activity_callback_handler_method.http_method}"
  type                    = "AWS_PROXY"
  uri                     = "arn:aws:apigateway:${var.aws_region}:lambda:path/2015-03-31/functions/arn:aws:lambda:${var.aws_region}:${var.aws_account_id}:function:${aws_lambda_function.workflow-activity-callback-handler.function_name}/invocations"
  integration_http_method = "POST"
}

resource "aws_lambda_permission" "apigw_workflow-activity-callback-handler" {
  statement_id  = "AllowExecutionFromAPIGateway"
  action        = "lambda:InvokeFunction"
  function_name = "${aws_lambda_function.workflow-activity-callback-handler.arn}"
  principal     = "apigateway.amazonaws.com"
  source_arn = "arn:aws:execute-api:${var.aws_region}:${var.aws_account_id}:${aws_api_gateway_rest_api.workflow_activity_callback_handler.id}/*/${aws_api_gateway_method.workflow_activity_callback_handler_method.http_method}/*"
}

resource "aws_api_gateway_deployment" "workflow_activity_callback_handler_deployment" {
  depends_on = [
    "aws_api_gateway_method.workflow_activity_callback_handler_method",
    "aws_api_gateway_integration.workflow_activity_callback_handler_method-integration",
  ]

  rest_api_id = "${aws_api_gateway_rest_api.workflow_activity_callback_handler.id}"
  stage_name  = "${var.environment_type}"

  variables = {
    "PublicUrl"      = "${local.workflow_activity_callback_handler_url}"
    "DeploymentHash" = "${filesha256("main.tf")}"
  }
}

locals {
  workflow_activity_callback_handler_url = "https://${aws_api_gateway_rest_api.workflow_activity_callback_handler.id}.execute-api.${var.aws_region}.amazonaws.com/${var.environment_type}/notifications"
}


#################################
#  Step Functions : Lambdas used in steps of workflow
#################################

resource "aws_lambda_function" "process-workflow-completion" {
  filename         = "../10a-process-workflow-completion/dist/lambda.zip"
  function_name    = "${format("%.64s", "${var.global_prefix}-process-workflow-completion")}"
  role             = "${aws_iam_role.iam_for_exec_lambda.arn}"
  handler          = "index.handler"
  source_code_hash = "${filebase64sha256("../10a-process-workflow-completion/dist/lambda.zip")}"
  runtime          = "nodejs8.10"
  timeout          = "30"
  memory_size      = "256"

  environment {
    variables = {
      SERVICES_URL          = "${var.services_url}"
      SERVICES_AUTH_TYPE    = "${var.services_auth_type}"
      SERVICES_AUTH_CONTEXT = "${var.services_auth_context}"
    }
  }
}

resource "aws_lambda_function" "process-workflow-failure" {
  filename         = "../10b-process-workflow-failure/dist/lambda.zip"
  function_name    = "${format("%.64s", "${var.global_prefix}-process-workflow-failure")}"
  role             = "${aws_iam_role.iam_for_exec_lambda.arn}"
  handler          = "index.handler"
  source_code_hash = "${filebase64sha256("../10b-process-workflow-failure/dist/lambda.zip")}"
  runtime          = "nodejs8.10"
  timeout          = "30"
  memory_size      = "256"

  environment {
    variables = {
      SERVICES_URL          = "${var.services_url}"
      SERVICES_AUTH_TYPE    = "${var.services_auth_type}"
      SERVICES_AUTH_CONTEXT = "${var.services_auth_context}"
    }
  }
}

# #################################
# #  Step Functions : Lambdas for ai Workflow
# #################################

resource "aws_lambda_function" "ai-01-validate-workflow-input" {
  filename         = "../01-validate-workflow-input/dist/lambda.zip"
  function_name    = "${format("%.64s", "${var.global_prefix}-01-validate-workflow-input")}"
  role             = "${aws_iam_role.iam_for_exec_lambda.arn}"
  handler          = "index.handler"
  source_code_hash = "${filebase64sha256("../01-validate-workflow-input/dist/lambda.zip")}"
  runtime          = "nodejs8.10"
  timeout          = "60"
  memory_size      = "256"

  environment {
    variables = {
      SERVICES_URL          = "${var.services_url}"
      SERVICES_AUTH_TYPE    = "${var.services_auth_type}"
      SERVICES_AUTH_CONTEXT = "${var.services_auth_context}"
      REPOSITORY_BUCKET    = "${var.repository_bucket}"
      TEMP_BUCKET          = "${var.temp_bucket}"
      WEBSITE_BUCKET       = "${var.website_bucket}"
    }
  }
}

resource "aws_lambda_function" "ai-02-extract-speech-to-text" {
  filename         = "../02-extract-speech-to-text/dist/lambda.zip"
  function_name    = "${format("%.64s", "${var.global_prefix}-02-extract-speech-to-text")}"
  role             = "${aws_iam_role.iam_for_exec_lambda.arn}"
  handler          = "index.handler"
  source_code_hash = "${filebase64sha256("../02-extract-speech-to-text/dist/lambda.zip")}"
  runtime          = "nodejs8.10"
  timeout          = "60"
  memory_size      = "256"

  environment {
    variables = {
      SERVICES_URL          = "${var.services_url}"
      SERVICES_AUTH_TYPE    = "${var.services_auth_type}"
      SERVICES_AUTH_CONTEXT = "${var.services_auth_context}"
      REPOSITORY_BUCKET     = "${var.repository_bucket}"
      TEMP_BUCKET           = "${var.temp_bucket}"
      WEBSITE_BUCKET        = "${var.website_bucket}"
      ACTIVITY_CALLBACK_URL = "${local.workflow_activity_callback_handler_url}"
      ACTIVITY_ARN          = "${aws_sfn_activity.ai-02-extract-speech-to-text.id}"
    }
  }
}

resource "aws_sfn_activity" "ai-02-extract-speech-to-text" {
  name = "${format("%.80s", "${var.global_prefix}-02-extract-speech-to-text")}"
}

resource "aws_lambda_function" "ai-03-register-speech-to-text-output" {
  filename         = "../03-register-speech-to-text-output/dist/lambda.zip"
  function_name    = "${format("%.64s", "${var.global_prefix}-03-register-speech-to-text-output")}"
  role             = "${aws_iam_role.iam_for_exec_lambda.arn}"
  handler          = "index.handler"
  source_code_hash = "${filebase64sha256("../03-register-speech-to-text-output/dist/lambda.zip")}"
  runtime          = "nodejs8.10"
  timeout          = "60"
  memory_size      = "256"

  environment {
    variables = {
      SERVICES_URL          = "${var.services_url}"
      SERVICES_AUTH_TYPE    = "${var.services_auth_type}"
      SERVICES_AUTH_CONTEXT = "${var.services_auth_context}"
      REPOSITORY_BUCKET    = "${var.repository_bucket}"
      TEMP_BUCKET          = "${var.temp_bucket}"
      WEBSITE_BUCKET       = "${var.website_bucket}"
    }
  }
}

resource "aws_lambda_function" "ai-04-translate-speech-transcription" {
  filename         = "../04-translate-speech-transcription/dist/lambda.zip"
  function_name    = "${format("%.64s", "${var.global_prefix}-04-translate-speech-transcription")}"
  role             = "${aws_iam_role.iam_for_exec_lambda.arn}"
  handler          = "index.handler"
  source_code_hash = "${filebase64sha256("../04-translate-speech-transcription/dist/lambda.zip")}"
  runtime          = "nodejs8.10"
  timeout          = "60"
  memory_size      = "256"

  environment {
    variables = {
      SERVICES_URL          = "${var.services_url}"
      SERVICES_AUTH_TYPE    = "${var.services_auth_type}"
      SERVICES_AUTH_CONTEXT = "${var.services_auth_context}"
      REPOSITORY_BUCKET     = "${var.repository_bucket}"
      TEMP_BUCKET           = "${var.temp_bucket}"
      WEBSITE_BUCKET        = "${var.website_bucket}"
      ACTIVITY_CALLBACK_URL = "${local.workflow_activity_callback_handler_url}"
      ACTIVITY_ARN          = "${aws_sfn_activity.ai-04-translate-speech-transcription.id}"
    }
  }
}

resource "aws_sfn_activity" "ai-04-translate-speech-transcription" {
  name = "${format("%.80s", "${var.global_prefix}-04-translate-speech-transcription")}"
}

resource "aws_lambda_function" "ai-05-register-speech-translation" {
  filename         = "../05-register-speech-translation/dist/lambda.zip"
  function_name    = "${format("%.64s", "${var.global_prefix}-05-register-speech-translation")}"
  role             = "${aws_iam_role.iam_for_exec_lambda.arn}"
  handler          = "index.handler"
  source_code_hash = "${filebase64sha256("../05-register-speech-translation/dist/lambda.zip")}"
  runtime          = "nodejs8.10"
  timeout          = "60"
  memory_size      = "256"

  environment {
    variables = {
      SERVICES_URL          = "${var.services_url}"
      SERVICES_AUTH_TYPE    = "${var.services_auth_type}"
      SERVICES_AUTH_CONTEXT = "${var.services_auth_context}"
      REPOSITORY_BUCKET    = "${var.repository_bucket}"
      TEMP_BUCKET          = "${var.temp_bucket}"
      WEBSITE_BUCKET       = "${var.website_bucket}"
    }
  }
}

resource "aws_lambda_function" "ai-06-detect-celebrities-aws" {
  filename         = "../06-detect-celebrities-aws/dist/lambda.zip"
  function_name    = "${format("%.64s", "${var.global_prefix}-06-detect-celebrities-aws")}"
  role             = "${aws_iam_role.iam_for_exec_lambda.arn}"
  handler          = "index.handler"
  source_code_hash = "${filebase64sha256("../06-detect-celebrities-aws/dist/lambda.zip")}"
  runtime          = "nodejs8.10"
  timeout          = "60"
  memory_size      = "256"

  environment {
    variables = {
      SERVICES_URL          = "${var.services_url}"
      SERVICES_AUTH_TYPE    = "${var.services_auth_type}"
      SERVICES_AUTH_CONTEXT = "${var.services_auth_context}"
      REPOSITORY_BUCKET     = "${var.repository_bucket}"
      TEMP_BUCKET           = "${var.temp_bucket}"
      WEBSITE_BUCKET        = "${var.website_bucket}"
      ACTIVITY_CALLBACK_URL = "${local.workflow_activity_callback_handler_url}"
      ACTIVITY_ARN          = "${aws_sfn_activity.ai-06-detect-celebrities-aws.id}"
    }
  }
}

resource "aws_sfn_activity" "ai-06-detect-celebrities-aws" {
  name = "${format("%.80s", "${var.global_prefix}-06-detect-celebrities-aws")}"
}

resource "aws_lambda_function" "ai-08-detect-celebrities-azure" {
  filename         = "../08-detect-celebrities-azure/dist/lambda.zip"
  function_name    = "${format("%.64s", "${var.global_prefix}-08-detect-celebrities-azure")}"
  role             = "${aws_iam_role.iam_for_exec_lambda.arn}"
  handler          = "index.handler"
  source_code_hash = "${filebase64sha256("../08-detect-celebrities-azure/dist/lambda.zip")}"
  runtime          = "nodejs8.10"
  timeout          = "60"
  memory_size      = "256"

  environment {
    variables = {
      SERVICES_URL          = "${var.services_url}"
      SERVICES_AUTH_TYPE    = "${var.services_auth_type}"
      SERVICES_AUTH_CONTEXT = "${var.services_auth_context}"
      REPOSITORY_BUCKET     = "${var.repository_bucket}"
      TEMP_BUCKET           = "${var.temp_bucket}"
      WEBSITE_BUCKET        = "${var.website_bucket}"
      ACTIVITY_CALLBACK_URL = "${local.workflow_activity_callback_handler_url}"
      ACTIVITY_ARN          = "${aws_sfn_activity.ai-08-detect-celebrities-azure.id}"
    }
  }
}

resource "aws_sfn_activity" "ai-08-detect-celebrities-azure" {
  name = "${format("%.80s", "${var.global_prefix}-08-detect-celebrities-azure")}"
}

resource "aws_lambda_function" "ai-07-register-celebrities-info-aws" {
  filename         = "../07-register-celebrities-info-aws/dist/lambda.zip"
  function_name    = "${format("%.64s", "${var.global_prefix}-07-register-celebrities-info-aws")}"
  role             = "${aws_iam_role.iam_for_exec_lambda.arn}"
  handler          = "index.handler"
  source_code_hash = "${filebase64sha256("../07-register-celebrities-info-aws/dist/lambda.zip")}"
  runtime          = "nodejs8.10"
  timeout          = "60"
  memory_size      = "256"

  environment {
    variables = {
      SERVICES_URL          = "${var.services_url}"
      SERVICES_AUTH_TYPE    = "${var.services_auth_type}"
      SERVICES_AUTH_CONTEXT = "${var.services_auth_context}"
      REPOSITORY_BUCKET    = "${var.repository_bucket}"
      TEMP_BUCKET          = "${var.temp_bucket}"
      WEBSITE_BUCKET       = "${var.website_bucket}"
    }
  }
}

resource "aws_lambda_function" "ai-09-register-celebrities-info-azure" {
  filename         = "../09-register-celebrities-info-azure/dist/lambda.zip"
  function_name    = "${format("%.64s", "${var.global_prefix}-09-register-celebrities-info-azure")}"
  role             = "${aws_iam_role.iam_for_exec_lambda.arn}"
  handler          = "index.handler"
  source_code_hash = "${filebase64sha256("../09-register-celebrities-info-azure/dist/lambda.zip")}"
  runtime          = "nodejs8.10"
  timeout          = "60"
  memory_size      = "256"

  environment {
    variables = {
      SERVICES_URL          = "${var.services_url}"
      SERVICES_AUTH_TYPE    = "${var.services_auth_type}"
      SERVICES_AUTH_CONTEXT = "${var.services_auth_context}"
      REPOSITORY_BUCKET    = "${var.repository_bucket}"
      TEMP_BUCKET          = "${var.temp_bucket}"
      WEBSITE_BUCKET       = "${var.website_bucket}"
    }
  }
}

# #################################
# #  Step Functions : AI Workflow
# #################################

data "template_file" "ai-workflow" {
  template = "${file("state-machine.json")}"

  vars = {
    lambda-01-validate-workflow-input          = "${aws_lambda_function.ai-01-validate-workflow-input.arn}"
    lambda-02-extract-speech-to-text           = "${aws_lambda_function.ai-02-extract-speech-to-text.arn}"
    activity-02-extract-speech-to-text         = "${aws_sfn_activity.ai-02-extract-speech-to-text.id}"
    lambda-03-register-speech-to-text-output   = "${aws_lambda_function.ai-03-register-speech-to-text-output.arn}"
    lambda-04-translate-speech-transcription   = "${aws_lambda_function.ai-04-translate-speech-transcription.arn}"
    activity-04-translate-speech-transcription = "${aws_sfn_activity.ai-04-translate-speech-transcription.id}"
    lambda-05-register-speech-translation      = "${aws_lambda_function.ai-05-register-speech-translation.arn}"
    lambda-06-detect-celebrities-aws          = "${aws_lambda_function.ai-06-detect-celebrities-aws.arn}"
    activity-06-detect-celebrities-aws        = "${aws_sfn_activity.ai-06-detect-celebrities-aws.id}"
    lambda-08-detect-celebrities-azure        = "${aws_lambda_function.ai-08-detect-celebrities-azure.arn}"
    activity-08-detect-celebrities-azure      = "${aws_sfn_activity.ai-08-detect-celebrities-azure.id}"
    lambda-07-register-celebrities-info-aws   = "${aws_lambda_function.ai-07-register-celebrities-info-aws.arn}"
    lambda-09-register-celebrities-info-azure = "${aws_lambda_function.ai-09-register-celebrities-info-azure.arn}"
    lambda-process-workflow-completion         = "${aws_lambda_function.process-workflow-completion.arn}"
    lambda-process-workflow-failure            = "${aws_lambda_function.process-workflow-failure.arn}"
  }
}

resource "aws_sfn_state_machine" "ai-workflow" {
  name       = "${var.global_prefix}"
  role_arn   = "${aws_iam_role.iam_for_state_machine_execution.arn}"
  definition = "${data.template_file.ai-workflow.rendered}"
}

output "state_machine_arn" {
  value = "${aws_sfn_state_machine.ai-workflow.id}"
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
