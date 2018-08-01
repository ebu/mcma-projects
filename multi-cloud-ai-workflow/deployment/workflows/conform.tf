#################################
#  Step Functions : Lambdas for conform Workflow
#################################

resource "aws_lambda_function" "conform-01-validate-workflow-input" {
  filename         = "./../workflows/conform/01-validate-workflow-input/dist/lambda.zip"
  function_name    = "${format("%.64s", "${var.global_prefix}-conform-01-validate-workflow-input")}"
  role             = "${aws_iam_role.iam_for_exec_lambda.arn}"
  handler          = "index.handler"
  source_code_hash = "${base64sha256(file("./../workflows/conform/01-validate-workflow-input/dist/lambda.zip"))}"
  runtime          = "nodejs8.10"
  timeout          = "30"
  memory_size      = "256"

  environment {
    variables = {
      SERVICE_REGISTRY_URL = "${var.service_registry_url}"
      REPOSITORY_BUCKET    = "${var.repository_bucket}"
      TEMP_BUCKET          = "${var.temp_bucket}"
      WEBSITE_BUCKET       = "${var.website_bucket}"
    }
  }
}

resource "aws_lambda_function" "conform-02-move-content-to-file-repository" {
  filename         = "./../workflows/conform/02-move-content-to-file-repository/dist/lambda.zip"
  function_name    = "${format("%.64s", "${var.global_prefix}-conform-02-move-content-to-file-repository")}"
  role             = "${aws_iam_role.iam_for_exec_lambda.arn}"
  handler          = "index.handler"
  source_code_hash = "${base64sha256(file("./../workflows/conform/02-move-content-to-file-repository/dist/lambda.zip"))}"
  runtime          = "nodejs8.10"
  timeout          = "30"
  memory_size      = "256"

  environment {
    variables = {
      SERVICE_REGISTRY_URL = "${var.service_registry_url}"
      REPOSITORY_BUCKET    = "${var.repository_bucket}"
      TEMP_BUCKET          = "${var.temp_bucket}"
      WEBSITE_BUCKET       = "${var.website_bucket}"
    }
  }
}

resource "aws_lambda_function" "conform-03-create-media-asset" {
  filename         = "./../workflows/conform/03-create-media-asset/dist/lambda.zip"
  function_name    = "${format("%.64s", "${var.global_prefix}-conform-03-create-media-asset")}"
  role             = "${aws_iam_role.iam_for_exec_lambda.arn}"
  handler          = "index.handler"
  source_code_hash = "${base64sha256(file("./../workflows/conform/03-create-media-asset/dist/lambda.zip"))}"
  runtime          = "nodejs8.10"
  timeout          = "30"
  memory_size      = "256"

  environment {
    variables = {
      SERVICE_REGISTRY_URL = "${var.service_registry_url}"
      REPOSITORY_BUCKET    = "${var.repository_bucket}"
      TEMP_BUCKET          = "${var.temp_bucket}"
      WEBSITE_BUCKET       = "${var.website_bucket}"
    }
  }
}

resource "aws_lambda_function" "conform-04-extract-technical-metadata" {
  filename         = "./../workflows/conform/04-extract-technical-metadata/dist/lambda.zip"
  function_name    = "${format("%.64s", "${var.global_prefix}-conform-04-extract-technical-metadata")}"
  role             = "${aws_iam_role.iam_for_exec_lambda.arn}"
  handler          = "index.handler"
  source_code_hash = "${base64sha256(file("./../workflows/conform/04-extract-technical-metadata/dist/lambda.zip"))}"
  runtime          = "nodejs8.10"
  timeout          = "30"
  memory_size      = "256"

  environment {
    variables = {
      SERVICE_REGISTRY_URL  = "${var.service_registry_url}"
      REPOSITORY_BUCKET     = "${var.repository_bucket}"
      TEMP_BUCKET           = "${var.temp_bucket}"
      WEBSITE_BUCKET        = "${var.website_bucket}"
      ACTIVITY_CALLBACK_URL = "${local.workflow_activity_callback_handler_url}"
      ACTIVITY_ARN          = "${aws_sfn_activity.conform-04-extract-technical-metadata.id}"
    }
  }
}

resource "aws_sfn_activity" "conform-04-extract-technical-metadata" {
  name = "${var.global_prefix}-conform-04-extract-technical-metadata"
}

