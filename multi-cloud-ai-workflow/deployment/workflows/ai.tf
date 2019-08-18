# #################################
# #  Step Functions : Lambdas for ai Workflow
# #################################

resource "aws_lambda_function" "ai-01-validate-workflow-input" {
  filename         = "./../workflows/ai/01-validate-workflow-input/dist/lambda.zip"
  function_name    = "${format("%.64s", "${var.global_prefix}-ai-01-validate-workflow-input")}"
  role             = "${aws_iam_role.iam_for_exec_lambda.arn}"
  handler          = "index.handler"
  source_code_hash = "${filebase64sha256("./../workflows/ai/01-validate-workflow-input/dist/lambda.zip")}"
  runtime          = "nodejs8.10"
  timeout          = "60"
  memory_size      = "256"

  environment {
    variables = {
      ServicesUrl         = "${var.services_url}"
      ServicesAuthType    = "${var.services_auth_type}"
      ServicesAuthContext = "${var.services_auth_context}"
      RepositoryBucket    = "${var.repository_bucket}"
      TempBucket          = "${var.temp_bucket}"
      WebsiteBucket       = "${var.website_bucket}"
    }
  }
}

resource "aws_lambda_function" "ai-02-extract-speech-to-text" {
  filename         = "./../workflows/ai/02-extract-speech-to-text/dist/lambda.zip"
  function_name    = "${format("%.64s", "${var.global_prefix}-ai-02-extract-speech-to-text")}"
  role             = "${aws_iam_role.iam_for_exec_lambda.arn}"
  handler          = "index.handler"
  source_code_hash = "${filebase64sha256("./../workflows/ai/02-extract-speech-to-text/dist/lambda.zip")}"
  runtime          = "nodejs8.10"
  timeout          = "60"
  memory_size      = "256"

  environment {
    variables = {
      ServicesUrl         = "${var.services_url}"
      ServicesAuthType    = "${var.services_auth_type}"
      ServicesAuthContext = "${var.services_auth_context}"
      RepositoryBucket    = "${var.repository_bucket}"
      TempBucket          = "${var.temp_bucket}"
      WebsiteBucket       = "${var.website_bucket}"
      ActivityCallbackUrl = "${local.workflow_activity_callback_handler_url}"
      ActivityArn         = "${aws_sfn_activity.ai-02-extract-speech-to-text.id}"
    }
  }
}

resource "aws_sfn_activity" "ai-02-extract-speech-to-text" {
  name = "${var.global_prefix}-ai-02-extract-speech-to-text"
}

resource "aws_lambda_function" "ai-03-register-speech-to-text-output" {
  filename         = "./../workflows/ai/03-register-speech-to-text-output/dist/lambda.zip"
  function_name    = "${format("%.64s", "${var.global_prefix}-ai-03-register-speech-to-text-output")}"
  role             = "${aws_iam_role.iam_for_exec_lambda.arn}"
  handler          = "index.handler"
  source_code_hash = "${filebase64sha256("./../workflows/ai/03-register-speech-to-text-output/dist/lambda.zip")}"
  runtime          = "nodejs8.10"
  timeout          = "60"
  memory_size      = "256"

  environment {
    variables = {
      ServicesUrl         = "${var.services_url}"
      ServicesAuthType    = "${var.services_auth_type}"
      ServicesAuthContext = "${var.services_auth_context}"
      RepositoryBucket    = "${var.repository_bucket}"
      TempBucket          = "${var.temp_bucket}"
      WebsiteBucket       = "${var.website_bucket}"
    }
  }
}

resource "aws_lambda_function" "ai-04-translate-speech-transcription" {
  filename         = "./../workflows/ai/04-translate-speech-transcription/dist/lambda.zip"
  function_name    = "${format("%.64s", "${var.global_prefix}-ai-04-translate-speech-transcription")}"
  role             = "${aws_iam_role.iam_for_exec_lambda.arn}"
  handler          = "index.handler"
  source_code_hash = "${filebase64sha256("./../workflows/ai/04-translate-speech-transcription/dist/lambda.zip")}"
  runtime          = "nodejs8.10"
  timeout          = "60"
  memory_size      = "256"

  environment {
    variables = {
      ServicesUrl         = "${var.services_url}"
      ServicesAuthType    = "${var.services_auth_type}"
      ServicesAuthContext = "${var.services_auth_context}"
      RepositoryBucket    = "${var.repository_bucket}"
      TempBucket          = "${var.temp_bucket}"
      WebsiteBucket       = "${var.website_bucket}"
      ActivityCallbackUrl = "${local.workflow_activity_callback_handler_url}"
      ActivityArn         = "${aws_sfn_activity.ai-04-translate-speech-transcription.id}"
    }
  }
}

