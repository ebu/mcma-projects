output "auth_type" {
  value = local.service_auth_type
}

output "rest_api_url" {
  value = local.rest_api_url
}

output "websocket_url" {
  value = local.websocket_url
}

output "aws_iam_role" {
  value = {
    api_handler = aws_iam_role.api_handler
    worker      = aws_iam_role.worker
  }
}

output "aws_iam_role_policy" {
  value = {
    api_handler = aws_iam_role_policy.api_handler
    worker      = aws_iam_role_policy.worker
  }
}

output "aws_dynamodb_table" {
  value = {
    service_table = aws_dynamodb_table.service_table
  }
}

output "aws_lambda_function" {
  value = {
    api_handler = aws_lambda_function.api_handler
    worker      = aws_lambda_function.worker
  }
}

output "aws_apigatewayv2_api" {
  value = {
    rest_api  = aws_apigatewayv2_api.rest_api
    websocket = aws_apigatewayv2_api.websocket
  }
}

output "aws_apigatewayv2_integration" {
  value = {
    rest_api = aws_apigatewayv2_integration.rest_api
    websocket_connect = aws_apigatewayv2_integration.websocket_connect
    websocket_default = aws_apigatewayv2_integration.websocket_default
    websocket_disconnect = aws_apigatewayv2_integration.websocket_disconnect
  }
}

output "aws_apigatewayv2_route" {
  value = {
    rest_api_default = aws_apigatewayv2_route.rest_api_default
    rest_api_options = aws_apigatewayv2_route.rest_api_options
    websocket_connect = aws_apigatewayv2_route.websocket_connect
    websocket_default = aws_apigatewayv2_route.websocket_default
    websocket_disconnect = aws_apigatewayv2_route.websocket_disconnect
  }
}

output "aws_lambda_permission" {
  value = {
    rest_api_default = aws_lambda_permission.rest_api_default
    rest_api_options = aws_lambda_permission.rest_api_options
    websocket_connect = aws_lambda_permission.websocket_connect
    websocket_default = aws_lambda_permission.websocket_default
    websocket_disconnect = aws_lambda_permission.websocket_disconnect
  }
}

output "aws_apigatewayv2_stage" {
  value = {
    rest_api = aws_apigatewayv2_stage.rest_api
    websocket = aws_apigatewayv2_stage.websocket
  }
}
