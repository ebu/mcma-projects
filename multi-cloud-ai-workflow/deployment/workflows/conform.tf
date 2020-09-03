#################################
#  Step Functions : Lambdas for conform Workflow
#################################

resource "aws_lambda_function" "conform_01_validate_workflow_input" {
  filename         = "../workflows/conform/01-validate-workflow-input/build/dist/lambda.zip"
  function_name    = format("%.64s", "${var.global_prefix}-conform-01-validate-workflow-input")
  role             = aws_iam_role.iam_for_exec_lambda.arn
  handler          = "index.handler"
  source_code_hash = filebase64sha256("../workflows/conform/01-validate-workflow-input/build/dist/lambda.zip")
  runtime          = "nodejs10.x"
  timeout          = "900"
  memory_size      = "3008"

  environment {
    variables = {
      LogGroupName     = var.log_group.name
      ServicesUrl      = var.services_url
      ServicesAuthType = var.service_registry_auth_type
      RepositoryBucket = var.repository_bucket_name
      TempBucket       = var.temp_bucket_name
      WebsiteBucket    = var.website_bucket_name
    }
  }
}

resource "aws_lambda_function" "conform_02_move_content_to_file_repository" {
  filename         = "../workflows/conform/02-move-content-to-file-repository/build/dist/lambda.zip"
  function_name    = format("%.64s", "${var.global_prefix}-conform-02-move-content-to-file-repository")
  role             = aws_iam_role.iam_for_exec_lambda.arn
  handler          = "index.handler"
  source_code_hash = filebase64sha256("../workflows/conform/02-move-content-to-file-repository/build/dist/lambda.zip")
  runtime          = "nodejs10.x"
  timeout          = "900"
  memory_size      = "3008"

  environment {
    variables = {
      LogGroupName     = var.log_group.name
      ServicesUrl      = var.services_url
      ServicesAuthType = var.service_registry_auth_type
      RepositoryBucket = var.repository_bucket_name
      TempBucket       = var.temp_bucket_name
      WebsiteBucket    = var.website_bucket_name
    }
  }
}

resource "aws_lambda_function" "conform_03_create_media_asset" {
  filename         = "../workflows/conform/03-create-media-asset/build/dist/lambda.zip"
  function_name    = format("%.64s", "${var.global_prefix}-conform-03-create-media-asset")
  role             = aws_iam_role.iam_for_exec_lambda.arn
  handler          = "index.handler"
  source_code_hash = filebase64sha256("../workflows/conform/03-create-media-asset/build/dist/lambda.zip")
  runtime          = "nodejs10.x"
  timeout          = "900"
  memory_size      = "3008"

  environment {
    variables = {
      LogGroupName     = var.log_group.name
      ServicesUrl      = var.services_url
      ServicesAuthType = var.service_registry_auth_type
      RepositoryBucket = var.repository_bucket_name
      TempBucket       = var.temp_bucket_name
      WebsiteBucket    = var.website_bucket_name
    }
  }
}

resource "aws_lambda_function" "conform_04_extract_technical_metadata" {
  filename         = "../workflows/conform/04-extract-technical-metadata/build/dist/lambda.zip"
  function_name    = format("%.64s", "${var.global_prefix}-conform-04-extract-technical-metadata")
  role             = aws_iam_role.iam_for_exec_lambda.arn
  handler          = "index.handler"
  source_code_hash = filebase64sha256("../workflows/conform/04-extract-technical-metadata/build/dist/lambda.zip")
  runtime          = "nodejs10.x"
  timeout          = "900"
  memory_size      = "3008"

  environment {
    variables = {
      LogGroupName        = var.log_group.name
      ServicesUrl         = var.services_url
      ServicesAuthType    = var.service_registry_auth_type
      RepositoryBucket    = var.repository_bucket_name
      TempBucket          = var.temp_bucket_name
      WebsiteBucket       = var.website_bucket_name
      ActivityCallbackUrl = local.workflow_activity_callback_handler_url
      ActivityArn         = aws_sfn_activity.conform_04_extract_technical_metadata.id
    }
  }
}

resource "aws_sfn_activity" "conform_04_extract_technical_metadata" {
  name = "${var.global_prefix}-conform-04-extract-technical-metadata"
}

resource "aws_lambda_function" "conform_05_register_technical_metadata" {
  filename         = "../workflows/conform/05-register-technical-metadata/build/dist/lambda.zip"
  function_name    = format("%.64s", "${var.global_prefix}-conform-05-register-technical-metadata")
  role             = aws_iam_role.iam_for_exec_lambda.arn
  handler          = "index.handler"
  source_code_hash = filebase64sha256("../workflows/conform/05-register-technical-metadata/build/dist/lambda.zip")
  runtime          = "nodejs10.x"
  timeout          = "900"
  memory_size      = "3008"

  environment {
    variables = {
      LogGroupName     = var.log_group.name
      ServicesUrl      = var.services_url
      ServicesAuthType = var.service_registry_auth_type
      RepositoryBucket = var.repository_bucket_name
      TempBucket       = var.temp_bucket_name
      WebsiteBucket    = var.website_bucket_name
    }
  }
}