resource "aws_sfn_activity" "ai-04-translate-speech-transcription" {
  name = "${var.global_prefix}-ai-04-translate-speech-transcription"
}

resource "aws_lambda_function" "ai-05-register-speech-translation" {
  filename         = "./../workflows/ai/05-register-speech-translation/dist/lambda.zip"
  function_name    = "${format("%.64s", "${var.global_prefix}-ai-05-register-speech-translation")}"
  role             = "${aws_iam_role.iam_for_exec_lambda.arn}"
  handler          = "index.handler"
  source_code_hash = "${filebase64sha256("./../workflows/ai/05-register-speech-translation/dist/lambda.zip")}"
  runtime          = "nodejs8.10"
  timeout          = "60"
  memory_size      = "256"

  environment {
    variables = {
      ServicesUrl         = "${var.services_url}"
      ServicesAuthType    = "${var.services_auth_type}"
      ServicesAuthContext = "${var.services_auth_context}"
      RepositoryBucket    = "${var.repository_bucket}"
      TempBucket          = "${var.temp_bucket}"
      WebsiteBucket       = "${var.website_bucket}"
    }
  }
}

resource "aws_lambda_function" "ai-06-detect-celebrities-aws" {
  filename         = "./../workflows/ai/06-detect-celebrities-aws/dist/lambda.zip"
  function_name    = "${format("%.64s", "${var.global_prefix}-ai-06-detect-celebrities-aws")}"
  role             = "${aws_iam_role.iam_for_exec_lambda.arn}"
  handler          = "index.handler"
  source_code_hash = "${filebase64sha256("./../workflows/ai/06-detect-celebrities-aws/dist/lambda.zip")}"
  runtime          = "nodejs8.10"
  timeout          = "60"
  memory_size      = "256"

  environment {
    variables = {
      ServicesUrl         = "${var.services_url}"
      ServicesAuthType    = "${var.services_auth_type}"
      ServicesAuthContext = "${var.services_auth_context}"
      RepositoryBucket    = "${var.repository_bucket}"
      TempBucket          = "${var.temp_bucket}"
      WebsiteBucket       = "${var.website_bucket}"
      ActivityCallbackUrl = "${local.workflow_activity_callback_handler_url}"
      ActivityArn         = "${aws_sfn_activity.ai-06-detect-celebrities-aws.id}"
    }
  }
}

resource "aws_sfn_activity" "ai-06-detect-celebrities-aws" {
  name = "${var.global_prefix}-ai-06-detect-celebrities-aws"
}

resource "aws_lambda_function" "ai-07-register-celebrities-info-aws" {
  filename         = "./../workflows/ai/07-register-celebrities-info-aws/dist/lambda.zip"
  function_name    = "${format("%.64s", "${var.global_prefix}-ai-07-register-celebrities-info-aws")}"
  role             = "${aws_iam_role.iam_for_exec_lambda.arn}"
  handler          = "index.handler"
  source_code_hash = "${filebase64sha256("./../workflows/ai/07-register-celebrities-info-aws/dist/lambda.zip")}"
  runtime          = "nodejs8.10"
  timeout          = "60"
  memory_size      = "256"

  environment {
    variables = {
      ServicesUrl         = "${var.services_url}"
      ServicesAuthType    = "${var.services_auth_type}"
      ServicesAuthContext = "${var.services_auth_context}"
      RepositoryBucket    = "${var.repository_bucket}"
      TempBucket          = "${var.temp_bucket}"
      WebsiteBucket       = "${var.website_bucket}"
    }
  }
}

resource "aws_lambda_function" "ai-08-detect-celebrities-azure" {
  filename         = "./../workflows/ai/08-detect-celebrities-azure/dist/lambda.zip"
  function_name    = "${format("%.64s", "${var.global_prefix}-ai-08-detect-celebrities-azure")}"
  role             = "${aws_iam_role.iam_for_exec_lambda.arn}"
  handler          = "index.handler"
  source_code_hash = "${filebase64sha256("./../workflows/ai/08-detect-celebrities-azure/dist/lambda.zip")}"
  runtime          = "nodejs8.10"
  timeout          = "60"
  memory_size      = "256"

  environment {
    variables = {
      ServicesUrl         = "${var.services_url}"
      ServicesAuthType    = "${var.services_auth_type}"
      ServicesAuthContext = "${var.services_auth_context}"
      RepositoryBucket    = "${var.repository_bucket}"
      TempBucket          = "${var.temp_bucket}"
      WebsiteBucket       = "${var.website_bucket}"
      ActivityCallbackUrl = "${local.workflow_activity_callback_handler_url}"
      ActivityArn         = "${aws_sfn_activity.ai-08-detect-celebrities-azure.id}"
    }
  }
}

