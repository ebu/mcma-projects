# #################################
# #  Step Functions : Lambdas for ai Workflow
# #################################

resource "aws_lambda_function" ai_001_validate_workflow_input {
  filename         = "../workflows/ai/001-validate-workflow-input/build/dist/lambda.zip"
  function_name    = format("%.64s", "${var.global_prefix}-ai-001-validate-workflow-input")
  role             = aws_iam_role.iam_for_exec_lambda.arn
  handler          = "index.handler"
  source_code_hash = filebase64sha256("../workflows/ai/001-validate-workflow-input/build/dist/lambda.zip")
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

resource "aws_lambda_function" ai_101_extract_speech_to_text {
  filename         = "../workflows/ai/101-extract-speech-to-text/build/dist/lambda.zip"
  function_name    = format("%.64s", "${var.global_prefix}-ai-101-extract-speech-to-text")
  role             = aws_iam_role.iam_for_exec_lambda.arn
  handler          = "index.handler"
  source_code_hash = filebase64sha256("../workflows/ai/101-extract-speech-to-text/build/dist/lambda.zip")
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
      ActivityArn         = aws_sfn_activity.ai_101_extract_speech_to_text.id
    }
  }
}

resource "aws_sfn_activity" ai_101_extract_speech_to_text {
  name = "${var.global_prefix}-ai-101-extract-speech-to-text"
}

resource "aws_lambda_function" ai_102_register_speech_to_text_output {
  filename         = "../workflows/ai/102-register-speech-to-text-output/build/dist/lambda.zip"
  function_name    = format("%.64s", "${var.global_prefix}-ai-102-register-speech-to-text-output")
  role             = aws_iam_role.iam_for_exec_lambda.arn
  handler          = "index.handler"
  source_code_hash = filebase64sha256("../workflows/ai/102-register-speech-to-text-output/build/dist/lambda.zip")
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


resource "aws_lambda_function" ai_103_validate_speech_to_text {
  filename         = "../workflows/ai/103-validate-speech-to-text/build/dist/lambda.zip"
  function_name    = format("%.64s", "${var.global_prefix}-ai-103-validate-speech-to-text")
  role             = aws_iam_role.iam_for_exec_lambda.arn
  handler          = "index.handler"
  source_code_hash = filebase64sha256("../workflows/ai/103-validate-speech-to-text/build/dist/lambda.zip")
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
      ActivityArn         = aws_sfn_activity.ai_103_validate_speech_to_text.id
    }
  }
}

resource "aws_sfn_activity" ai_103_validate_speech_to_text {
  name = "${var.global_prefix}-ai-103-validate-speech-to-text"
}

resource "aws_lambda_function" ai_104_register_validate_speech_to_text {
  filename         = "../workflows/ai/104-register-validate-speech-to-text/build/dist/lambda.zip"
  function_name    = format("%.64s", "${var.global_prefix}-ai-104-register-validate-speech-to-text")
  role             = aws_iam_role.iam_for_exec_lambda.arn
  handler          = "index.handler"
  source_code_hash = filebase64sha256("../workflows/ai/104-register-validate-speech-to-text/build/dist/lambda.zip")
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

resource "aws_lambda_function" ai_105_translate_speech_transcription {
  filename         = "../workflows/ai/105-translate-speech-transcription/build/dist/lambda.zip"
  function_name    = format("%.64s", "${var.global_prefix}-ai-105-translate-speech-transcription")
  role             = aws_iam_role.iam_for_exec_lambda.arn
  handler          = "index.handler"
  source_code_hash = filebase64sha256("../workflows/ai/105-translate-speech-transcription/build/dist/lambda.zip")
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
      ActivityArn         = aws_sfn_activity.ai_105_translate_speech_transcription.id
    }
  }
}

resource "aws_sfn_activity" ai_105_translate_speech_transcription {
  name = "${var.global_prefix}-ai-105-translate-speech-transcription"
}

resource "aws_lambda_function" ai_106_register_speech_translation {
  filename         = "../workflows/ai/106-register-speech-translation/build/dist/lambda.zip"
  function_name    = format("%.64s", "${var.global_prefix}-ai-106-register-speech-translation")
  role             = aws_iam_role.iam_for_exec_lambda.arn
  handler          = "index.handler"
  source_code_hash = filebase64sha256("../workflows/ai/106-register-speech-translation/build/dist/lambda.zip")
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

resource "aws_lambda_function" ai_107_tokenized_translation_to_speech {
  filename         = "../workflows/ai/107-tokenized-translation-to-speech/build/dist/lambda.zip"
  function_name    = format("%.64s", "${var.global_prefix}-ai-107-tokenized-translation-to-speech")
  role             = aws_iam_role.iam_for_exec_lambda.arn
  handler          = "index.handler"
  source_code_hash = filebase64sha256("../workflows/ai/107-tokenized-translation-to-speech/build/dist/lambda.zip")
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
      ActivityArn         = aws_sfn_activity.ai_107_tokenized_translation_to_speech.id
    }
  }
}