resource "aws_lambda_function" "conform_06_decide_transcode_requirements" {
  filename         = "../workflows/conform/06-decide-transcode-requirements/build/dist/lambda.zip"
  function_name    = format("%.64s", "${var.global_prefix}-conform-06-decide-transcode-requirements")
  role             = aws_iam_role.iam_for_exec_lambda.arn
  handler          = "index.handler"
  source_code_hash = filebase64sha256("../workflows/conform/06-decide-transcode-requirements/build/dist/lambda.zip")
  runtime          = "nodejs10.x"
  timeout          = "900"
  memory_size      = "3008"

  environment {
    variables = {
      LogGroupName     = var.log_group.name
      ServicesUrl      = var.services_url
      ServicesAuthType = var.service_registry_auth_type
      RepositoryBucket = var.repository_bucket_name
      TempBucket       = var.temp_bucket_name
      WebsiteBucket    = var.website_bucket_name
      ThresholdSeconds = "30"
    }
  }
}

resource "aws_lambda_function" "conform_07a_short_transcode" {
  filename         = "../workflows/conform/07a-short-transcode/build/dist/lambda.zip"
  function_name    = format("%.64s", "${var.global_prefix}-conform-07a-short-transcode")
  role             = aws_iam_role.iam_for_exec_lambda.arn
  handler          = "index.handler"
  source_code_hash = filebase64sha256("../workflows/conform/07a-short-transcode/build/dist/lambda.zip")
  runtime          = "nodejs10.x"
  timeout          = "900"
  memory_size      = "3008"

  environment {
    variables = {
      LogGroupName        = var.log_group.name
      ServicesUrl         = var.services_url
      ServicesAuthType    = var.service_registry_auth_type
      WebsiteBucket       = var.website_bucket_name
      ActivityCallbackUrl = local.workflow_activity_callback_handler_url
      ActivityArn         = aws_sfn_activity.conform_07a_short_transcode.id
    }
  }
}

resource "aws_sfn_activity" "conform_07a_short_transcode" {
  name = "${var.global_prefix}-conform-07a-short-transcode"
}

resource "aws_lambda_function" "conform_07b_long_transcode" {
  filename         = "../workflows/conform/07b-long-transcode/build/dist/lambda.zip"
  function_name    = format("%.64s", "${var.global_prefix}-conform-07b-long-transcode")
  role             = aws_iam_role.iam_for_exec_lambda.arn
  handler          = "index.handler"
  source_code_hash = filebase64sha256("../workflows/conform/07b-long-transcode/build/dist/lambda.zip")
  runtime          = "nodejs10.x"
  timeout          = "900"
  memory_size      = "3008"

  environment {
    variables = {
      LogGroupName        = var.log_group.name
      ServicesUrl         = var.services_url
      ServicesAuthType    = var.service_registry_auth_type
      RepositoryBucket    = var.repository_bucket_name
      TempBucket          = var.temp_bucket_name
      WebsiteBucket       = var.website_bucket_name
      ActivityCallbackUrl = local.workflow_activity_callback_handler_url
      ActivityArn         = aws_sfn_activity.conform_07b_long_transcode.id
    }
  }
}

resource "aws_sfn_activity" "conform_07b_long_transcode" {
  name = "${var.global_prefix}-conform-07b-long-transcode"
}

resource "aws_lambda_function" "conform_08_register_proxy_essence" {
  filename         = "../workflows/conform/08-register-proxy-essence/build/dist/lambda.zip"
  function_name    = format("%.64s", "${var.global_prefix}-conform-08-register-proxy-essence")
  role             = aws_iam_role.iam_for_exec_lambda.arn
  handler          = "index.handler"
  source_code_hash = filebase64sha256("../workflows/conform/08-register-proxy-essence/build/dist/lambda.zip")
  runtime          = "nodejs10.x"
  timeout          = "900"
  memory_size      = "3008"

  environment {
    variables = {
      LogGroupName     = var.log_group.name
      ServicesUrl      = var.services_url
      ServicesAuthType = var.service_registry_auth_type
      RepositoryBucket = var.repository_bucket_name
      TempBucket       = var.temp_bucket_name
      WebsiteBucket    = var.website_bucket_name
    }
  }
}

