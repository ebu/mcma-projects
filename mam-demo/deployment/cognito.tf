resource "aws_cognito_user_pool" "main" {
  name = var.global_prefix

  auto_verified_attributes = ["email"]

  username_configuration {
    case_sensitive = false
  }

  admin_create_user_config {
    allow_admin_create_user_only = true
  }

  schema {
    name = "email"
    attribute_data_type = "String"
    required = true
    mutable = true
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
  name            = var.global_prefix
  user_pool_id    = aws_cognito_user_pool.main.id
  generate_secret = false
}

resource "aws_cognito_identity_pool" "main" {
  identity_pool_name               = replace(replace(var.global_prefix, "/[^a-zA-Z0-9 ]/", " "), "/[ ]+/", " ")
  allow_unauthenticated_identities = false

  cognito_identity_providers {
    client_id               = aws_cognito_user_pool_client.main.id
    provider_name           = aws_cognito_user_pool.main.endpoint
    server_side_token_check = false
  }
}

resource "aws_iam_role" "cognito_authenticated" {
  name = format("%.64s", "${var.global_prefix}-cognito-authenticated")

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
  name = format("%.64s", "${var.global_prefix}-cognito-authenticated")
  role = aws_iam_role.cognito_authenticated.id

  policy = jsonencode({
    Version   = "2012-10-17"
    Statement = [
      {
        Sid      = "CognitoAccessAuthenticated"
        Effect   = "Allow"
        Action   = [
          "mobileanalytics:PutEvents",
          "cognito-sync:*",
          "cognito-identity:*"
        ]
        Resource = [
          "*"
        ]
      },
      {
        Sid       = "ListYourObjects"
        Effect    = "Allow"
        Action    = "s3:ListBucket"
        Resource  = ["arn:aws:s3:::${aws_s3_bucket.media.id}"]
        Condition = {
          StringLike = {
            "s3:prefix" = ["upload"]
          }
        }
      },
      {
        Sid: "ReadWriteDeleteYourObjects",
        Effect: "Allow",
        Action: [
          "s3:GetObject",
          "s3:PutObject",
          "s3:DeleteObject"
        ],
        Resource: [
          "arn:aws:s3:::${aws_s3_bucket.media.id}/upload",
          "arn:aws:s3:::${aws_s3_bucket.media.id}/upload/*"
        ]
      }
    ]
  })
}

resource "aws_iam_role" "cognito_unauthenticated" {
  name = format("%.64s", "${var.global_prefix}-cognito-unauthenticated")

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
            "cognito-identity.amazonaws.com:amr" = "unauthenticated"
          }
        }
      }
    ]
  })
}

resource "aws_iam_role_policy" "unauthenticated" {
  name = format("%.64s", "${var.global_prefix}-cognito-unauthenticated")
  role = aws_iam_role.cognito_unauthenticated.id

  policy = jsonencode({
    Version   = "2012-10-17"
    Statement = [
      {
        Sid      = "CognitoAccessUnauthenticated"
        Effect   = "Allow"
        Action   = [
          "mobileanalytics:PutEvents",
          "cognito-sync:*"
        ]
        Resource = [
          "*"
        ]
      }
    ]
  })
}

resource "aws_cognito_identity_pool_roles_attachment" "main" {
  identity_pool_id = aws_cognito_identity_pool.main.id

  roles = {
    authenticated   = aws_iam_role.cognito_authenticated.arn
    unauthenticated = aws_iam_role.cognito_unauthenticated.arn
  }
}