resource "aws_sfn_activity" "ai-08-detect-celebrities-azure" {
  name = "${var.global_prefix}-ai-08-detect-celebrities-azure"
}

resource "aws_lambda_function" "ai-09-register-celebrities-info-azure" {
  filename         = "./../workflows/ai/09-register-celebrities-info-azure/dist/lambda.zip"
  function_name    = "${format("%.64s", "${var.global_prefix}-ai-09-register-celebrities-info-azure")}"
  role             = "${aws_iam_role.iam_for_exec_lambda.arn}"
  handler          = "index.handler"
  source_code_hash = "${filebase64sha256("./../workflows/ai/09-register-celebrities-info-azure/dist/lambda.zip")}"
  runtime          = "nodejs8.10"
  timeout          = "60"
  memory_size      = "256"

  environment {
    variables = {
      ServicesUrl         = "${var.services_url}"
      ServicesAuthType    = "${var.services_auth_type}"
      ServicesAuthContext = "${var.services_auth_context}"
      RepositoryBucket    = "${var.repository_bucket}"
      TempBucket          = "${var.temp_bucket}"
      WebsiteBucket       = "${var.website_bucket}"
    }
  }
}

resource "aws_lambda_function" "ai-10-detect-emotions-aws" {
  filename         = "./../workflows/ai/10-detect-emotions-aws/dist/lambda.zip"
  function_name    = "${format("%.64s", "${var.global_prefix}-ai-10-detect-emotions-aws")}"
  role             = "${aws_iam_role.iam_for_exec_lambda.arn}"
  handler          = "index.handler"
  source_code_hash = "${filebase64sha256("./../workflows/ai/10-detect-emotions-aws/dist/lambda.zip")}"
  runtime          = "nodejs8.10"
  timeout          = "60"
  memory_size      = "256"

  environment {
    variables = {
      ServicesUrl         = "${var.services_url}"
      ServicesAuthType    = "${var.services_auth_type}"
      ServicesAuthContext = "${var.services_auth_context}"
      RepositoryBucket    = "${var.repository_bucket}"
      TempBucket          = "${var.temp_bucket}"
      WebsiteBucket       = "${var.website_bucket}"
      ActivityCallbackUrl = "${local.workflow_activity_callback_handler_url}"
      ActivityArn         = "${aws_sfn_activity.ai-10-detect-emotions-aws.id}"
    }
  }
}

resource "aws_sfn_activity" "ai-10-detect-emotions-aws" {
  name = "${var.global_prefix}-ai-10-detect-emotions-aws"
}

resource "aws_lambda_function" "ai-11-register-emotions-info-aws" {
  filename         = "./../workflows/ai/11-register-emotions-info-aws/dist/lambda.zip"
  function_name    = "${format("%.64s", "${var.global_prefix}-ai-11-register-emotions-info-aws")}"
  role             = "${aws_iam_role.iam_for_exec_lambda.arn}"
  handler          = "index.handler"
  source_code_hash = "${filebase64sha256("./../workflows/ai/11-register-emotions-info-aws/dist/lambda.zip")}"
  runtime          = "nodejs8.10"
  timeout          = "60"
  memory_size      = "256"

  environment {
    variables = {
      ServicesUrl         = "${var.services_url}"
      ServicesAuthType    = "${var.services_auth_type}"
      ServicesAuthContext = "${var.services_auth_context}"
      RepositoryBucket    = "${var.repository_bucket}"
      TempBucket          = "${var.temp_bucket}"
      WebsiteBucket       = "${var.website_bucket}"
    }
  }
}