resource "aws_lambda_function" "conform_09_copy_proxy_to_website_storage" {
  filename         = "../workflows/conform/09-copy-proxy-to-website-storage/build/dist/lambda.zip"
  function_name    = format("%.64s", "${var.global_prefix}-conform-09-copy-proxy-to-website-storage")
  role             = aws_iam_role.iam_for_exec_lambda.arn
  handler          = "index.handler"
  source_code_hash = filebase64sha256("../workflows/conform/09-copy-proxy-to-website-storage/build/dist/lambda.zip")
  runtime          = "nodejs10.x"
  timeout          = "900"
  memory_size      = "3008"

  environment {
    variables = {
      LogGroupName     = var.log_group.name
      ServicesUrl      = var.services_url
      ServicesAuthType = var.service_registry_auth_type
      RepositoryBucket = var.repository_bucket_name
      TempBucket       = var.temp_bucket_name
      WebsiteBucket    = var.website_bucket_name
    }
  }
}

resource "aws_lambda_function" "conform_10_register_proxy_website_locator" {
  filename         = "../workflows/conform/10-register-proxy-website-locator/build/dist/lambda.zip"
  function_name    = format("%.64s", "${var.global_prefix}-conform-10-register-proxy-website-locator")
  role             = aws_iam_role.iam_for_exec_lambda.arn
  handler          = "index.handler"
  source_code_hash = filebase64sha256("../workflows/conform/10-register-proxy-website-locator/build/dist/lambda.zip")
  runtime          = "nodejs10.x"
  timeout          = "900"
  memory_size      = "3008"

  environment {
    variables = {
      LogGroupName     = var.log_group.name
      ServicesUrl      = var.services_url
      ServicesAuthType = var.service_registry_auth_type
      RepositoryBucket = var.repository_bucket_name
      TempBucket       = var.temp_bucket_name
      WebsiteBucket    = var.website_bucket_name
    }
  }
}

resource "aws_lambda_function" "conform_11_start_ai_workflow" {
  filename         = "../workflows/conform/11-start-ai-workflow/build/dist/lambda.zip"
  function_name    = format("%.64s", "${var.global_prefix}-conform-11-start-ai-workflow")
  role             = aws_iam_role.iam_for_exec_lambda.arn
  handler          = "index.handler"
  source_code_hash = filebase64sha256("../workflows/conform/11-start-ai-workflow/build/dist/lambda.zip")
  runtime          = "nodejs10.x"
  timeout          = "900"
  memory_size      = "3008"

  environment {
    variables = {
      LogGroupName     = var.log_group.name
      ServicesUrl      = var.services_url
      ServicesAuthType = var.service_registry_auth_type
      RepositoryBucket = var.repository_bucket_name
      TempBucket       = var.temp_bucket_name
      WebsiteBucket    = var.website_bucket_name
    }
  }
}

#################################
#  Step Functions : Conform Workflow
#################################

resource "aws_sfn_state_machine" "conform_workflow" {
  name       = "${var.global_prefix}-conform-workflow"
  role_arn   = aws_iam_role.iam_for_state_machine_execution.arn
  definition = templatefile("workflows/conform.json", {
    lambda-01-validate-workflow-input         = aws_lambda_function.conform_01_validate_workflow_input.arn
    lambda-02-move-content-to-file-repository = aws_lambda_function.conform_02_move_content_to_file_repository.arn
    lambda-03-create-media-asset              = aws_lambda_function.conform_03_create_media_asset.arn
    lambda-04-extract-technical-metadata      = aws_lambda_function.conform_04_extract_technical_metadata.arn
    activity-04-extract-technical-metadata    = aws_sfn_activity.conform_04_extract_technical_metadata.id
    lambda-05-register-technical-metadata     = aws_lambda_function.conform_05_register_technical_metadata.arn
    lambda-06-decide-transcode-requirements   = aws_lambda_function.conform_06_decide_transcode_requirements.arn
    lambda-07a-short-transcode                = aws_lambda_function.conform_07a_short_transcode.arn
    activity-07a-short-transcode              = aws_sfn_activity.conform_07a_short_transcode.id
    lambda-07b-long-transcode                 = aws_lambda_function.conform_07b_long_transcode.arn
    activity-07b-long-transcode               = aws_sfn_activity.conform_07b_long_transcode.id
    lambda-08-register-proxy-essence          = aws_lambda_function.conform_08_register_proxy_essence.arn
    lambda-09-copy-proxy-to-website-storage   = aws_lambda_function.conform_09_copy_proxy_to_website_storage.arn
    lambda-10-register-proxy-website-locator  = aws_lambda_function.conform_10_register_proxy_website_locator.arn
    lambda-11-start-ai-workflow               = aws_lambda_function.conform_11_start_ai_workflow.arn
    lambda-process-workflow-completion        = aws_lambda_function.process_workflow_completion.arn
    lambda-process-workflow-failure           = aws_lambda_function.process_workflow_failure.arn
  })
}
