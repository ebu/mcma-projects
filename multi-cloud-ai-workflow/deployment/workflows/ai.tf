# #################################
# #  Step Functions : Lambdas for ai Workflow
# #################################

resource "aws_lambda_function" "ai_01_validate_workflow_input" {
  filename         = "../workflows/ai/01-validate-workflow-input/build/dist/lambda.zip"
  function_name    = format("%.64s", "${var.global_prefix}-ai-01-validate-workflow-input")
  role             = aws_iam_role.iam_for_exec_lambda.arn
  handler          = "index.handler"
  source_code_hash = filebase64sha256("../workflows/ai/01-validate-workflow-input/build/dist/lambda.zip")
  runtime          = "nodejs10.x"
  timeout          = "900"
  memory_size      = "3008"

  environment {
    variables = {
      LogGroupName     = var.global_prefix
      ServicesUrl      = var.services_url
      ServicesAuthType = var.service_registry_auth_type
      RepositoryBucket = var.repository_bucket_name
      TempBucket       = var.temp_bucket_name
      WebsiteBucket    = var.website_bucket_name
    }
  }
}

resource "aws_lambda_function" "ai_02_extract_speech_to_text" {
  filename         = "../workflows/ai/02-extract-speech-to-text/build/dist/lambda.zip"
  function_name    = format("%.64s", "${var.global_prefix}-ai-02-extract-speech-to-text")
  role             = aws_iam_role.iam_for_exec_lambda.arn
  handler          = "index.handler"
  source_code_hash = filebase64sha256("../workflows/ai/02-extract-speech-to-text/build/dist/lambda.zip")
  runtime          = "nodejs10.x"
  timeout          = "900"
  memory_size      = "3008"

  environment {
    variables = {
      LogGroupName     = var.global_prefix
      ServicesUrl         = var.services_url
      ServicesAuthType    = var.service_registry_auth_type
      RepositoryBucket    = var.repository_bucket_name
      TempBucket          = var.temp_bucket_name
      WebsiteBucket       = var.website_bucket_name
      ActivityCallbackUrl = local.workflow_activity_callback_handler_url
      ActivityArn         = aws_sfn_activity.ai_02_extract_speech_to_text.id
    }
  }
}

resource "aws_sfn_activity" "ai_02_extract_speech_to_text" {
  name = "${var.global_prefix}-ai-02-extract-speech-to-text"
}

resource "aws_lambda_function" "ai_03_register_speech_to_text_output" {
  filename         = "../workflows/ai/03-register-speech-to-text-output/build/dist/lambda.zip"
  function_name    = format("%.64s", "${var.global_prefix}-ai-03-register-speech-to-text-output")
  role             = aws_iam_role.iam_for_exec_lambda.arn
  handler          = "index.handler"
  source_code_hash = filebase64sha256("../workflows/ai/03-register-speech-to-text-output/build/dist/lambda.zip")
  runtime          = "nodejs10.x"
  timeout          = "900"
  memory_size      = "3008"

  environment {
    variables = {
      LogGroupName     = var.global_prefix
      ServicesUrl      = var.services_url
      ServicesAuthType = var.service_registry_auth_type
      RepositoryBucket = var.repository_bucket_name
      TempBucket       = var.temp_bucket_name
      WebsiteBucket    = var.website_bucket_name
    }
  }
}


resource "aws_lambda_function" "ai_31_validate_speech_to_text" {
  filename         = "../workflows/ai/31-validate-speech-to-text/build/dist/lambda.zip"
  function_name    = format("%.64s", "${var.global_prefix}-ai-31-validate-speech-to-text")
  role             = aws_iam_role.iam_for_exec_lambda.arn
  handler          = "index.handler"
  source_code_hash = filebase64sha256("../workflows/ai/31-validate-speech-to-text/build/dist/lambda.zip")
  runtime          = "nodejs10.x"
  timeout          = "900"
  memory_size      = "3008"

  environment {
    variables = {
      LogGroupName     = var.global_prefix
      ServicesUrl         = var.services_url
      ServicesAuthType    = var.service_registry_auth_type
      RepositoryBucket    = var.repository_bucket_name
      TempBucket          = var.temp_bucket_name
      WebsiteBucket       = var.website_bucket_name
      ActivityCallbackUrl = local.workflow_activity_callback_handler_url
      ActivityArn         = aws_sfn_activity.ai_31_validate_speech_to_text.id
    }
  }
}

resource "aws_sfn_activity" "ai_31_validate_speech_to_text" {
  name = "${var.global_prefix}-ai-31-validate-speech-to-text"
}

