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

resource "aws_iam_role_policy_attachment" "role_policy_log" {
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

resource "aws_iam_role_policy_attachment" "role_policy_states" {
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
  source_arn    = "arn:aws:execute-api:${var.aws_region}:${var.aws_account_id}:${aws_api_gateway_rest_api.workflow_activity_callback_handler.id}/*/${aws_api_gateway_method.workflow_activity_callback_handler_method.http_method}/*"
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
  filename         = "../12a-process-workflow-completion/dist/lambda.zip"
  function_name    = "${format("%.64s", "${var.global_prefix}-process-completion")}"
  role             = "${aws_iam_role.iam_for_exec_lambda.arn}"
  handler          = "index.handler"
  source_code_hash = "${filebase64sha256("../12a-process-workflow-completion/dist/lambda.zip")}"
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
  filename         = "../12b-process-workflow-failure/dist/lambda.zip"
  function_name    = "${format("%.64s", "${var.global_prefix}-process-failure")}"
  role             = "${aws_iam_role.iam_for_exec_lambda.arn}"
  handler          = "index.handler"
  source_code_hash = "${filebase64sha256("../12b-process-workflow-failure/dist/lambda.zip")}"
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

#################################
#  Step Functions : Lambdas for conform Workflow
#################################

resource "aws_lambda_function" "conform-01-validate-workflow-input" {
  filename         = "../01-validate-workflow-input/dist/lambda.zip"
  function_name    = "${format("%.64s", "${var.global_prefix}-01-validate-workflow-input")}"
  role             = "${aws_iam_role.iam_for_exec_lambda.arn}"
  handler          = "index.handler"
  source_code_hash = "${filebase64sha256("../01-validate-workflow-input/dist/lambda.zip")}"
  runtime          = "nodejs8.10"
  timeout          = "30"
  memory_size      = "256"

  environment {
    variables = {
      SERVICES_URL          = "${var.services_url}"
      SERVICES_AUTH_TYPE    = "${var.services_auth_type}"
      SERVICES_AUTH_CONTEXT = "${var.services_auth_context}"
      REPOSITORY_BUCKET     = "${var.repository_bucket}"
      TEMP_BUCKET           = "${var.temp_bucket}"
      WEBSITE_BUCKET        = "${var.website_bucket}"
    }
  }
}

resource "aws_lambda_function" "conform-02-move-content-to-file-repository" {
  filename         = "../02-move-content-to-file-repository/dist/lambda.zip"
  function_name    = "${format("%.64s", "${var.global_prefix}-02-move-content-to-file-repository")}"
  role             = "${aws_iam_role.iam_for_exec_lambda.arn}"
  handler          = "index.handler"
  source_code_hash = "${filebase64sha256("../02-move-content-to-file-repository/dist/lambda.zip")}"
  runtime          = "nodejs8.10"
  timeout          = "30"
  memory_size      = "256"

  environment {
    variables = {
      SERVICES_URL          = "${var.services_url}"
      SERVICES_AUTH_TYPE    = "${var.services_auth_type}"
      SERVICES_AUTH_CONTEXT = "${var.services_auth_context}"
      REPOSITORY_BUCKET     = "${var.repository_bucket}"
      TEMP_BUCKET           = "${var.temp_bucket}"
      WEBSITE_BUCKET        = "${var.website_bucket}"
    }
  }
}

resource "aws_lambda_function" "conform-03-create-media-asset" {
  filename         = "../03-create-media-asset/dist/lambda.zip"
  function_name    = "${format("%.64s", "${var.global_prefix}-03-create-media-asset")}"
  role             = "${aws_iam_role.iam_for_exec_lambda.arn}"
  handler          = "index.handler"
  source_code_hash = "${filebase64sha256("../03-create-media-asset/dist/lambda.zip")}"
  runtime          = "nodejs8.10"
  timeout          = "30"
  memory_size      = "256"

  environment {
    variables = {
      SERVICES_URL          = "${var.services_url}"
      SERVICES_AUTH_TYPE    = "${var.services_auth_type}"
      SERVICES_AUTH_CONTEXT = "${var.services_auth_context}"
      REPOSITORY_BUCKET     = "${var.repository_bucket}"
      TEMP_BUCKET           = "${var.temp_bucket}"
      WEBSITE_BUCKET        = "${var.website_bucket}"
    }
  }
}

resource "aws_lambda_function" "conform-04-extract-technical-metadata" {
  filename         = "../04-extract-technical-metadata/dist/lambda.zip"
  function_name    = "${format("%.64s", "${var.global_prefix}-04-extract-technical-metadata")}"
  role             = "${aws_iam_role.iam_for_exec_lambda.arn}"
  handler          = "index.handler"
  source_code_hash = "${filebase64sha256("../04-extract-technical-metadata/dist/lambda.zip")}"
  runtime          = "nodejs8.10"
  timeout          = "30"
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
      ACTIVITY_ARN          = "${aws_sfn_activity.conform-04-extract-technical-metadata.id}"
    }
  }
}