resource "aws_sfn_activity" ai_107_tokenized_translation_to_speech {
  name = "${var.global_prefix}-ai-107-tokenized-translation-to-speech"
}

resource "aws_lambda_function" ai_108_register_tokenized_translation_to_speech {
  filename         = "../workflows/ai/108-register-tokenized-translation-to-speech/build/dist/lambda.zip"
  function_name    = format("%.64s", "${var.global_prefix}-ai-108-register-tokenized-translation-to-speech")
  role             = aws_iam_role.iam_for_exec_lambda.arn
  handler          = "index.handler"
  source_code_hash = filebase64sha256("../workflows/ai/108-register-tokenized-translation-to-speech/build/dist/lambda.zip")
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

resource "aws_lambda_function" ai_109_ssml_translation_to_speech {
  filename         = "../workflows/ai/109-ssml-translation-to-speech/build/dist/lambda.zip"
  function_name    = format("%.64s", "${var.global_prefix}-ai-109-ssml-translation-to-speech")
  role             = aws_iam_role.iam_for_exec_lambda.arn
  handler          = "index.handler"
  source_code_hash = filebase64sha256("../workflows/ai/109-ssml-translation-to-speech/build/dist/lambda.zip")
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
      ActivityArn         = aws_sfn_activity.ai_109_ssml_translation_to_speech.id
    }
  }
}

resource "aws_sfn_activity" ai_109_ssml_translation_to_speech {
  name = "${var.global_prefix}-ai-109-ssml-translation-to-speech"
}

resource "aws_lambda_function" ai_110_register_ssml_translation_to_speech {
  filename         = "../workflows/ai/110-register-ssml-translation-to-speech/build/dist/lambda.zip"
  function_name    = format("%.64s", "${var.global_prefix}-ai-110-register-ssml-translation-to-speech")
  role             = aws_iam_role.iam_for_exec_lambda.arn
  handler          = "index.handler"
  source_code_hash = filebase64sha256("../workflows/ai/110-register-ssml-translation-to-speech/build/dist/lambda.zip")
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

resource "aws_lambda_function" ai_111_dubbing_srt {
  filename         = "../workflows/ai/111-dubbing-srt/build/dist/lambda.zip"
  function_name    = format("%.64s", "${var.global_prefix}-ai-111-dubbing-srt")
  role             = aws_iam_role.iam_for_exec_lambda.arn
  handler          = "index.handler"
  source_code_hash = filebase64sha256("../workflows/ai/111-dubbing-srt/build/dist/lambda.zip")
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
      ActivityArn         = aws_sfn_activity.ai_111_dubbing_srt.id
    }
  }
}

resource "aws_sfn_activity" ai_111_dubbing_srt {
  name = "${var.global_prefix}-ai-111-dubbing-srt"
}

resource "aws_lambda_function" ai_112_register_dubbing_srt {
  filename         = "../workflows/ai/112-register-dubbing-srt/build/dist/lambda.zip"
  function_name    = format("%.64s", "${var.global_prefix}-ai-112-register-dubbing-srt")
  role             = aws_iam_role.iam_for_exec_lambda.arn
  handler          = "index.handler"
  source_code_hash = filebase64sha256("../workflows/ai/112-register-dubbing-srt/build/dist/lambda.zip")
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

resource "aws_lambda_function" ai_201_detect_celebrities_azure {
  filename         = "../workflows/ai/201-detect-celebrities-azure/build/dist/lambda.zip"
  function_name    = format("%.64s", "${var.global_prefix}-ai-201-detect-celebrities-azure")
  role             = aws_iam_role.iam_for_exec_lambda.arn
  handler          = "index.handler"
  source_code_hash = filebase64sha256("../workflows/ai/201-detect-celebrities-azure/build/dist/lambda.zip")
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
      ActivityArn         = aws_sfn_activity.ai_201_detect_celebrities_azure.id
    }
  }
}

resource "aws_sfn_activity" ai_201_detect_celebrities_azure {
  name = "${var.global_prefix}-ai-201-detect-celebrities-azure"
}

