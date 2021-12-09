##############################
# Lambda websocket_handler
##############################

locals {
  lambda_name_websocket_handler = format("%.64s", replace("${var.prefix}-websocket-handler", "/[^a-zA-Z0-9_]+/", "-" ))
}

resource "aws_iam_role" "websocket_handler" {
  name = format("%.64s", replace("${var.prefix}-${var.aws_region}-websocket-handler", "/[^a-zA-Z0-9_]+/", "-" ))

  assume_role_policy = jsonencode({
    Version   = "2012-10-17",
    Statement = [
      {
        Sid       = "AllowLambdaAssumingRole"
        Effect    = "Allow"
        Action    = "sts:AssumeRole",
        Principal = {
          "Service" = "lambda.amazonaws.com"
        }
      }
    ]
  })
}

resource "aws_iam_role_policy" "websocket_handler" {
  name = aws_iam_role.websocket_handler.name
  role = aws_iam_role.websocket_handler.id

  policy = jsonencode({
    Version   = "2012-10-17",
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
          "arn:aws:logs:${var.aws_region}:${var.aws_account_id}:log-group:/aws/lambda/${local.lambda_name_websocket_handler}:*",
        ], var.enhanced_monitoring_enabled ? [
          "arn:aws:logs:${var.aws_region}:${var.aws_account_id}:log-group:/aws/lambda-insights:*"
        ] : [])
      },
      {
        Sid      = "ListAndDescribeDynamoDBTables",
        Effect   = "Allow",
        Action   = [
          "dynamodb:List*",
          "dynamodb:DescribeReservedCapacity*",
          "dynamodb:DescribeLimits",
          "dynamodb:DescribeTimeToLive"
        ],
        Resource = "*"
      },
      {
        Sid      = "SpecificTable",
        Effect   = "Allow",
        Action   = [
          "dynamodb:BatchGet*",
          "dynamodb:DescribeStream",
          "dynamodb:DescribeTable",
          "dynamodb:Get*",
          "dynamodb:Query",
          "dynamodb:Scan",
          "dynamodb:BatchWrite*",
          "dynamodb:CreateTable",
          "dynamodb:Delete*",
          "dynamodb:Update*",
          "dynamodb:PutItem"
        ],
        Resource = [
          aws_dynamodb_table.service_table.arn,
          "${aws_dynamodb_table.service_table.arn}/index/*"
        ]
      },
      {
        Sid      = "AllowManagingWebsocketConnections"
        Effect   = "Allow"
        Action   = "execute-api:ManageConnections"
        Resource = "${aws_apigatewayv2_api.websocket.execution_arn}/${var.stage_name}/*/*"
      },
    ],
    var.xray_tracing_enabled ?
    [
      {
        Sid      = "AllowLambdaWritingToXRay"
        Effect   = "Allow",
        Action   = [
          "xray:PutTraceSegments",
          "xray:PutTelemetryRecords",
          "xray:GetSamplingRules",
          "xray:GetSamplingTargets",
          "xray:GetSamplingStatisticSummaries",
        ],
        Resource = "*"
      }
    ] : [],
    var.dead_letter_config_target != null ?
    [
      {
        Sid      = "AllowLambdaToSendToDLQ"
        Effect   = "Allow",
        Action   = "sqs:SendMessage",
        Resource = var.dead_letter_config_target
      }
    ] : [])
  })
}

resource "aws_lambda_function" "websocket_handler" {
  depends_on = [
    aws_iam_role_policy.websocket_handler
  ]

  filename         = "${path.module}/websocket-handler/build/dist/lambda.zip"
  function_name    = local.lambda_name_websocket_handler
  role             = aws_iam_role.websocket_handler.arn
  handler          = "index.handler"
  source_code_hash = filebase64sha256("${path.module}/websocket-handler/build/dist/lambda.zip")
  runtime          = "nodejs14.x"
  timeout          = "30"
  memory_size      = "2048"

  layers = var.enhanced_monitoring_enabled ? ["arn:aws:lambda:${var.aws_region}:580247275435:layer:LambdaInsightsExtension:14"] : []

  environment {
    variables = {
      LogGroupName = var.log_group.name
      TableName    = aws_dynamodb_table.service_table.name
      PublicUrl    = local.rest_api_url
    }
  }

  dynamic "dead_letter_config" {
    for_each = var.dead_letter_config_target != null ? toset([1]) : toset([])

    content {
      target_arn = var.dead_letter_config_target
    }
  }

  tracing_config {
    mode = var.xray_tracing_enabled ? "Active" : "PassThrough"
  }
}