resource "aws_lambda_function" "conform-05-register-technical-metadata" {
  filename         = "./../workflows/conform/05-register-technical-metadata/dist/lambda.zip"
  function_name    = "${format("%.64s", "${var.global_prefix}-conform-05-register-technical-metadata")}"
  role             = "${aws_iam_role.iam_for_exec_lambda.arn}"
  handler          = "index.handler"
  source_code_hash = "${base64sha256(file("./../workflows/conform/05-register-technical-metadata/dist/lambda.zip"))}"
  runtime          = "nodejs8.10"
  timeout          = "30"
  memory_size      = "256"

  environment {
    variables = {
      SERVICE_REGISTRY_URL = "${var.service_registry_url}"
      REPOSITORY_BUCKET    = "${var.repository_bucket}"
      TEMP_BUCKET          = "${var.temp_bucket}"
      WEBSITE_BUCKET       = "${var.website_bucket}"
    }
  }
}

resource "aws_lambda_function" "conform-06-decide-transcode-requirements" {
  filename         = "./../workflows/conform/06-decide-transcode-requirements/dist/lambda.zip"
  function_name    = "${format("%.64s", "${var.global_prefix}-conform-06-decide-transcode-requirements")}"
  role             = "${aws_iam_role.iam_for_exec_lambda.arn}"
  handler          = "index.handler"
  source_code_hash = "${base64sha256(file("./../workflows/conform/06-decide-transcode-requirements/dist/lambda.zip"))}"
  runtime          = "nodejs8.10"
  timeout          = "30"
  memory_size      = "256"

  environment {
    variables = {
      SERVICE_REGISTRY_URL = "${var.service_registry_url}"
      REPOSITORY_BUCKET    = "${var.repository_bucket}"
      TEMP_BUCKET          = "${var.temp_bucket}"
      WEBSITE_BUCKET       = "${var.website_bucket}"
    }
  }
}

resource "aws_lambda_function" "conform-07a-short-transcode" {
  filename         = "./../workflows/conform/07a-short-transcode/dist/lambda.zip"
  function_name    = "${format("%.64s", "${var.global_prefix}-conform-07a-short-transcode")}"
  role             = "${aws_iam_role.iam_for_exec_lambda.arn}"
  handler          = "index.handler"
  source_code_hash = "${base64sha256(file("./../workflows/conform/07a-short-transcode/dist/lambda.zip"))}"
  runtime          = "nodejs8.10"
  timeout          = "30"
  memory_size      = "256"

  environment {
    variables = {
      SERVICE_REGISTRY_URL  = "${var.service_registry_url}"
      REPOSITORY_BUCKET     = "${var.repository_bucket}"
      TEMP_BUCKET           = "${var.temp_bucket}"
      WEBSITE_BUCKET        = "${var.website_bucket}"
      ACTIVITY_CALLBACK_URL = "${local.workflow_activity_callback_handler_url}"
      ACTIVITY_ARN          = "${aws_sfn_activity.conform-07a-short-transcode.id}"
    }
  }
}

resource "aws_sfn_activity" "conform-07a-short-transcode" {
  name = "${var.global_prefix}-conform-07a-short-transcode"
}

resource "aws_lambda_function" "conform-07b-long-transcode" {
  filename         = "./../workflows/conform/07b-long-transcode/dist/lambda.zip"
  function_name    = "${format("%.64s", "${var.global_prefix}-conform-07b-long-transcode")}"
  role             = "${aws_iam_role.iam_for_exec_lambda.arn}"
  handler          = "index.handler"
  source_code_hash = "${base64sha256(file("./../workflows/conform/07b-long-transcode/dist/lambda.zip"))}"
  runtime          = "nodejs8.10"
  timeout          = "30"
  memory_size      = "256"

  environment {
    variables = {
      SERVICE_REGISTRY_URL  = "${var.service_registry_url}"
      REPOSITORY_BUCKET     = "${var.repository_bucket}"
      TEMP_BUCKET           = "${var.temp_bucket}"
      WEBSITE_BUCKET        = "${var.website_bucket}"
      ACTIVITY_CALLBACK_URL = "${local.workflow_activity_callback_handler_url}"
      ACTIVITY_ARN          = "${aws_sfn_activity.conform-07b-long-transcode.id}"
    }
  }
}