resource "aws_lambda_function" "ai_32_register_validate_speech_to_text" {
  filename         = "../workflows/ai/32-register-validate-speech-to-text/build/dist/lambda.zip"
  function_name    = format("%.64s", "${var.global_prefix}-ai-32-register-validate-speech-to-text")
  role             = aws_iam_role.iam_for_exec_lambda.arn
  handler          = "index.handler"
  source_code_hash = filebase64sha256("../workflows/ai/32-register-validate-speech-to-text/build/dist/lambda.zip")
  runtime          = "nodejs10.x"
  timeout          = "900"
  memory_size      = "3008"

  environment {
    variables = {
      LogGroupName     = var.global_prefix
      ServicesUrl      = var.services_url
      ServicesAuthType = var.service_registry_auth_type
      RepositoryBucket = var.repository_bucket_name
      TempBucket       = var.temp_bucket_name
      WebsiteBucket    = var.website_bucket_name
    }
  }
}

resource "aws_lambda_function" "ai_04_translate_speech_transcription" {
  filename         = "../workflows/ai/04-translate-speech-transcription/build/dist/lambda.zip"
  function_name    = format("%.64s", "${var.global_prefix}-ai-04-translate-speech-transcription")
  role             = aws_iam_role.iam_for_exec_lambda.arn
  handler          = "index.handler"
  source_code_hash = filebase64sha256("../workflows/ai/04-translate-speech-transcription/build/dist/lambda.zip")
  runtime          = "nodejs10.x"
  timeout          = "900"
  memory_size      = "3008"

  environment {
    variables = {
      LogGroupName     = var.global_prefix
      ServicesUrl         = var.services_url
      ServicesAuthType    = var.service_registry_auth_type
      RepositoryBucket    = var.repository_bucket_name
      TempBucket          = var.temp_bucket_name
      WebsiteBucket       = var.website_bucket_name
      ActivityCallbackUrl = local.workflow_activity_callback_handler_url
      ActivityArn         = aws_sfn_activity.ai_04_translate_speech_transcription.id
    }
  }
}

resource "aws_sfn_activity" "ai_04_translate_speech_transcription" {
  name = "${var.global_prefix}-ai-04-translate-speech-transcription"
}

resource "aws_lambda_function" "ai_05_register_speech_translation" {
  filename         = "../workflows/ai/05-register-speech-translation/build/dist/lambda.zip"
  function_name    = format("%.64s", "${var.global_prefix}-ai-05-register-speech-translation")
  role             = aws_iam_role.iam_for_exec_lambda.arn
  handler          = "index.handler"
  source_code_hash = filebase64sha256("../workflows/ai/05-register-speech-translation/build/dist/lambda.zip")
  runtime          = "nodejs10.x"
  timeout          = "900"
  memory_size      = "3008"

  environment {
    variables = {
      LogGroupName     = var.global_prefix
      ServicesUrl      = var.services_url
      ServicesAuthType = var.service_registry_auth_type
      RepositoryBucket = var.repository_bucket_name
      TempBucket       = var.temp_bucket_name
      WebsiteBucket    = var.website_bucket_name
    }
  }
}

resource "aws_lambda_function" "ai_06_detect_celebrities_aws" {
  filename         = "../workflows/ai/06-detect-celebrities-aws/build/dist/lambda.zip"
  function_name    = format("%.64s", "${var.global_prefix}-ai-06-detect-celebrities-aws")
  role             = aws_iam_role.iam_for_exec_lambda.arn
  handler          = "index.handler"
  source_code_hash = filebase64sha256("../workflows/ai/06-detect-celebrities-aws/build/dist/lambda.zip")
  runtime          = "nodejs10.x"
  timeout          = "900"
  memory_size      = "3008"

  environment {
    variables = {
      LogGroupName     = var.global_prefix
      ServicesUrl         = var.services_url
      ServicesAuthType    = var.service_registry_auth_type
      RepositoryBucket    = var.repository_bucket_name
      TempBucket          = var.temp_bucket_name
      WebsiteBucket       = var.website_bucket_name
      ActivityCallbackUrl = local.workflow_activity_callback_handler_url
      ActivityArn         = aws_sfn_activity.ai_06_detect_celebrities_aws.id
    }
  }
}

resource "aws_sfn_activity" "ai_06_detect_celebrities_aws" {
  name = "${var.global_prefix}-ai-06-detect-celebrities-aws"
}

