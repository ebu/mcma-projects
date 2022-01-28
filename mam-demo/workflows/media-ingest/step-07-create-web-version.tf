#################################
#  Step 8 : Transcode Media
#################################

resource "aws_iam_role" "step_07_create_web_version" {
  name               = format("%.64s", "${var.prefix}-${var.aws_region}-07-create-web-version")
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

resource "aws_iam_role_policy" "step_07_create_web_version" {
  name   = aws_iam_role.step_07_create_web_version.name
  role   = aws_iam_role.step_07_create_web_version.id
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
          "arn:aws:logs:${var.aws_region}:${var.aws_account_id}:log-group:/aws/lambda/${aws_lambda_function.step_07_create_web_version.function_name}:*",
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

resource "aws_lambda_function" "step_07_create_web_version" {
  filename         = "${path.module}/07-create-web-version/build/dist/lambda.zip"
  function_name    = format("%.64s", "${var.prefix}-07-create-web-version")
  role             = aws_iam_role.step_07_create_web_version.arn
  handler          = "index.handler"
  source_code_hash = filebase64sha256("${path.module}/07-create-web-version/build/dist/lambda.zip")
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

resource "aws_sfn_activity" "step_07_create_web_version" {
  name = "${var.prefix}-07-create-web-version"

  tags = var.tags
}