resource "aws_sfn_activity" "conform-04-extract-technical-metadata" {
  name = "${format("%.80s", "${var.global_prefix}-04-extract-technical-metadata")}"
}

resource "aws_lambda_function" "conform-05-register-technical-metadata" {
  filename         = "../05-register-technical-metadata/dist/lambda.zip"
  function_name    = "${format("%.64s", "${var.global_prefix}-05-register-technical-metadata")}"
  role             = "${aws_iam_role.iam_for_exec_lambda.arn}"
  handler          = "index.handler"
  source_code_hash = "${filebase64sha256("../05-register-technical-metadata/dist/lambda.zip")}"
  runtime          = "nodejs8.10"
  timeout          = "30"
  memory_size      = "256"

  environment {
    variables = {
      SERVICES_URL          = "${var.services_url}"
      SERVICES_AUTH_TYPE    = "${var.services_auth_type}"
      SERVICES_AUTH_CONTEXT = "${var.services_auth_context}"
      REPOSITORY_BUCKET     = "${var.repository_bucket}"
      TEMP_BUCKET           = "${var.temp_bucket}"
      WEBSITE_BUCKET        = "${var.website_bucket}"
    }
  }
}

resource "aws_lambda_function" "conform-06-decide-transcode-requirements" {
  filename         = "../06-decide-transcode-requirements/dist/lambda.zip"
  function_name    = "${format("%.64s", "${var.global_prefix}-06-decide-transcode-requirements")}"
  role             = "${aws_iam_role.iam_for_exec_lambda.arn}"
  handler          = "index.handler"
  source_code_hash = "${filebase64sha256("../06-decide-transcode-requirements/dist/lambda.zip")}"
  runtime          = "nodejs8.10"
  timeout          = "30"
  memory_size      = "256"

  environment {
    variables = {
      SERVICES_URL          = "${var.services_url}"
      SERVICES_AUTH_TYPE    = "${var.services_auth_type}"
      SERVICES_AUTH_CONTEXT = "${var.services_auth_context}"
      REPOSITORY_BUCKET     = "${var.repository_bucket}"
      TEMP_BUCKET           = "${var.temp_bucket}"
      WEBSITE_BUCKET        = "${var.website_bucket}"
      THRESHOLD_SECONDS     = "30"
    }
  }
}

resource "aws_lambda_function" "conform-07a-short-transcode" {
  filename         = "../07a-short-transcode/dist/lambda.zip"
  function_name    = "${format("%.64s", "${var.global_prefix}-07a-short-transcode")}"
  role             = "${aws_iam_role.iam_for_exec_lambda.arn}"
  handler          = "index.handler"
  source_code_hash = "${filebase64sha256("../07a-short-transcode/dist/lambda.zip")}"
  runtime          = "nodejs8.10"
  timeout          = "30"
  memory_size      = "256"

  environment {
    variables = {
      SERVICES_URL          = "${var.services_url}"
      SERVICES_AUTH_TYPE    = "${var.services_auth_type}"
      SERVICES_AUTH_CONTEXT = "${var.services_auth_context}"
      WEBSITE_BUCKET        = "${var.website_bucket}"
      ACTIVITY_CALLBACK_URL = "${local.workflow_activity_callback_handler_url}"
      ACTIVITY_ARN          = "${aws_sfn_activity.conform-07a-short-transcode.id}"
    }
  }
}

