##############################
# API Gateway REST API
##############################

resource "aws_apigatewayv2_api" "rest_api" {
  name          = var.prefix
  description   = "MCMA MAM Service Rest Api"
  protocol_type = "HTTP"

  cors_configuration {
    allow_origins = ["*"]
    allow_methods = ["*"]
    allow_headers = ["content-type", "x-amz-date", "authorization", "x-api-key", "x-amz-security-token"]
  }
}

resource "aws_apigatewayv2_integration" "rest_api" {
  api_id                 = aws_apigatewayv2_api.rest_api.id
  connection_type        = "INTERNET"
  integration_method     = "POST"
  integration_type       = "AWS_PROXY"
  integration_uri        = aws_lambda_function.api_handler.arn
  payload_format_version = "2.0"
}

resource "aws_apigatewayv2_route" "rest_api_options" {
  api_id             = aws_apigatewayv2_api.rest_api.id
  route_key          = "OPTIONS /{proxy+}"
  authorization_type = "NONE"
  target             = "integrations/${aws_apigatewayv2_integration.rest_api.id}"
}

resource "aws_lambda_permission" "rest_api_options" {
  statement_id  = "AllowExecutionFromAPIGatewayOptions"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.api_handler.arn
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_apigatewayv2_api.rest_api.execution_arn}/*/*/{proxy+}"
}

resource "aws_apigatewayv2_route" "rest_api_default" {
  api_id             = aws_apigatewayv2_api.rest_api.id
  route_key          = "$default"
  authorization_type = "AWS_IAM"
  target             = "integrations/${aws_apigatewayv2_integration.rest_api.id}"
}

resource "aws_lambda_permission" "rest_api_default" {
  statement_id  = "AllowExecutionFromAPIGatewayDefault"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.api_handler.arn
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_apigatewayv2_api.rest_api.execution_arn}/*/$default"
}

resource "aws_apigatewayv2_stage" "rest_api" {
  depends_on = [
    aws_apigatewayv2_route.rest_api_options,
    aws_apigatewayv2_route.rest_api_default
  ]

  api_id      = aws_apigatewayv2_api.rest_api.id
  name        = var.stage_name
  auto_deploy = true

  default_route_settings {
    detailed_metrics_enabled = var.api_gateway_metrics_enabled
    throttling_burst_limit   = 5000
    throttling_rate_limit    = 10000
  }

  access_log_settings {
    destination_arn = var.log_group.arn
    format          = "{ \"requestId\":\"$context.requestId\", \"ip\": \"$context.identity.sourceIp\", \"requestTime\":\"$context.requestTime\", \"httpMethod\":\"$context.httpMethod\", \"routeKey\":\"$context.routeKey\", \"path\":\"$context.path\", \"status\":\"$context.status\",\"protocol\":\"$context.protocol\", \"responseLength\":\"$context.responseLength\" }"
  }
}

##############################
# API Gateway WebSocket
##############################

resource "aws_apigatewayv2_api" "websocket" {
  name          = "${var.prefix}-websocket"
  description   = "MCMA MAM Service WebSocket Api"
  protocol_type = "WEBSOCKET"

  route_selection_expression = "$request.body.action"
}

resource "aws_apigatewayv2_integration" "websocket_connect" {
  api_id                    = aws_apigatewayv2_api.websocket.id
  connection_type           = "INTERNET"
  content_handling_strategy = "CONVERT_TO_TEXT"
  integration_method        = "POST"
  integration_type          = "AWS_PROXY"
  integration_uri           = "arn:aws:apigateway:${var.aws_region}:lambda:path/2015-03-31/functions/${aws_lambda_function.websocket_handler.arn}/invocations"
}

resource "aws_apigatewayv2_route" "websocket_connect" {
  api_id             = aws_apigatewayv2_api.websocket.id
  route_key          = "$connect"
  authorization_type = "AWS_IAM"
  target             = "integrations/${aws_apigatewayv2_integration.websocket_connect.id}"
}

resource "aws_lambda_permission" "websocket_connect" {
  statement_id  = "AllowExecutionFromAPIGatewayWebSocketConnect"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.websocket_handler.arn
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_apigatewayv2_api.websocket.execution_arn}/*/$connect"
}

resource "aws_apigatewayv2_integration" "websocket_default" {
  api_id                    = aws_apigatewayv2_api.websocket.id
  connection_type           = "INTERNET"
  content_handling_strategy = "CONVERT_TO_TEXT"
  integration_method        = "POST"
  integration_type          = "AWS_PROXY"
  integration_uri           = "arn:aws:apigateway:${var.aws_region}:lambda:path/2015-03-31/functions/${aws_lambda_function.websocket_handler.arn}/invocations"
}

resource "aws_apigatewayv2_route_response" "websocket_default" {
  api_id             = aws_apigatewayv2_api.websocket.id
  route_id           = aws_apigatewayv2_route.websocket_default.id
  route_response_key = "$default"
}

resource "aws_apigatewayv2_route" "websocket_default" {
  api_id                              = aws_apigatewayv2_api.websocket.id
  route_key                           = "$default"
  route_response_selection_expression = "$default"
  target                              = "integrations/${aws_apigatewayv2_integration.websocket_default.id}"
}

resource "aws_lambda_permission" "websocket_default" {
  statement_id  = "AllowExecutionFromAPIGatewayWebSocketDefault"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.websocket_handler.arn
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_apigatewayv2_api.websocket.execution_arn}/*/$default"
}

resource "aws_apigatewayv2_integration" "websocket_disconnect" {
  api_id                    = aws_apigatewayv2_api.websocket.id
  connection_type           = "INTERNET"
  content_handling_strategy = "CONVERT_TO_TEXT"
  integration_method        = "POST"
  integration_type          = "AWS_PROXY"
  integration_uri           = "arn:aws:apigateway:${var.aws_region}:lambda:path/2015-03-31/functions/${aws_lambda_function.websocket_handler.arn}/invocations"
}

resource "aws_apigatewayv2_route" "websocket_disconnect" {
  api_id    = aws_apigatewayv2_api.websocket.id
  route_key = "$disconnect"
  target    = "integrations/${aws_apigatewayv2_integration.websocket_disconnect.id}"
}

resource "aws_lambda_permission" "websocket_disconnect" {
  statement_id  = "AllowExecutionFromAPIGatewayWebSocketDisconnect"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.websocket_handler.arn
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_apigatewayv2_api.websocket.execution_arn}/*/$disconnect"
}

resource "aws_apigatewayv2_stage" "websocket" {
  depends_on = [
    aws_apigatewayv2_route.websocket_connect,
    aws_apigatewayv2_route.websocket_default,
    aws_apigatewayv2_route.websocket_disconnect,
  ]

  api_id      = aws_apigatewayv2_api.websocket.id
  name        = var.stage_name
  auto_deploy = true

  default_route_settings {
    data_trace_enabled       = var.xray_tracing_enabled
    detailed_metrics_enabled = var.api_gateway_metrics_enabled
    logging_level            = var.api_gateway_logging_enabled ? "INFO" : null
    throttling_burst_limit   = 5000
    throttling_rate_limit    = 10000
  }
}

locals {
  rest_api_url      = "${aws_apigatewayv2_api.rest_api.api_endpoint}/${var.stage_name}"
  websocket_url     = "${aws_apigatewayv2_api.websocket.api_endpoint}/${var.stage_name}"
  service_auth_type = "AWS4"
}