resource "aws_lambda_function" ai_202_register_celebrities_info_azure {
  filename         = "../workflows/ai/202-register-celebrities-info-azure/build/dist/lambda.zip"
  function_name    = format("%.64s", "${var.global_prefix}-ai-202-register-celebrities-info-azure")
  role             = aws_iam_role.iam_for_exec_lambda.arn
  handler          = "index.handler"
  source_code_hash = filebase64sha256("../workflows/ai/202-register-celebrities-info-azure/build/dist/lambda.zip")
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

resource "aws_lambda_function" ai_203_validate_speech_to_text_azure {
  filename         = "../workflows/ai/203-validate-speech-to-text-azure/build/dist/lambda.zip"
  function_name    = format("%.64s", "${var.global_prefix}-ai-203-validate-speech-to-text-azure")
  role             = aws_iam_role.iam_for_exec_lambda.arn
  handler          = "index.handler"
  source_code_hash = filebase64sha256("../workflows/ai/203-validate-speech-to-text-azure/build/dist/lambda.zip")
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
      ActivityArn         = aws_sfn_activity.ai_203_validate_speech_to_text_azure.id
    }
  }
}

resource "aws_sfn_activity" ai_203_validate_speech_to_text_azure {
  name = "${var.global_prefix}-ai-203-validate-speech-to-text-azure"
}

resource "aws_lambda_function" ai_204_register_validate_speech_to_text_azure {
  filename         = "../workflows/ai/204-register-validate-speech-to-text-azure/build/dist/lambda.zip"
  function_name    = format("%.64s", "${var.global_prefix}-ai-204-register-validate-speech-to-text-azure")
  role             = aws_iam_role.iam_for_exec_lambda.arn
  handler          = "index.handler"
  source_code_hash = filebase64sha256("../workflows/ai/204-register-validate-speech-to-text-azure/build/dist/lambda.zip")
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

resource "aws_lambda_function" ai_301_detect_celebrities_aws {
  filename         = "../workflows/ai/301-detect-celebrities-aws/build/dist/lambda.zip"
  function_name    = format("%.64s", "${var.global_prefix}-ai-301-detect-celebrities-aws")
  role             = aws_iam_role.iam_for_exec_lambda.arn
  handler          = "index.handler"
  source_code_hash = filebase64sha256("../workflows/ai/301-detect-celebrities-aws/build/dist/lambda.zip")
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
      ActivityArn         = aws_sfn_activity.ai_301_detect_celebrities_aws.id
    }
  }
}

resource "aws_sfn_activity" ai_301_detect_celebrities_aws {
  name = "${var.global_prefix}-ai-301-detect-celebrities-aws"
}

resource "aws_lambda_function" ai_302_register_celebrities_info_aws {
  filename         = "../workflows/ai/302-register-celebrities-info-aws/build/dist/lambda.zip"
  function_name    = format("%.64s", "${var.global_prefix}-ai-302-register-celebrities-info-aws")
  role             = aws_iam_role.iam_for_exec_lambda.arn
  handler          = "index.handler"
  source_code_hash = filebase64sha256("../workflows/ai/302-register-celebrities-info-aws/build/dist/lambda.zip")
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


resource "aws_lambda_function" ai_311_detect_emotions_aws {
  filename         = "../workflows/ai/311-detect-emotions-aws/build/dist/lambda.zip"
  function_name    = format("%.64s", "${var.global_prefix}-ai-311-detect-emotions-aws")
  role             = aws_iam_role.iam_for_exec_lambda.arn
  handler          = "index.handler"
  source_code_hash = filebase64sha256("../workflows/ai/311-detect-emotions-aws/build/dist/lambda.zip")
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
      ActivityArn         = aws_sfn_activity.ai_311_detect_emotions_aws.id
    }
  }
}

resource "aws_sfn_activity" ai_311_detect_emotions_aws {
  name = "${var.global_prefix}-ai-311-detect-emotions-aws"
}

resource "aws_lambda_function" ai_312_register_emotions_info_aws {
  filename         = "../workflows/ai/312-register-emotions-info-aws/build/dist/lambda.zip"
  function_name    = format("%.64s", "${var.global_prefix}-ai-312-register-emotions-info-aws")
  role             = aws_iam_role.iam_for_exec_lambda.arn
  handler          = "index.handler"
  source_code_hash = filebase64sha256("../workflows/ai/312-register-emotions-info-aws/build/dist/lambda.zip")
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

resource "aws_lambda_function" ai_321_rekognition_aws {
  filename         = "../workflows/ai/321-rekognition-aws/build/dist/lambda.zip"
  function_name    = format("%.64s", "${var.global_prefix}-ai-321-rekognition-aws")
  role             = aws_iam_role.iam_for_exec_lambda.arn
  handler          = "index.handler"
  source_code_hash = filebase64sha256("../workflows/ai/321-rekognition-aws/build/dist/lambda.zip")
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

resource "aws_lambda_function" ai_401_extract_audio_google {
  filename         = "../workflows/ai/401-extract-audio-google/build/dist/lambda.zip"
  function_name    = format("%.64s", "${var.global_prefix}-ai-401-extract-audio-google")
  role             = aws_iam_role.iam_for_exec_lambda.arn
  handler          = "index.handler"
  source_code_hash = filebase64sha256("../workflows/ai/401-extract-audio-google/build/dist/lambda.zip")
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
      ActivityArn         = aws_sfn_activity.ai_401_extract_audio_google.id
    }
  }
}