resource "aws_lambda_function" "ai_07_register_celebrities_info_aws" {
  filename         = "../workflows/ai/07-register-celebrities-info-aws/build/dist/lambda.zip"
  function_name    = format("%.64s", "${var.global_prefix}-ai-07-register-celebrities-info-aws")
  role             = aws_iam_role.iam_for_exec_lambda.arn
  handler          = "index.handler"
  source_code_hash = filebase64sha256("../workflows/ai/07-register-celebrities-info-aws/build/dist/lambda.zip")
  runtime          = "nodejs10.x"
  timeout          = "900"
  memory_size      = "3008"

  environment {
    variables = {
      LogGroupName     = var.global_prefix
      ServicesUrl      = var.services_url
      ServicesAuthType = var.service_registry_auth_type
      RepositoryBucket = var.repository_bucket_name
      TempBucket       = var.temp_bucket_name
      WebsiteBucket    = var.website_bucket_name
    }
  }
}

resource "aws_lambda_function" "ai_08_detect_celebrities_azure" {
  filename         = "../workflows/ai/08-detect-celebrities-azure/build/dist/lambda.zip"
  function_name    = format("%.64s", "${var.global_prefix}-ai-08-detect-celebrities-azure")
  role             = aws_iam_role.iam_for_exec_lambda.arn
  handler          = "index.handler"
  source_code_hash = filebase64sha256("../workflows/ai/08-detect-celebrities-azure/build/dist/lambda.zip")
  runtime          = "nodejs10.x"
  timeout          = "900"
  memory_size      = "3008"

  environment {
    variables = {
      LogGroupName     = var.global_prefix
      ServicesUrl         = var.services_url
      ServicesAuthType    = var.service_registry_auth_type
      RepositoryBucket    = var.repository_bucket_name
      TempBucket          = var.temp_bucket_name
      WebsiteBucket       = var.website_bucket_name
      ActivityCallbackUrl = local.workflow_activity_callback_handler_url
      ActivityArn         = aws_sfn_activity.ai_08_detect_celebrities_azure.id
    }
  }
}

resource "aws_sfn_activity" "ai_08_detect_celebrities_azure" {
  name = "${var.global_prefix}-ai-08-detect-celebrities-azure"
}

resource "aws_lambda_function" "ai_09_register_celebrities_info_azure" {
  filename         = "../workflows/ai/09-register-celebrities-info-azure/build/dist/lambda.zip"
  function_name    = format("%.64s", "${var.global_prefix}-ai-09-register-celebrities-info-azure")
  role             = aws_iam_role.iam_for_exec_lambda.arn
  handler          = "index.handler"
  source_code_hash = filebase64sha256("../workflows/ai/09-register-celebrities-info-azure/build/dist/lambda.zip")
  runtime          = "nodejs10.x"
  timeout          = "900"
  memory_size      = "3008"

  environment {
    variables = {
      LogGroupName     = var.global_prefix
      ServicesUrl      = var.services_url
      ServicesAuthType = var.service_registry_auth_type
      RepositoryBucket = var.repository_bucket_name
      TempBucket       = var.temp_bucket_name
      WebsiteBucket    = var.website_bucket_name
    }
  }
}

resource "aws_lambda_function" "ai_10_detect_emotions_aws" {
  filename         = "../workflows/ai/10-detect-emotions-aws/build/dist/lambda.zip"
  function_name    = format("%.64s", "${var.global_prefix}-ai-10-detect-emotions-aws")
  role             = aws_iam_role.iam_for_exec_lambda.arn
  handler          = "index.handler"
  source_code_hash = filebase64sha256("../workflows/ai/10-detect-emotions-aws/build/dist/lambda.zip")
  runtime          = "nodejs10.x"
  timeout          = "900"
  memory_size      = "3008"

  environment {
    variables = {
      LogGroupName     = var.global_prefix
      ServicesUrl         = var.services_url
      ServicesAuthType    = var.service_registry_auth_type
      RepositoryBucket    = var.repository_bucket_name
      TempBucket          = var.temp_bucket_name
      WebsiteBucket       = var.website_bucket_name
      ActivityCallbackUrl = local.workflow_activity_callback_handler_url
      ActivityArn         = aws_sfn_activity.ai_10_detect_emotions_aws.id
    }
  }
}

resource "aws_sfn_activity" "ai_10_detect_emotions_aws" {
  name = "${var.global_prefix}-ai-10-detect-emotions-aws"
}