resource "aws_lambda_function" "ai-12-translation-to-speech" {
  filename         = "./../workflows/ai/12-translation-to-speech/dist/lambda.zip"
  function_name    = "${format("%.64s", "${var.global_prefix}-ai-12-translation-to-speech")}"
  role             = "${aws_iam_role.iam_for_exec_lambda.arn}"
  handler          = "index.handler"
  source_code_hash = "${filebase64sha256("./../workflows/ai/12-translation-to-speech/dist/lambda.zip")}"
  runtime          = "nodejs8.10"
  timeout          = "60"
  memory_size      = "256"

  environment {
    variables = {
      ServicesUrl         = "${var.services_url}"
      ServicesAuthType    = "${var.services_auth_type}"
      ServicesAuthContext = "${var.services_auth_context}"
      RepositoryBucket    = "${var.repository_bucket}"
      TempBucket          = "${var.temp_bucket}"
      WebsiteBucket       = "${var.website_bucket}"
      ActivityCallbackUrl = "${local.workflow_activity_callback_handler_url}"
      ActivityArn         = "${aws_sfn_activity.ai-12-translation-to-speech.id}"
    }
  }
}

resource "aws_sfn_activity" "ai-12-translation-to-speech" {
  name = "${var.global_prefix}-ai-12-translation-to-speech"
}

resource "aws_lambda_function" "ai-13-register-translation-to-speech" {
  filename         = "./../workflows/ai/13-register-translation-to-speech/dist/lambda.zip"
  function_name    = "${format("%.64s", "${var.global_prefix}-ai-13-register-translation-to-speech")}"
  role             = "${aws_iam_role.iam_for_exec_lambda.arn}"
  handler          = "index.handler"
  source_code_hash = "${filebase64sha256("./../workflows/ai/13-register-translation-to-speech/dist/lambda.zip")}"
  runtime          = "nodejs8.10"
  timeout          = "60"
  memory_size      = "256"

  environment {
    variables = {
      ServicesUrl         = "${var.services_url}"
      ServicesAuthType    = "${var.services_auth_type}"
      ServicesAuthContext = "${var.services_auth_context}"
      RepositoryBucket    = "${var.repository_bucket}"
      TempBucket          = "${var.temp_bucket}"
      WebsiteBucket       = "${var.website_bucket}"
    }
  }
}

resource "aws_lambda_function" "ai-14-tokenized-translation-to-speech" {
  filename         = "./../workflows/ai/14-tokenized-translation-to-speech/dist/lambda.zip"
  function_name    = "${format("%.64s", "${var.global_prefix}-ai-14-tokenized-translation-to-speech")}"
  role             = "${aws_iam_role.iam_for_exec_lambda.arn}"
  handler          = "index.handler"
  source_code_hash = "${filebase64sha256("./../workflows/ai/14-tokenized-translation-to-speech/dist/lambda.zip")}"
  runtime          = "nodejs8.10"
  timeout          = "60"
  memory_size      = "256"

  environment {
    variables = {
      ServicesUrl         = "${var.services_url}"
      ServicesAuthType    = "${var.services_auth_type}"
      ServicesAuthContext = "${var.services_auth_context}"
      RepositoryBucket    = "${var.repository_bucket}"
      TempBucket          = "${var.temp_bucket}"
      WebsiteBucket       = "${var.website_bucket}"
      ActivityCallbackUrl = "${local.workflow_activity_callback_handler_url}"
      ActivityArn         = "${aws_sfn_activity.ai-14-tokenized-translation-to-speech.id}"
    }
  }
}

resource "aws_sfn_activity" "ai-14-tokenized-translation-to-speech" {
  name = "${var.global_prefix}-ai-14-tokenized-translation-to-speech"
}

resource "aws_lambda_function" "ai-15-register-tokenized-translation-to-speech" {
  filename         = "./../workflows/ai/15-register-tokenized-translation-to-speech/dist/lambda.zip"
  function_name    = "${format("%.64s", "${var.global_prefix}-ai-15-register-tokenized-translation-to-speech")}"
  role             = "${aws_iam_role.iam_for_exec_lambda.arn}"
  handler          = "index.handler"
  source_code_hash = "${filebase64sha256("./../workflows/ai/15-register-tokenized-translation-to-speech/dist/lambda.zip")}"
  runtime          = "nodejs8.10"
  timeout          = "60"
  memory_size      = "256"

  environment {
    variables = {
      ServicesUrl         = "${var.services_url}"
      ServicesAuthType    = "${var.services_auth_type}"
      ServicesAuthContext = "${var.services_auth_context}"
      RepositoryBucket    = "${var.repository_bucket}"
      TempBucket          = "${var.temp_bucket}"
      WebsiteBucket       = "${var.website_bucket}"
    }
  }
}