resource "aws_sfn_activity" ai_401_extract_audio_google {
  name = "${var.global_prefix}-ai-401-extract-audio-google"
}

resource "aws_lambda_function" ai_402_register_extract_audio_google {
  filename         = "../workflows/ai/402-register-extract-audio-google/build/dist/lambda.zip"
  function_name    = format("%.64s", "${var.global_prefix}-ai-402-register-extract-audio-google")
  role             = aws_iam_role.iam_for_exec_lambda.arn
  handler          = "index.handler"
  source_code_hash = filebase64sha256("../workflows/ai/402-register-extract-audio-google/build/dist/lambda.zip")
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

resource "aws_lambda_function" ai_403_speech_to_text_google {
  filename         = "../workflows/ai/403-speech-to-text-google/build/dist/lambda.zip"
  function_name    = format("%.64s", "${var.global_prefix}-ai-403-speech-to-text-google")
  role             = aws_iam_role.iam_for_exec_lambda.arn
  handler          = "index.handler"
  source_code_hash = filebase64sha256("../workflows/ai/403-speech-to-text-google/build/dist/lambda.zip")
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
      ActivityArn         = aws_sfn_activity.ai_403_speech_to_text_google.id
    }
  }
}

resource "aws_sfn_activity" ai_403_speech_to_text_google {
  name = "${var.global_prefix}-ai-403-speech-to-text-google"
}

resource "aws_lambda_function" ai_404_register_speech_to_text_google {
  filename         = "../workflows/ai/404-register-speech-to-text-google/build/dist/lambda.zip"
  function_name    = format("%.64s", "${var.global_prefix}-ai-404-register-speech-to-text-google")
  role             = aws_iam_role.iam_for_exec_lambda.arn
  handler          = "index.handler"
  source_code_hash = filebase64sha256("../workflows/ai/404-register-speech-to-text-google/build/dist/lambda.zip")
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

resource "aws_lambda_function" ai_405_validate_speech_to_text_google {
  filename         = "../workflows/ai/405-validate-speech-to-text-google/build/dist/lambda.zip"
  function_name    = format("%.64s", "${var.global_prefix}-ai-405-validate-speech-to-text-google")
  role             = aws_iam_role.iam_for_exec_lambda.arn
  handler          = "index.handler"
  source_code_hash = filebase64sha256("../workflows/ai/405-validate-speech-to-text-google/build/dist/lambda.zip")
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
      ActivityArn         = aws_sfn_activity.ai_405_validate_speech_to_text_google.id
    }
  }
}

resource "aws_sfn_activity" ai_405_validate_speech_to_text_google {
  name = "${var.global_prefix}-ai-405-validate-speech-to-text-google"
}