resource "aws_lambda_function" "ai_11_register_emotions_info_aws" {
  filename         = "../workflows/ai/11-register-emotions-info-aws/build/dist/lambda.zip"
  function_name    = format("%.64s", "${var.global_prefix}-ai-11-register-emotions-info-aws")
  role             = aws_iam_role.iam_for_exec_lambda.arn
  handler          = "index.handler"
  source_code_hash = filebase64sha256("../workflows/ai/11-register-emotions-info-aws/build/dist/lambda.zip")
  runtime          = "nodejs10.x"
  timeout          = "900"
  memory_size      = "3008"

  environment {
    variables = {
      LogGroupName     = var.global_prefix
      ServicesUrl      = var.services_url
      ServicesAuthType = var.service_registry_auth_type
      RepositoryBucket = var.repository_bucket_name
      TempBucket       = var.temp_bucket_name
      WebsiteBucket    = var.website_bucket_name
    }
  }
}

resource "aws_lambda_function" "ai_12_translation_to_speech" {
  filename         = "../workflows/ai/12-translation-to-speech/build/dist/lambda.zip"
  function_name    = format("%.64s", "${var.global_prefix}-ai-12-translation-to-speech")
  role             = aws_iam_role.iam_for_exec_lambda.arn
  handler          = "index.handler"
  source_code_hash = filebase64sha256("../workflows/ai/12-translation-to-speech/build/dist/lambda.zip")
  runtime          = "nodejs10.x"
  timeout          = "900"
  memory_size      = "3008"

  environment {
    variables = {
      LogGroupName     = var.global_prefix
      ServicesUrl         = var.services_url
      ServicesAuthType    = var.service_registry_auth_type
      RepositoryBucket    = var.repository_bucket_name
      TempBucket          = var.temp_bucket_name
      WebsiteBucket       = var.website_bucket_name
      ActivityCallbackUrl = local.workflow_activity_callback_handler_url
      ActivityArn         = aws_sfn_activity.ai_12_translation_to_speech.id
    }
  }
}

resource "aws_sfn_activity" "ai_12_translation_to_speech" {
  name = "${var.global_prefix}-ai-12-translation-to-speech"
}

resource "aws_lambda_function" "ai_13_register_translation_to_speech" {
  filename         = "../workflows/ai/13-register-translation-to-speech/build/dist/lambda.zip"
  function_name    = format("%.64s", "${var.global_prefix}-ai-13-register-translation-to-speech")
  role             = aws_iam_role.iam_for_exec_lambda.arn
  handler          = "index.handler"
  source_code_hash = filebase64sha256("../workflows/ai/13-register-translation-to-speech/build/dist/lambda.zip")
  runtime          = "nodejs10.x"
  timeout          = "900"
  memory_size      = "3008"

  environment {
    variables = {
      LogGroupName     = var.global_prefix
      ServicesUrl      = var.services_url
      ServicesAuthType = var.service_registry_auth_type
      RepositoryBucket = var.repository_bucket_name
      TempBucket       = var.temp_bucket_name
      WebsiteBucket    = var.website_bucket_name
    }
  }
}

resource "aws_lambda_function" "ai_14_tokenized_translation_to_speech" {
  filename         = "../workflows/ai/14-tokenized-translation-to-speech/build/dist/lambda.zip"
  function_name    = format("%.64s", "${var.global_prefix}-ai-14-tokenized-translation-to-speech")
  role             = aws_iam_role.iam_for_exec_lambda.arn
  handler          = "index.handler"
  source_code_hash = filebase64sha256("../workflows/ai/14-tokenized-translation-to-speech/build/dist/lambda.zip")
  runtime          = "nodejs10.x"
  timeout          = "900"
  memory_size      = "3008"

  environment {
    variables = {
      LogGroupName     = var.global_prefix
      ServicesUrl         = var.services_url
      ServicesAuthType    = var.service_registry_auth_type
      RepositoryBucket    = var.repository_bucket_name
      TempBucket          = var.temp_bucket_name
      WebsiteBucket       = var.website_bucket_name
      ActivityCallbackUrl = local.workflow_activity_callback_handler_url
      ActivityArn         = aws_sfn_activity.ai_14_tokenized_translation_to_speech.id
    }
  }
}

resource "aws_sfn_activity" "ai_14_tokenized_translation_to_speech" {
  name = "${var.global_prefix}-ai-14-tokenized-translation-to-speech"
}

