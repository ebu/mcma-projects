resource "aws_cognito_user_pool" "user_pool" {
  name = "${var.global_prefix}_user_pool"
}

resource "aws_cognito_user_pool_client" "client" {
  name            = "${var.global_prefix}_user_pool_client"
  user_pool_id    = "${aws_cognito_user_pool.user_pool.id}"
  generate_secret = false
}

resource "aws_cognito_identity_pool" "identity_pool" {
  identity_pool_name               = "${replace("${replace("${var.global_prefix}", "/[^a-zA-Z0-9 ]/", " ")}", "/[ ]+/", " ")}"
  allow_unauthenticated_identities = false

  cognito_identity_providers {
    client_id               = "${aws_cognito_user_pool_client.client.id}"
    provider_name           = "${aws_cognito_user_pool.user_pool.endpoint}"
    server_side_token_check = false
  }
}

resource "aws_iam_role" "authenticated" {
  name = "${var.global_prefix}-${var.aws_region}-cognito-authenticated"

  assume_role_policy = <<EOF
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": {
        "Federated": "cognito-identity.amazonaws.com"
      },
      "Action": "sts:AssumeRoleWithWebIdentity",
      "Condition": {
        "StringEquals": {
          "cognito-identity.amazonaws.com:aud": "${aws_cognito_identity_pool.identity_pool.id}"
        },
        "ForAnyValue:StringLike": {
          "cognito-identity.amazonaws.com:amr": "authenticated"
        }
      }
    }
  ]
}
EOF
}

resource "aws_iam_role_policy" "authenticated" {
  name = "${var.global_prefix}-${var.aws_region}-authenticated-policy"
  role = "${aws_iam_role.authenticated.id}"

  policy = <<EOF
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "mobileanalytics:PutEvents",
        "cognito-sync:*",
        "cognito-identity:*"
      ],
      "Resource": [
        "*"
      ]
    },
    {
      "Effect": "Allow",
      "Action": "S3:*",
      "Resource": "*"
    },
    {
        "Effect": "Allow",
        "Action": "execute-api:Invoke",
        "Resource": "arn:aws:execute-api:*:*:*"
    }
  ]
}
EOF
}

resource "aws_iam_role" "unauthenticated" {
  name = "${var.global_prefix}-${var.aws_region}-cognito-unauthenticated"

  assume_role_policy = <<EOF
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": {
        "Federated": "cognito-identity.amazonaws.com"
      },
      "Action": "sts:AssumeRoleWithWebIdentity",
      "Condition": {
        "StringEquals": {
          "cognito-identity.amazonaws.com:aud": "${aws_cognito_identity_pool.identity_pool.id}"
        },
        "ForAnyValue:StringLike": {
          "cognito-identity.amazonaws.com:amr": "unauthenticated"
        }
      }
    }
  ]
}
EOF
}

resource "aws_iam_role_policy" "unauthenticated" {
  name = "${var.global_prefix}-${var.aws_region}-unauthenticated-policy"
  role = "${aws_iam_role.unauthenticated.id}"

  policy = <<EOF
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "mobileanalytics:PutEvents",
        "cognito-sync:*"
      ],
      "Resource": [
        "*"
      ]
    }
  ]
}
EOF
}

resource "aws_cognito_identity_pool_roles_attachment" "main" {
  identity_pool_id = "${aws_cognito_identity_pool.identity_pool.id}"

  roles {
    "authenticated"   = "${aws_iam_role.authenticated.arn}"
    "unauthenticated" = "${aws_iam_role.unauthenticated.arn}"
  }
}

output "user_pool_id" {
  value = "${aws_cognito_user_pool.user_pool.id}"
}

output "user_pool_client_id" {
  value = "${aws_cognito_user_pool_client.client.id}"
}

output "identity_pool_id" {
  value = "${aws_cognito_identity_pool.identity_pool.id}"
}