resource "aws_lambda_function" ai_406_register_validate_speech_to_text_google {
  filename         = "../workflows/ai/406-register-validate-speech-to-text-google/build/dist/lambda.zip"
  function_name    = format("%.64s", "${var.global_prefix}-ai-406-register-validate-speech-to-text-google")
  role             = aws_iam_role.iam_for_exec_lambda.arn
  handler          = "index.handler"
  source_code_hash = filebase64sha256("../workflows/ai/406-register-validate-speech-to-text-google/build/dist/lambda.zip")
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


# #################################
# #  Step Functions : AI Workflow
# #################################

resource "aws_sfn_state_machine" "ai_workflow" {
  name       = "${var.global_prefix}-ai-workflow"
  role_arn   = aws_iam_role.iam_for_state_machine_execution.arn
  definition = templatefile("workflows/ai.json", {
    lambda-001-validate-workflow-input = aws_lambda_function.ai_001_validate_workflow_input.arn

    lambda-101-extract-speech-to-text                   = aws_lambda_function.ai_101_extract_speech_to_text.arn
    activity-101-extract-speech-to-text                 = aws_sfn_activity.ai_101_extract_speech_to_text.id
    lambda-102-register-speech-to-text-output           = aws_lambda_function.ai_102_register_speech_to_text_output.arn
    lambda-103-validate-speech-to-text                  = aws_lambda_function.ai_103_validate_speech_to_text.arn
    activity-103-validate-speech-to-text                = aws_sfn_activity.ai_103_validate_speech_to_text.id
    lambda-104-register-validate-speech-to-text         = aws_lambda_function.ai_104_register_validate_speech_to_text.arn
    lambda-105-translate-speech-transcription           = aws_lambda_function.ai_105_translate_speech_transcription.arn
    activity-105-translate-speech-transcription         = aws_sfn_activity.ai_105_translate_speech_transcription.id
    lambda-106-register-speech-translation              = aws_lambda_function.ai_106_register_speech_translation.arn
    lambda-107-tokenized-translation-to-speech          = aws_lambda_function.ai_107_tokenized_translation_to_speech.arn
    activity-107-tokenized-translation-to-speech        = aws_sfn_activity.ai_107_tokenized_translation_to_speech.id
    lambda-108-register-tokenized-translation-to-speech = aws_lambda_function.ai_108_register_tokenized_translation_to_speech.arn
    lambda-109-ssml-translation-to-speech               = aws_lambda_function.ai_109_ssml_translation_to_speech.arn
    activity-109-ssml-translation-to-speech             = aws_sfn_activity.ai_109_ssml_translation_to_speech.id
    lambda-110-register-ssml-translation-to-speech      = aws_lambda_function.ai_110_register_ssml_translation_to_speech.arn
    lambda-111-dubbing-srt                              = aws_lambda_function.ai_111_dubbing_srt.arn
    activity-111-dubbing-srt                            = aws_sfn_activity.ai_111_dubbing_srt.id
    lambda-112-register-dubbing-srt                     = aws_lambda_function.ai_112_register_dubbing_srt.arn

    lambda-201-detect-celebrities-azure               = aws_lambda_function.ai_201_detect_celebrities_azure.arn
    activity-201-detect-celebrities-azure             = aws_sfn_activity.ai_201_detect_celebrities_azure.id
    lambda-202-register-celebrities-info-azure        = aws_lambda_function.ai_202_register_celebrities_info_azure.arn
    lambda-203-validate-speech-to-text-azure          = aws_lambda_function.ai_203_validate_speech_to_text_azure.arn
    activity-203-validate-speech-to-text-azure        = aws_sfn_activity.ai_203_validate_speech_to_text_azure.id
    lambda-204-register-validate-speech-to-text-azure = aws_lambda_function.ai_204_register_validate_speech_to_text_azure.arn

    lambda-301-detect-celebrities-aws        = aws_lambda_function.ai_301_detect_celebrities_aws.arn
    activity-301-detect-celebrities-aws      = aws_sfn_activity.ai_301_detect_celebrities_aws.id
    lambda-302-register-celebrities-info-aws = aws_lambda_function.ai_302_register_celebrities_info_aws.arn
    lambda-311-detect-emotions-aws           = aws_lambda_function.ai_311_detect_emotions_aws.arn
    activity-311-detect-emotions-aws         = aws_sfn_activity.ai_311_detect_emotions_aws.id
    lambda-312-register-emotions-info-aws    = aws_lambda_function.ai_312_register_emotions_info_aws.arn
    lambda-321-rekognition-aws               = aws_lambda_function.ai_321_rekognition_aws.arn

    lambda-401-extract-audio-google                    = aws_lambda_function.ai_401_extract_audio_google.arn
    activity-401-extract-audio-google                  = aws_sfn_activity.ai_401_extract_audio_google.id
    lambda-402-register-extract-audio-google           = aws_lambda_function.ai_402_register_extract_audio_google.arn
    lambda-403-speech-to-text-google                   = aws_lambda_function.ai_403_speech_to_text_google.arn
    activity-403-speech-to-text-google                 = aws_sfn_activity.ai_403_speech_to_text_google.id
    lambda-404-register-speech-to-text-google          = aws_lambda_function.ai_404_register_speech_to_text_google.arn
    lambda-405-validate-speech-to-text-google          = aws_lambda_function.ai_405_validate_speech_to_text_google.arn
    activity-405-validate-speech-to-text-google        = aws_sfn_activity.ai_405_validate_speech_to_text_google.id
    lambda-406-register-validate-speech-to-text-google = aws_lambda_function.ai_406_register_validate_speech_to_text_google.arn

    lambda-process-workflow-completion = aws_lambda_function.process_workflow_completion.arn
    lambda-process-workflow-failure    = aws_lambda_function.process_workflow_failure.arn
  })
}