resource "aws_lambda_function" "ai_15_register_tokenized_translation_to_speech" {
  filename         = "../workflows/ai/15-register-tokenized-translation-to-speech/build/dist/lambda.zip"
  function_name    = format("%.64s", "${var.global_prefix}-ai-15-register-tokenized-translation-to-speech")
  role             = aws_iam_role.iam_for_exec_lambda.arn
  handler          = "index.handler"
  source_code_hash = filebase64sha256("../workflows/ai/15-register-tokenized-translation-to-speech/build/dist/lambda.zip")
  runtime          = "nodejs10.x"
  timeout          = "900"
  memory_size      = "3008"

  environment {
    variables = {
      LogGroupName     = var.global_prefix
      ServicesUrl      = var.services_url
      ServicesAuthType = var.service_registry_auth_type
      RepositoryBucket = var.repository_bucket_name
      TempBucket       = var.temp_bucket_name
      WebsiteBucket    = var.website_bucket_name
    }
  }
}

resource "aws_lambda_function" "ai_16_ssml_translation_to_speech" {
  filename         = "../workflows/ai/16-ssml-translation-to-speech/build/dist/lambda.zip"
  function_name    = format("%.64s", "${var.global_prefix}-ai-16-ssml-translation-to-speech")
  role             = aws_iam_role.iam_for_exec_lambda.arn
  handler          = "index.handler"
  source_code_hash = filebase64sha256("../workflows/ai/16-ssml-translation-to-speech/build/dist/lambda.zip")
  runtime          = "nodejs10.x"
  timeout          = "900"
  memory_size      = "3008"

  environment {
    variables = {
      LogGroupName     = var.global_prefix
      ServicesUrl         = var.services_url
      ServicesAuthType    = var.service_registry_auth_type
      RepositoryBucket    = var.repository_bucket_name
      TempBucket          = var.temp_bucket_name
      WebsiteBucket       = var.website_bucket_name
      ActivityCallbackUrl = local.workflow_activity_callback_handler_url
      ActivityArn         = aws_sfn_activity.ai_16_ssml_translation_to_speech.id
    }
  }
}

resource "aws_sfn_activity" "ai_16_ssml_translation_to_speech" {
  name = "${var.global_prefix}-ai-16-ssml-translation-to-speech"
}

resource "aws_lambda_function" "ai_17_register_ssml_translation_to_speech" {
  filename         = "../workflows/ai/17-register-ssml-translation-to-speech/build/dist/lambda.zip"
  function_name    = format("%.64s", "${var.global_prefix}-ai-17-register-ssml-translation-to-speech")
  role             = aws_iam_role.iam_for_exec_lambda.arn
  handler          = "index.handler"
  source_code_hash = filebase64sha256("../workflows/ai/17-register-ssml-translation-to-speech/build/dist/lambda.zip")
  runtime          = "nodejs10.x"
  timeout          = "900"
  memory_size      = "3008"

  environment {
    variables = {
      LogGroupName     = var.global_prefix
      ServicesUrl      = var.services_url
      ServicesAuthType = var.service_registry_auth_type
      RepositoryBucket = var.repository_bucket_name
      TempBucket       = var.temp_bucket_name
      WebsiteBucket    = var.website_bucket_name
    }
  }
}

resource "aws_lambda_function" "ai_18_dubbing_srt" {
  filename         = "../workflows/ai/18-dubbing-srt/build/dist/lambda.zip"
  function_name    = format("%.64s", "${var.global_prefix}-ai-18-dubbing-srt")
  role             = aws_iam_role.iam_for_exec_lambda.arn
  handler          = "index.handler"
  source_code_hash = filebase64sha256("../workflows/ai/18-dubbing-srt/build/dist/lambda.zip")
  runtime          = "nodejs10.x"
  timeout          = "900"
  memory_size      = "3008"

  environment {
    variables = {
      LogGroupName     = var.global_prefix
      ServicesUrl         = var.services_url
      ServicesAuthType    = var.service_registry_auth_type
      RepositoryBucket    = var.repository_bucket_name
      TempBucket          = var.temp_bucket_name
      WebsiteBucket       = var.website_bucket_name
      ActivityCallbackUrl = local.workflow_activity_callback_handler_url
      ActivityArn         = aws_sfn_activity.ai_18_dubbing_srt.id
    }
  }
}

resource "aws_sfn_activity" "ai_18_dubbing_srt" {
  name = "${var.global_prefix}-ai-18-dubbing-srt"
}