resource "aws_sfn_activity" "conform-07a-short-transcode" {
  name = "${format("%.80s", "${var.global_prefix}-07a-short-transcode")}"
}

resource "aws_lambda_function" "conform-07b-long-transcode" {
  filename         = "../07b-long-transcode/dist/lambda.zip"
  function_name    = "${format("%.64s", "${var.global_prefix}-07b-long-transcode")}"
  role             = "${aws_iam_role.iam_for_exec_lambda.arn}"
  handler          = "index.handler"
  source_code_hash = "${filebase64sha256("../07b-long-transcode/dist/lambda.zip")}"
  runtime          = "nodejs8.10"
  timeout          = "30"
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
      ACTIVITY_ARN          = "${aws_sfn_activity.conform-07b-long-transcode.id}"
    }
  }
}

resource "aws_sfn_activity" "conform-07b-long-transcode" {
  name = "${format("%.80s", "${var.global_prefix}-07b-long-transcode")}"
}

resource "aws_lambda_function" "conform-08-register-proxy-essence" {
  filename         = "../08-register-proxy-essence/dist/lambda.zip"
  function_name    = "${format("%.64s", "${var.global_prefix}-08-register-proxy-essence")}"
  role             = "${aws_iam_role.iam_for_exec_lambda.arn}"
  handler          = "index.handler"
  source_code_hash = "${filebase64sha256("../08-register-proxy-essence/dist/lambda.zip")}"
  runtime          = "nodejs8.10"
  timeout          = "30"
  memory_size      = "256"

  environment {
    variables = {
      SERVICES_URL          = "${var.services_url}"
      SERVICES_AUTH_TYPE    = "${var.services_auth_type}"
      SERVICES_AUTH_CONTEXT = "${var.services_auth_context}"
      REPOSITORY_BUCKET     = "${var.repository_bucket}"
      TEMP_BUCKET           = "${var.temp_bucket}"
      WEBSITE_BUCKET        = "${var.website_bucket}"
    }
  }
}

resource "aws_lambda_function" "conform-09-copy-proxy-to-website-storage" {
  filename         = "../09-copy-proxy-to-website-storage/dist/lambda.zip"
  function_name    = "${format("%.64s", "${var.global_prefix}-09-copy-proxy-to-website-storage")}"
  role             = "${aws_iam_role.iam_for_exec_lambda.arn}"
  handler          = "index.handler"
  source_code_hash = "${filebase64sha256("../09-copy-proxy-to-website-storage/dist/lambda.zip")}"
  runtime          = "nodejs8.10"
  timeout          = "30"
  memory_size      = "256"

  environment {
    variables = {
      SERVICES_URL          = "${var.services_url}"
      SERVICES_AUTH_TYPE    = "${var.services_auth_type}"
      SERVICES_AUTH_CONTEXT = "${var.services_auth_context}"
      REPOSITORY_BUCKET     = "${var.repository_bucket}"
      TEMP_BUCKET           = "${var.temp_bucket}"
      WEBSITE_BUCKET        = "${var.website_bucket}"
    }
  }
}

resource "aws_lambda_function" "conform-10-register-proxy-website-locator" {
  filename         = "../10-register-proxy-website-locator/dist/lambda.zip"
  function_name    = "${format("%.64s", "${var.global_prefix}-10-register-proxy-website-locator")}"
  role             = "${aws_iam_role.iam_for_exec_lambda.arn}"
  handler          = "index.handler"
  source_code_hash = "${filebase64sha256("../10-register-proxy-website-locator/dist/lambda.zip")}"
  runtime          = "nodejs8.10"
  timeout          = "30"
  memory_size      = "256"

  environment {
    variables = {
      SERVICES_URL          = "${var.services_url}"
      SERVICES_AUTH_TYPE    = "${var.services_auth_type}"
      SERVICES_AUTH_CONTEXT = "${var.services_auth_context}"
      REPOSITORY_BUCKET     = "${var.repository_bucket}"
      TEMP_BUCKET           = "${var.temp_bucket}"
      WEBSITE_BUCKET        = "${var.website_bucket}"
    }
  }
}