resource "aws_lambda_function" "ai-16-ssml-translation-to-speech" {
  filename         = "./../workflows/ai/16-ssml-translation-to-speech/dist/lambda.zip"
  function_name    = "${format("%.64s", "${var.global_prefix}-ai-16-ssml-translation-to-speech")}"
  role             = "${aws_iam_role.iam_for_exec_lambda.arn}"
  handler          = "index.handler"
  source_code_hash = "${filebase64sha256("./../workflows/ai/16-ssml-translation-to-speech/dist/lambda.zip")}"
  runtime          = "nodejs8.10"
  timeout          = "60"
  memory_size      = "256"

  environment {
    variables = {
      ServicesUrl         = "${var.services_url}"
      ServicesAuthType    = "${var.services_auth_type}"
      ServicesAuthContext = "${var.services_auth_context}"
      RepositoryBucket    = "${var.repository_bucket}"
      TempBucket          = "${var.temp_bucket}"
      WebsiteBucket       = "${var.website_bucket}"
      ActivityCallbackUrl = "${local.workflow_activity_callback_handler_url}"
      ActivityArn         = "${aws_sfn_activity.ai-16-ssml-translation-to-speech.id}"
    }
  }
}

resource "aws_sfn_activity" "ai-16-ssml-translation-to-speech" {
  name = "${var.global_prefix}-ai-16-ssml-translation-to-speech"
}

resource "aws_lambda_function" "ai-17-register-ssml-translation-to-speech" {
  filename         = "./../workflows/ai/17-register-ssml-translation-to-speech/dist/lambda.zip"
  function_name    = "${format("%.64s", "${var.global_prefix}-ai-17-register-ssml-translation-to-speech")}"
  role             = "${aws_iam_role.iam_for_exec_lambda.arn}"
  handler          = "index.handler"
  source_code_hash = "${filebase64sha256("./../workflows/ai/17-register-ssml-translation-to-speech/dist/lambda.zip")}"
  runtime          = "nodejs8.10"
  timeout          = "60"
  memory_size      = "256"

  environment {
    variables = {
      ServicesUrl         = "${var.services_url}"
      ServicesAuthType    = "${var.services_auth_type}"
      ServicesAuthContext = "${var.services_auth_context}"
      RepositoryBucket    = "${var.repository_bucket}"
      TempBucket          = "${var.temp_bucket}"
      WebsiteBucket       = "${var.website_bucket}"
    }
  }
}

resource "aws_lambda_function" "ai-18-dubbing-srt" {
  filename         = "./../workflows/ai/18-dubbing-srt/dist/lambda.zip"
  function_name    = "${format("%.64s", "${var.global_prefix}-ai-18-dubbing-srt")}"
  role             = "${aws_iam_role.iam_for_exec_lambda.arn}"
  handler          = "index.handler"
  source_code_hash = "${filebase64sha256("./../workflows/ai/18-dubbing-srt/dist/lambda.zip")}"
  runtime          = "nodejs8.10"
  timeout          = "60"
  memory_size      = "256"

  environment {
    variables = {
      ServicesUrl         = "${var.services_url}"
      ServicesAuthType    = "${var.services_auth_type}"
      ServicesAuthContext = "${var.services_auth_context}"
      RepositoryBucket    = "${var.repository_bucket}"
      TempBucket          = "${var.temp_bucket}"
      WebsiteBucket       = "${var.website_bucket}"
      ActivityCallbackUrl = "${local.workflow_activity_callback_handler_url}"
      ActivityArn         = "${aws_sfn_activity.ai-18-dubbing-srt.id}"
    }
  }
}

resource "aws_sfn_activity" "ai-18-dubbing-srt" {
  name = "${var.global_prefix}-ai-18-dubbing-srt"
}

resource "aws_lambda_function" "ai-19-register-dubbing-srt" {
  filename         = "./../workflows/ai/19-register-dubbing-srt/dist/lambda.zip"
  function_name    = "${format("%.64s", "${var.global_prefix}-ai-19-register-dubbing-srt")}"
  role             = "${aws_iam_role.iam_for_exec_lambda.arn}"
  handler          = "index.handler"
  source_code_hash = "${filebase64sha256("./../workflows/ai/19-register-dubbing-srt/dist/lambda.zip")}"
  runtime          = "nodejs8.10"
  timeout          = "60"
  memory_size      = "256"

  environment {
    variables = {
      ServicesUrl         = "${var.services_url}"
      ServicesAuthType    = "${var.services_auth_type}"
      ServicesAuthContext = "${var.services_auth_context}"
      RepositoryBucket    = "${var.repository_bucket}"
      TempBucket          = "${var.temp_bucket}"
      WebsiteBucket       = "${var.website_bucket}"
    }
  }
}