resource "aws_lambda_function" "ai_19_register_dubbing_srt" {
  filename         = "../workflows/ai/19-register-dubbing-srt/build/dist/lambda.zip"
  function_name    = format("%.64s", "${var.global_prefix}-ai-19-register-dubbing-srt")
  role             = aws_iam_role.iam_for_exec_lambda.arn
  handler          = "index.handler"
  source_code_hash = filebase64sha256("../workflows/ai/19-register-dubbing-srt/build/dist/lambda.zip")
  runtime          = "nodejs10.x"
  timeout          = "900"
  memory_size      = "3008"

  environment {
    variables = {
      LogGroupName     = var.global_prefix
      ServicesUrl      = var.services_url
      ServicesAuthType = var.service_registry_auth_type
      RepositoryBucket = var.repository_bucket_name
      TempBucket       = var.temp_bucket_name
      WebsiteBucket    = var.website_bucket_name
    }
  }
}

resource "aws_lambda_function" "ai_20_rekognition_aws" {
  filename         = "../workflows/ai/20-rekognition-aws/build/dist/lambda.zip"
  function_name    = format("%.64s", "${var.global_prefix}-ai-20-rekognition-aws")
  role             = aws_iam_role.iam_for_exec_lambda.arn
  handler          = "index.handler"
  source_code_hash = filebase64sha256("../workflows/ai/20-rekognition-aws/build/dist/lambda.zip")
  runtime          = "nodejs10.x"
  timeout          = "900"
  memory_size      = "3008"

  environment {
    variables = {
      LogGroupName     = var.global_prefix
      ServicesUrl      = var.services_url
      ServicesAuthType = var.service_registry_auth_type
      RepositoryBucket = var.repository_bucket_name
      TempBucket       = var.temp_bucket_name
      WebsiteBucket    = var.website_bucket_name
    }
  }
}

resource "aws_lambda_function" "ai_41_validate_speech_to_text_azure" {
  filename         = "../workflows/ai/41-validate-speech-to-text-azure/build/dist/lambda.zip"
  function_name    = format("%.64s", "${var.global_prefix}-ai-41-validate-speech-to-text-azure")
  role             = aws_iam_role.iam_for_exec_lambda.arn
  handler          = "index.handler"
  source_code_hash = filebase64sha256("../workflows/ai/41-validate-speech-to-text-azure/build/dist/lambda.zip")
  runtime          = "nodejs10.x"
  timeout          = "900"
  memory_size      = "3008"

  environment {
    variables = {
      LogGroupName     = var.global_prefix
      ServicesUrl         = var.services_url
      ServicesAuthType    = var.service_registry_auth_type
      RepositoryBucket    = var.repository_bucket_name
      TempBucket          = var.temp_bucket_name
      WebsiteBucket       = var.website_bucket_name
      ActivityCallbackUrl = local.workflow_activity_callback_handler_url
      ActivityArn         = aws_sfn_activity.ai_41_validate_speech_to_text_azure.id
    }
  }
}

resource "aws_sfn_activity" "ai_41_validate_speech_to_text_azure" {
  name = "${var.global_prefix}-ai-41-validate-speech-to-text-azure"
}

resource "aws_lambda_function" "ai_42_register_validate_speech_to_text_azure" {
  filename         = "../workflows/ai/42-register-validate-speech-to-text-azure/build/dist/lambda.zip"
  function_name    = format("%.64s", "${var.global_prefix}-ai-42-register-validate-speech-to-text-azure")
  role             = aws_iam_role.iam_for_exec_lambda.arn
  handler          = "index.handler"
  source_code_hash = filebase64sha256("../workflows/ai/42-register-validate-speech-to-text-azure/build/dist/lambda.zip")
  runtime          = "nodejs10.x"
  timeout          = "900"
  memory_size      = "3008"

  environment {
    variables = {
      LogGroupName     = var.global_prefix
      ServicesUrl      = var.services_url
      ServicesAuthType = var.service_registry_auth_type
      RepositoryBucket = var.repository_bucket_name
      TempBucket       = var.temp_bucket_name
      WebsiteBucket    = var.website_bucket_name
    }
  }
}


resource "aws_lambda_function" "ai_61_extract_audio_google" {
  filename         = "../workflows/ai/61-extract-audio-google/build/dist/lambda.zip"
  function_name    = format("%.64s", "${var.global_prefix}-ai-61-extract-audio-google")
  role             = aws_iam_role.iam_for_exec_lambda.arn
  handler          = "index.handler"
  source_code_hash = filebase64sha256("../workflows/ai/61-extract-audio-google/build/dist/lambda.zip")
  runtime          = "nodejs10.x"
  timeout          = "900"
  memory_size      = "3008"

  environment {
    variables = {
      LogGroupName     = var.global_prefix
      ServicesUrl         = var.services_url
      ServicesAuthType    = var.service_registry_auth_type
      RepositoryBucket    = var.repository_bucket_name
      TempBucket          = var.temp_bucket_name
      WebsiteBucket       = var.website_bucket_name
      ActivityCallbackUrl = local.workflow_activity_callback_handler_url
      ActivityArn         = aws_sfn_activity.ai_61_extract_audio_google.id
    }
  }
}