resource "aws_lambda_function" "conform-11-start-ai-workflow" {
  filename         = "../11-start-ai-workflow/dist/lambda.zip"
  function_name    = "${format("%.64s", "${var.global_prefix}-11-start-ai-workflow")}"
  role             = "${aws_iam_role.iam_for_exec_lambda.arn}"
  handler          = "index.handler"
  source_code_hash = "${filebase64sha256("../11-start-ai-workflow/dist/lambda.zip")}"
  runtime          = "nodejs8.10"
  timeout          = "30"
  memory_size      = "256"

  environment {
    variables = {
      SERVICES_URL          = "${var.services_url}"
      SERVICES_AUTH_TYPE    = "${var.services_auth_type}"
      SERVICES_AUTH_CONTEXT = "${var.services_auth_context}"
      REPOSITORY_BUCKET     = "${var.repository_bucket}"
      TEMP_BUCKET           = "${var.temp_bucket}"
      WEBSITE_BUCKET        = "${var.website_bucket}"
    }
  }
}

#################################
#  Step Functions : Conform Workflow
#################################

data "template_file" "conform-workflow" {
  template = "${file("state-machine.json")}"

  vars = {
    lambda-01-validate-workflow-input         = "${aws_lambda_function.conform-01-validate-workflow-input.arn}"
    lambda-02-move-content-to-file-repository = "${aws_lambda_function.conform-02-move-content-to-file-repository.arn}"
    lambda-03-create-media-asset              = "${aws_lambda_function.conform-03-create-media-asset.arn}"
    lambda-04-extract-technical-metadata      = "${aws_lambda_function.conform-04-extract-technical-metadata.arn}"
    activity-04-extract-technical-metadata    = "${aws_sfn_activity.conform-04-extract-technical-metadata.id}"
    lambda-05-register-technical-metadata     = "${aws_lambda_function.conform-05-register-technical-metadata.arn}"
    lambda-06-decide-transcode-requirements   = "${aws_lambda_function.conform-06-decide-transcode-requirements.arn}"
    lambda-07a-short-transcode                = "${aws_lambda_function.conform-07a-short-transcode.arn}"
    activity-07a-short-transcode              = "${aws_sfn_activity.conform-07a-short-transcode.id}"
    lambda-07b-long-transcode                 = "${aws_lambda_function.conform-07b-long-transcode.arn}"
    activity-07b-long-transcode               = "${aws_sfn_activity.conform-07b-long-transcode.id}"
    lambda-08-register-proxy-essence          = "${aws_lambda_function.conform-08-register-proxy-essence.arn}"
    lambda-09-copy-proxy-to-website-storage   = "${aws_lambda_function.conform-09-copy-proxy-to-website-storage.arn}"
    lambda-10-register-proxy-website-locator  = "${aws_lambda_function.conform-10-register-proxy-website-locator.arn}"
    lambda-11-start-ai-workflow               = "${aws_lambda_function.conform-11-start-ai-workflow.arn}"
    lambda-process-workflow-completion        = "${aws_lambda_function.process-workflow-completion.arn}"
    lambda-process-workflow-failure           = "${aws_lambda_function.process-workflow-failure.arn}"
  }
}

resource "aws_sfn_state_machine" "conform-workflow" {
  name       = "${var.global_prefix}"
  role_arn   = "${aws_iam_role.iam_for_state_machine_execution.arn}"
  definition = "${data.template_file.conform-workflow.rendered}"
}

output "state_machine_arn" {
  value = "${aws_sfn_state_machine.conform-workflow.id}"
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