resource "aws_sfn_activity" "conform-07b-long-transcode" {
  name = "${var.global_prefix}-conform-07b-long-transcode"
}

resource "aws_lambda_function" "conform-08-register-proxy-essence" {
  filename         = "./../workflows/conform/08-register-proxy-essence/dist/lambda.zip"
  function_name    = "${format("%.64s", "${var.global_prefix}-conform-08-register-proxy-essence")}"
  role             = "${aws_iam_role.iam_for_exec_lambda.arn}"
  handler          = "index.handler"
  source_code_hash = "${base64sha256(file("./../workflows/conform/08-register-proxy-essence/dist/lambda.zip"))}"
  runtime          = "nodejs8.10"
  timeout          = "30"
  memory_size      = "256"

  environment {
    variables = {
      SERVICE_REGISTRY_URL = "${var.service_registry_url}"
      REPOSITORY_BUCKET    = "${var.repository_bucket}"
      TEMP_BUCKET          = "${var.temp_bucket}"
      WEBSITE_BUCKET       = "${var.website_bucket}"
    }
  }
}

resource "aws_lambda_function" "conform-09-copy-proxy-to-website-storage" {
  filename         = "./../workflows/conform/09-copy-proxy-to-website-storage/dist/lambda.zip"
  function_name    = "${format("%.64s", "${var.global_prefix}-conform-09-copy-proxy-to-website-storage")}"
  role             = "${aws_iam_role.iam_for_exec_lambda.arn}"
  handler          = "index.handler"
  source_code_hash = "${base64sha256(file("./../workflows/conform/09-copy-proxy-to-website-storage/dist/lambda.zip"))}"
  runtime          = "nodejs8.10"
  timeout          = "30"
  memory_size      = "256"

  environment {
    variables = {
      SERVICE_REGISTRY_URL = "${var.service_registry_url}"
      REPOSITORY_BUCKET    = "${var.repository_bucket}"
      TEMP_BUCKET          = "${var.temp_bucket}"
      WEBSITE_BUCKET       = "${var.website_bucket}"
    }
  }
}

resource "aws_lambda_function" "conform-10-register-proxy-website-locator" {
  filename         = "./../workflows/conform/10-register-proxy-website-locator/dist/lambda.zip"
  function_name    = "${format("%.64s", "${var.global_prefix}-conform-10-register-proxy-website-locator")}"
  role             = "${aws_iam_role.iam_for_exec_lambda.arn}"
  handler          = "index.handler"
  source_code_hash = "${base64sha256(file("./../workflows/conform/10-register-proxy-website-locator/dist/lambda.zip"))}"
  runtime          = "nodejs8.10"
  timeout          = "30"
  memory_size      = "256"

  environment {
    variables = {
      SERVICE_REGISTRY_URL = "${var.service_registry_url}"
      REPOSITORY_BUCKET    = "${var.repository_bucket}"
      TEMP_BUCKET          = "${var.temp_bucket}"
      WEBSITE_BUCKET       = "${var.website_bucket}"
    }
  }
}

resource "aws_lambda_function" "conform-11-start-ai-workflow" {
  filename         = "./../workflows/conform/11-start-ai-workflow/dist/lambda.zip"
  function_name    = "${format("%.64s", "${var.global_prefix}-conform-11-start-ai-workflow")}"
  role             = "${aws_iam_role.iam_for_exec_lambda.arn}"
  handler          = "index.handler"
  source_code_hash = "${base64sha256(file("./../workflows/conform/11-start-ai-workflow/dist/lambda.zip"))}"
  runtime          = "nodejs8.10"
  timeout          = "30"
  memory_size      = "256"

  environment {
    variables = {
      SERVICE_REGISTRY_URL = "${var.service_registry_url}"
      REPOSITORY_BUCKET    = "${var.repository_bucket}"
      TEMP_BUCKET          = "${var.temp_bucket}"
      WEBSITE_BUCKET       = "${var.website_bucket}"
    }
  }
}

#################################
#  Step Functions : Conform Workflow
#################################

data "template_file" "conform-workflow" {
  template = "${file("workflows/conform.json")}"

  vars {
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
  }
}

resource "aws_sfn_state_machine" "conform-workflow" {
  name       = "${var.global_prefix}-conform-workflow"
  role_arn   = "${aws_iam_role.iam_for_state_machine_execution.arn}"
  definition = "${data.template_file.conform-workflow.rendered}"
}