resource "aws_sfn_activity" "ai_61_extract_audio_google" {
  name = "${var.global_prefix}-ai-61-extract-audio-google"
}

resource "aws_lambda_function" "ai_62_register_extract_audio_google" {
  filename         = "../workflows/ai/62-register-extract-audio-google/build/dist/lambda.zip"
  function_name    = format("%.64s", "${var.global_prefix}-ai-62-register-extract-audio-google")
  role             = aws_iam_role.iam_for_exec_lambda.arn
  handler          = "index.handler"
  source_code_hash = filebase64sha256("../workflows/ai/62-register-extract-audio-google/build/dist/lambda.zip")
  runtime          = "nodejs10.x"
  timeout          = "900"
  memory_size      = "3008"

  environment {
    variables = {
      LogGroupName     = var.global_prefix
      ServicesUrl      = var.services_url
      ServicesAuthType = var.service_registry_auth_type
      RepositoryBucket = var.repository_bucket_name
      TempBucket       = var.temp_bucket_name
      WebsiteBucket    = var.website_bucket_name
    }
  }
}

resource "aws_lambda_function" "ai_63_validate_speech_to_text_google" {
  filename         = "../workflows/ai/63-validate-speech-to-text-google/build/dist/lambda.zip"
  function_name    = format("%.64s", "${var.global_prefix}-ai-63-validate-speech-to-text-google")
  role             = aws_iam_role.iam_for_exec_lambda.arn
  handler          = "index.handler"
  source_code_hash = filebase64sha256("../workflows/ai/63-validate-speech-to-text-google/build/dist/lambda.zip")
  runtime          = "nodejs10.x"
  timeout          = "900"
  memory_size      = "3008"

  environment {
    variables = {
      LogGroupName     = var.global_prefix
      ServicesUrl         = var.services_url
      ServicesAuthType    = var.service_registry_auth_type
      RepositoryBucket    = var.repository_bucket_name
      TempBucket          = var.temp_bucket_name
      WebsiteBucket       = var.website_bucket_name
      ActivityCallbackUrl = local.workflow_activity_callback_handler_url
      ActivityArn         = aws_sfn_activity.ai_63_validate_speech_to_text_google.id
    }
  }
}

resource "aws_sfn_activity" "ai_63_validate_speech_to_text_google" {
  name = "${var.global_prefix}-ai-63-validate-speech-to-text-google"
}

resource "aws_lambda_function" "ai_64_register_validate_speech_to_text_google" {
  filename         = "../workflows/ai/64-register-validate-speech-to-text-google/build/dist/lambda.zip"
  function_name    = format("%.64s", "${var.global_prefix}-ai-64-register-validate-speech-to-text-google")
  role             = aws_iam_role.iam_for_exec_lambda.arn
  handler          = "index.handler"
  source_code_hash = filebase64sha256("../workflows/ai/64-register-validate-speech-to-text-google/build/dist/lambda.zip")
  runtime          = "nodejs10.x"
  timeout          = "900"
  memory_size      = "3008"

  environment {
    variables = {
      LogGroupName     = var.global_prefix
      ServicesUrl      = var.services_url
      ServicesAuthType = var.service_registry_auth_type
      RepositoryBucket = var.repository_bucket_name
      TempBucket       = var.temp_bucket_name
      WebsiteBucket    = var.website_bucket_name
    }
  }
}


# #################################
# #  Step Functions : AI Workflow
# #################################