# #################################
# #  Step Functions : AI Workflow
# #################################

data "template_file" "ai-workflow" {
  template = "${file("workflows/ai.json")}"

  vars = {
    lambda-01-validate-workflow-input          = "${aws_lambda_function.ai-01-validate-workflow-input.arn}"
    lambda-02-extract-speech-to-text           = "${aws_lambda_function.ai-02-extract-speech-to-text.arn}"
    activity-02-extract-speech-to-text         = "${aws_sfn_activity.ai-02-extract-speech-to-text.id}"
    lambda-03-register-speech-to-text-output   = "${aws_lambda_function.ai-03-register-speech-to-text-output.arn}"
    lambda-04-translate-speech-transcription   = "${aws_lambda_function.ai-04-translate-speech-transcription.arn}"
    activity-04-translate-speech-transcription = "${aws_sfn_activity.ai-04-translate-speech-transcription.id}"
    lambda-05-register-speech-translation      = "${aws_lambda_function.ai-05-register-speech-translation.arn}"
    lambda-06-detect-celebrities-aws           = "${aws_lambda_function.ai-06-detect-celebrities-aws.arn}"
    activity-06-detect-celebrities-aws         = "${aws_sfn_activity.ai-06-detect-celebrities-aws.id}"
    lambda-08-detect-celebrities-azure         = "${aws_lambda_function.ai-08-detect-celebrities-azure.arn}"
    activity-08-detect-celebrities-azure       = "${aws_sfn_activity.ai-08-detect-celebrities-azure.id}"
    lambda-07-register-celebrities-info-aws    = "${aws_lambda_function.ai-07-register-celebrities-info-aws.arn}"
    lambda-09-register-celebrities-info-azure  = "${aws_lambda_function.ai-09-register-celebrities-info-azure.arn}"
    lambda-10-detect-emotions-aws              = "${aws_lambda_function.ai-10-detect-emotions-aws.arn}"
    activity-10-detect-emotions-aws            = "${aws_sfn_activity.ai-10-detect-emotions-aws.id}"
    lambda-11-register-emotions-info-aws       = "${aws_lambda_function.ai-11-register-emotions-info-aws.arn}"
    lambda-12-translation-to-speech            = "${aws_lambda_function.ai-12-translation-to-speech.arn}"
    activity-12-translation-to-speech          = "${aws_sfn_activity.ai-12-translation-to-speech.id}"
    lambda-13-register-translation-to-speech   = "${aws_lambda_function.ai-13-register-translation-to-speech.arn}"
    lambda-14-tokenized-translation-to-speech            = "${aws_lambda_function.ai-14-tokenized-translation-to-speech.arn}"
    activity-14-tokenized-translation-to-speech          = "${aws_sfn_activity.ai-14-tokenized-translation-to-speech.id}"
    lambda-15-register-tokenized-translation-to-speech   = "${aws_lambda_function.ai-15-register-tokenized-translation-to-speech.arn}"
    lambda-16-ssml-translation-to-speech            = "${aws_lambda_function.ai-16-ssml-translation-to-speech.arn}"
    activity-16-ssml-translation-to-speech          = "${aws_sfn_activity.ai-16-ssml-translation-to-speech.id}"
    lambda-17-register-ssml-translation-to-speech   = "${aws_lambda_function.ai-17-register-ssml-translation-to-speech.arn}"

    lambda-18-dubbing-srt   = "${aws_lambda_function.ai-18-dubbing-srt.arn}"
    activity-18-dubbing-srt       = "${aws_sfn_activity.ai-18-dubbing-srt.id}"
    lambda-19-register-dubbing-srt   = "${aws_lambda_function.ai-19-register-dubbing-srt.arn}"


    lambda-process-workflow-completion         = "${aws_lambda_function.process-workflow-completion.arn}"
    lambda-process-workflow-failure            = "${aws_lambda_function.process-workflow-failure.arn}"
  }
}

resource "aws_sfn_state_machine" "ai-workflow" {
  name       = "${var.global_prefix}-ai-workflow"
  role_arn   = "${aws_iam_role.iam_for_state_machine_execution.arn}"
  definition = "${data.template_file.ai-workflow.rendered}"
}

output "ai_workflow_id" {
  value = "${aws_sfn_state_machine.ai-workflow.id}"
}
