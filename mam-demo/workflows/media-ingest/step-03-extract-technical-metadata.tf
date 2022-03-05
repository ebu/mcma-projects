#################################
#  Step 3 : Extract Technical Data
#################################

resource "aws_iam_role" "step_03_extract_technical_metadata" {
  name               = format("%.64s", "${var.prefix}-${var.aws_region}-03-extract-technical-metadata")
  path               = var.iam_role_path
  assume_role_policy = jsonencode({
    Version   = "2012-10-17"
    Statement = [
      {
        Sid       = "AllowLambdaAssumingRole"
        Effect    = "Allow"
        Action    = "sts:AssumeRole"
        Principal = {
          Service = "lambda.amazonaws.com"
        }
      }
    ]
  })

  tags = var.tags
}

resource "aws_iam_role_policy" "step_03_extract_technical_metadata" {
  name   = aws_iam_role.step_03_extract_technical_metadata.name
  role   = aws_iam_role.step_03_extract_technical_metadata.id
  policy = jsonencode({
    Version   = "2012-10-17"
    Statement = [
      {
        Sid      = "DescribeCloudWatchLogs"
        Effect   = "Allow"
        Action   = "logs:DescribeLogGroups"
        Resource = "*"
      },
      {
        Sid    = "WriteToCloudWatchLogs"
        Effect = "Allow"
        Action = [
          "logs:CreateLogGroup",
          "logs:CreateLogStream",
          "logs:PutLogEvents",
        ]
        Resource = [
          "arn:aws:logs:${var.aws_region}:${var.aws_account_id}:log-group:${var.log_group.name}:*",
          "arn:aws:logs:${var.aws_region}:${var.aws_account_id}:log-group:/aws/lambda/${aws_lambda_function.step_03_extract_technical_metadata.function_name}:*",
          "arn:aws:logs:${var.aws_region}:${var.aws_account_id}:log-group:/aws/lambda-insights:*",
        ]
      },
      {
        Sid    = "XRay"
        Effect = "Allow"
        Action = [
          "xray:PutTraceSegments",
          "xray:PutTelemetryRecords",
          "xray:GetSamplingRules",
          "xray:GetSamplingTargets",
          "xray:GetSamplingStatisticSummaries",
        ]
        Resource = "*"
      },
      {
        Sid      = "AllowInvokingApiGateway"
        Effect   = "Allow"
        Action   = "execute-api:Invoke"
        Resource = [
          "${var.service_registry.aws_apigatewayv2_stage.service_api.execution_arn}/GET/*",
          "${var.job_processor.aws_apigatewayv2_stage.service_api.execution_arn}/*/*",
        ]
      },
      {
        Sid      = "AllowReadingFromMediaBucket"
        Effect   = "Allow"
        Action   = "s3:GetObject"
        Resource = "${var.media_bucket.arn}/*"
      },
      {
        Sid      = "AllowGettingActivityTask"
        Effect   = "Allow"
        Action   = "states:GetActivityTask"
        Resource = aws_sfn_activity.step_03_extract_technical_metadata.id
      },
    ]
  })
}

resource "aws_lambda_function" "step_03_extract_technical_metadata" {
  filename         = "${path.module}/03-extract-technical-metadata/build/dist/lambda.zip"
  function_name    = format("%.64s", "${var.prefix}-03-extract-technical-metadata")
  role             = aws_iam_role.step_03_extract_technical_metadata.arn
  handler          = "index.handler"
  source_code_hash = filebase64sha256("${path.module}/03-extract-technical-metadata/build/dist/lambda.zip")
  runtime          = "nodejs14.x"
  timeout          = "900"
  memory_size      = "2048"

  layers = var.enhanced_monitoring_enabled ? ["arn:aws:lambda:${var.aws_region}:580247275435:layer:LambdaInsightsExtension:14"] : []

  environment {
    variables = {
      LogGroupName     = var.log_group.name
      ServicesUrl      = var.service_registry.services_url
      ServicesAuthType = var.service_registry.auth_type
      ActivityArn      = aws_sfn_activity.step_03_extract_technical_metadata.id
    }
  }

  tracing_config {
    mode = "Active"
  }

  tags = var.tags
}

resource "aws_sfn_activity" "step_03_extract_technical_metadata" {
  name = "${var.prefix}-03-extract-technical-metadata"

  tags = var.tags
}