resource "aws_sfn_state_machine" "ai_workflow" {
  name       = "${var.global_prefix}-ai-workflow"
  role_arn   = aws_iam_role.iam_for_state_machine_execution.arn
  definition = templatefile("workflows/ai.json", {
    lambda-01-validate-workflow-input                  = aws_lambda_function.ai_01_validate_workflow_input.arn
    lambda-02-extract-speech-to-text                   = aws_lambda_function.ai_02_extract_speech_to_text.arn
    activity-02-extract-speech-to-text                 = aws_sfn_activity.ai_02_extract_speech_to_text.id
    lambda-03-register-speech-to-text-output           = aws_lambda_function.ai_03_register_speech_to_text_output.arn
    lambda-04-translate-speech-transcription           = aws_lambda_function.ai_04_translate_speech_transcription.arn
    activity-04-translate-speech-transcription         = aws_sfn_activity.ai_04_translate_speech_transcription.id
    lambda-05-register-speech-translation              = aws_lambda_function.ai_05_register_speech_translation.arn
    lambda-06-detect-celebrities-aws                   = aws_lambda_function.ai_06_detect_celebrities_aws.arn
    activity-06-detect-celebrities-aws                 = aws_sfn_activity.ai_06_detect_celebrities_aws.id
    lambda-08-detect-celebrities-azure                 = aws_lambda_function.ai_08_detect_celebrities_azure.arn
    activity-08-detect-celebrities-azure               = aws_sfn_activity.ai_08_detect_celebrities_azure.id
    lambda-07-register-celebrities-info-aws            = aws_lambda_function.ai_07_register_celebrities_info_aws.arn
    lambda-09-register-celebrities-info-azure          = aws_lambda_function.ai_09_register_celebrities_info_azure.arn
    lambda-10-detect-emotions-aws                      = aws_lambda_function.ai_10_detect_emotions_aws.arn
    activity-10-detect-emotions-aws                    = aws_sfn_activity.ai_10_detect_emotions_aws.id
    lambda-11-register-emotions-info-aws               = aws_lambda_function.ai_11_register_emotions_info_aws.arn
    lambda-12-translation-to-speech                    = aws_lambda_function.ai_12_translation_to_speech.arn
    activity-12-translation-to-speech                  = aws_sfn_activity.ai_12_translation_to_speech.id
    lambda-13-register-translation-to-speech           = aws_lambda_function.ai_13_register_translation_to_speech.arn
    lambda-14-tokenized-translation-to-speech          = aws_lambda_function.ai_14_tokenized_translation_to_speech.arn
    activity-14-tokenized-translation-to-speech        = aws_sfn_activity.ai_14_tokenized_translation_to_speech.id
    lambda-15-register-tokenized-translation-to-speech = aws_lambda_function.ai_15_register_tokenized_translation_to_speech.arn
    lambda-16-ssml-translation-to-speech               = aws_lambda_function.ai_16_ssml_translation_to_speech.arn
    activity-16-ssml-translation-to-speech             = aws_sfn_activity.ai_16_ssml_translation_to_speech.id
    lambda-17-register-ssml-translation-to-speech      = aws_lambda_function.ai_17_register_ssml_translation_to_speech.arn

    lambda-18-dubbing-srt          = aws_lambda_function.ai_18_dubbing_srt.arn
    activity-18-dubbing-srt        = aws_sfn_activity.ai_18_dubbing_srt.id
    lambda-19-register-dubbing-srt = aws_lambda_function.ai_19_register_dubbing_srt.arn

    lambda-20-rekognition-aws = aws_lambda_function.ai_20_rekognition_aws.arn

    lambda-31-validate-speech-to-text          = aws_lambda_function.ai_31_validate_speech_to_text.arn
    activity-31-validate-speech-to-text        = aws_sfn_activity.ai_31_validate_speech_to_text.id
    lambda-32-register-validate-speech-to-text = aws_lambda_function.ai_32_register_validate_speech_to_text.arn

    lambda-41-validate-speech-to-text-azure          = aws_lambda_function.ai_41_validate_speech_to_text_azure.arn
    activity-41-validate-speech-to-text-azure        = aws_sfn_activity.ai_41_validate_speech_to_text_azure.id
    lambda-42-register-validate-speech-to-text-azure = aws_lambda_function.ai_42_register_validate_speech_to_text_azure.arn

    lambda-61-extract-audio-google          = aws_lambda_function.ai_61_extract_audio_google.arn
    activity-61-extract-audio-google        = aws_sfn_activity.ai_61_extract_audio_google.id
    lambda-62-register-extract-audio-google = aws_lambda_function.ai_62_register_extract_audio_google.arn

    lambda-63-validate-speech-to-text-google          = aws_lambda_function.ai_63_validate_speech_to_text_google.arn
    activity-63-validate-speech-to-text-google        = aws_sfn_activity.ai_63_validate_speech_to_text_google.id
    lambda-64-register-validate-speech-to-text-google = aws_lambda_function.ai_64_register_validate_speech_to_text_google.arn

    lambda-process-workflow-completion = aws_lambda_function.process_workflow_completion.arn
    lambda-process-workflow-failure    = aws_lambda_function.process_workflow_failure.arn
  })
}
