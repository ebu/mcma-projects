resource "aws_cognito_user_pool" "main" {
  name = var.prefix

  auto_verified_attributes = ["email"]

  username_configuration {
    case_sensitive = false
  }

  password_policy {
    minimum_length                   = 8
    require_lowercase                = true
    require_numbers                  = true
    require_symbols                  = true
    require_uppercase                = true
    temporary_password_validity_days = 30
  }

  alias_attributes = ["email"]

  admin_create_user_config {
    allow_admin_create_user_only = true

    invite_message_template {
      email_subject = "Invitation to MCMA MAM Demo"
      email_message = "<p>An account has been created for you to use the MCMA MAM Demo.</p><p>Please go to the <a href=\"${local.website_url}\">MCMA MAM Demo website</a> and log in with the following credentials.</p><ul><li>username: {username}</li><li>password: {####}</li></ul><p>The provided password is temporary. Upon first login you'll be requested to set a new password.</p>"
      sms_message   = "Your username is {username} and temporary password is {####}"
    }
  }

  schema {
    name                = "email"
    attribute_data_type = "String"
    required            = true
    mutable             = true
    string_attribute_constraints {
      min_length = 0
      max_length = 256
    }
  }

  account_recovery_setting {
    recovery_mechanism {
      name     = "verified_email"
      priority = 1
    }
  }
}

resource "aws_cognito_user_pool_client" "main" {
  name            = var.prefix
  user_pool_id    = aws_cognito_user_pool.main.id
  generate_secret = false
}

resource "aws_cognito_identity_pool" "main" {
  identity_pool_name               = replace(replace(var.prefix, "/[^a-zA-Z0-9 ]/", " "), "/[ ]+/", " ")
  allow_unauthenticated_identities = false

  cognito_identity_providers {
    client_id               = aws_cognito_user_pool_client.main.id
    provider_name           = aws_cognito_user_pool.main.endpoint
    server_side_token_check = false
  }
}

resource "aws_iam_role" "cognito_authenticated" {
  name = format("%.64s", "${var.prefix}-cognito-authenticated")

  assume_role_policy = jsonencode({
    Version   = "2012-10-17"
    Statement = [
      {
        Effect    = "Allow"
        Principal = {
          Federated = "cognito-identity.amazonaws.com"
        }
        Action    = "sts:AssumeRoleWithWebIdentity",
        Condition = {
          StringEquals             = {
            "cognito-identity.amazonaws.com:aud" = aws_cognito_identity_pool.main.id
          }
          "ForAnyValue:StringLike" = {
            "cognito-identity.amazonaws.com:amr" = "authenticated"
          }
        }
      }
    ]
  })
}

resource "aws_iam_role_policy" "authenticated" {
  name = format("%.64s", "${var.prefix}-cognito-authenticated")
  role = aws_iam_role.cognito_authenticated.id

  policy = jsonencode({
    Version   = "2012-10-17"
    Statement = [
      {
        Sid       = "ListYourObjects"
        Effect    = "Allow"
        Action    = "s3:ListBucket"
        Resource  = ["arn:aws:s3:::${var.media_bucket.id}"]
        Condition = {
          StringLike = {
            "s3:prefix" = ["$${cognito-identity.amazonaws.com:sub}"]
          }
        }
      },
      {
        Sid      = "ReadWriteDeleteYourObjects"
        Effect   = "Allow"
        Action   = [
          "s3:GetObject",
          "s3:PutObject",
          "s3:DeleteObject",
        ]
        Resource = [
          "arn:aws:s3:::${var.media_bucket.id}/$${cognito-identity.amazonaws.com:sub}",
          "arn:aws:s3:::${var.media_bucket.id}/$${cognito-identity.amazonaws.com:sub}/*",
        ]
      },
      {
        Sid      = "AllowInvokingAPI"
        Effect   = "Allow"
        Action   = "execute-api:Invoke"
        Resource = [
          "${var.mam_service.aws_apigatewayv2_stage.rest_api.execution_arn}/*/*",
          "${var.mam_service.aws_apigatewayv2_stage.websocket.execution_arn}/*/*",
        ]
      }
    ]
  })
}


resource "aws_cognito_identity_pool_roles_attachment" "main" {
  identity_pool_id = aws_cognito_identity_pool.main.id

  roles = {
    authenticated = aws_iam_role.cognito_authenticated.arn
  }
}
