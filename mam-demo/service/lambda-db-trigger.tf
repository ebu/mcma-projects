##############################
# Lambda db-trigger
##############################

locals {
  lambda_name_db_trigger = format("%.64s", replace("${var.prefix}-db-trigger", "/[^a-zA-Z0-9_]+/", "-" ))
}

resource "aws_iam_role" "db_trigger" {
  name = format("%.64s", replace("${var.prefix}-${var.aws_region}-db-trigger", "/[^a-zA-Z0-9_]+/", "-" ))

  assume_role_policy = jsonencode({
    Version   = "2012-10-17"
    Statement = [
      {
        Sid       = "AllowLambdaAssumingRole"
        Effect    = "Allow"
        Action    = "sts:AssumeRole"
        Principal = {
          "Service" = "lambda.amazonaws.com"
        }
      }
    ]
  })
}

resource "aws_iam_role_policy" "db_trigger" {
  name = aws_iam_role.db_trigger.name
  role = aws_iam_role.db_trigger.id

  policy = jsonencode({
    Version   = "2012-10-17"
    Statement = concat([
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
        ],
        Resource = concat([
          "arn:aws:logs:${var.aws_region}:${var.aws_account_id}:log-group:${var.log_group.name}:*",
          "arn:aws:logs:${var.aws_region}:${var.aws_account_id}:log-group:/aws/lambda/${local.lambda_name_db_trigger}:*",
        ], var.enhanced_monitoring_enabled ? [
          "arn:aws:logs:${var.aws_region}:${var.aws_account_id}:log-group:/aws/lambda-insights:*"
        ] : [])
      },
      {
        Sid      = "ListAndDescribeDynamoDBTables"
        Effect   = "Allow"
        Action   = [
          "dynamodb:List*",
          "dynamodb:DescribeReservedCapacity*",
          "dynamodb:DescribeLimits",
          "dynamodb:DescribeTimeToLive",
        ]
        Resource = "*"
      },
      {
        Sid      = "AllowTableOperations"
        Effect   = "Allow"
        Action   = [
          "dynamodb:BatchGetItem",
          "dynamodb:BatchWriteItem",
          "dynamodb:DeleteItem",
          "dynamodb:DescribeTable",
          "dynamodb:GetItem",
          "dynamodb:PutItem",
          "dynamodb:Query",
          "dynamodb:Scan",
          "dynamodb:UpdateItem",
        ]
        Resource = [
          aws_dynamodb_table.service_table.arn,
          "${aws_dynamodb_table.service_table.arn}/index/*",
        ]
      },
      {
        Sid      = "AllowTableStreamOperations"
        Effect   = "Allow"
        Action   = [
          "dynamodb:DescribeStream",
          "dynamodb:GetRecords",
          "dynamodb:GetShardIterator",
        ]
        Resource = aws_dynamodb_table.service_table.stream_arn
      },
      {
        Sid      = "AllowPostingToWebSockets"
        Effect   = "Allow"
        Action   = "execute-api:ManageConnections"
        Resource = "${aws_apigatewayv2_api.websocket.execution_arn}/${var.stage_name}/*/*"
      },
    ],
    var.xray_tracing_enabled ?
    [
      {
        Sid      = "AllowLambdaWritingToXRay"
        Effect   = "Allow"
        Action   = [
          "xray:PutTraceSegments",
          "xray:PutTelemetryRecords",
          "xray:GetSamplingRules",
          "xray:GetSamplingTargets",
          "xray:GetSamplingStatisticSummaries",
        ]
        Resource = "*"
      }
    ] : [])
  })
}

resource "aws_lambda_function" "db_trigger" {
  depends_on = [
    aws_iam_role_policy.db_trigger
  ]

  filename         = "${path.module}/db-trigger/build/dist/lambda.zip"
  function_name    = local.lambda_name_db_trigger
  role             = aws_iam_role.db_trigger.arn
  handler          = "index.handler"
  source_code_hash = filebase64sha256("${path.module}/db-trigger/build/dist/lambda.zip")
  runtime          = "nodejs14.x"
  timeout          = "30"
  memory_size      = "2048"

  layers = var.enhanced_monitoring_enabled ? ["arn:aws:lambda:${var.aws_region}:580247275435:layer:LambdaInsightsExtension:14"] : []

  environment {
    variables = {
      LogGroupName = var.log_group.name
      TableName    = aws_dynamodb_table.service_table.name
    }
  }

  tracing_config {
    mode = var.xray_tracing_enabled ? "Active" : "PassThrough"
  }
}
