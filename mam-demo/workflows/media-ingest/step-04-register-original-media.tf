#################################
#  Step 4 : Register original media
#################################

resource "aws_iam_role" "step_04_register_original_media" {
  name               = format("%.64s", "${var.prefix}-${var.aws_region}-04-register-original-media")
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

resource "aws_iam_role_policy" "step_04_register_original_media" {
  name   = aws_iam_role.step_04_register_original_media.name
  role   = aws_iam_role.step_04_register_original_media.id
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
        Sid      = "WriteToCloudWatchLogs"
        Effect   = "Allow"
        Action   = [
          "logs:CreateLogGroup",
          "logs:CreateLogStream",
          "logs:PutLogEvents",
        ]
        Resource = [
          "arn:aws:logs:${var.aws_region}:${var.aws_account_id}:log-group:${var.log_group.name}:*",
          "arn:aws:logs:${var.aws_region}:${var.aws_account_id}:log-group:/aws/lambda/${aws_lambda_function.step_04_register_original_media.function_name}:*",
          "arn:aws:logs:${var.aws_region}:${var.aws_account_id}:log-group:/aws/lambda-insights:*",
        ]
      },
      {
        Sid      = "XRay"
        Effect   = "Allow"
        Action   = [
          "xray:PutTraceSegments",
          "xray:PutTelemetryRecords",
          "xray:GetSamplingRules",
          "xray:GetSamplingTargets",
          "xray:GetSamplingStatisticSummaries",
        ]
        Resource = "*"
      },
      {
        Sid      = "S3ReadFromMediaBucket"
        Effect   = "Allow"
        Action   = "s3:GetObject"
        Resource = "${var.media_bucket.arn}/*"
      },
    ]
  })
}

resource "aws_lambda_function" "step_04_register_original_media" {
  filename         = "${path.module}/04-register-original-media/build/dist/lambda.zip"
  function_name    = format("%.64s", "${var.prefix}-04-register-original-media")
  role             = aws_iam_role.step_04_register_original_media.arn
  handler          = "index.handler"
  source_code_hash = filebase64sha256("${path.module}/04-register-original-media/build/dist/lambda.zip")
  runtime          = "nodejs14.x"
  timeout          = "900"
  memory_size      = "2048"

  layers = var.enhanced_monitoring_enabled ? ["arn:aws:lambda:${var.aws_region}:580247275435:layer:LambdaInsightsExtension:14"] : []

  environment {
    variables = {
      LogGroupName = var.log_group.name
    }
  }

  tracing_config {
    mode = "Active"
  }

  tags = var.tags
}
