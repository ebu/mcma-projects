######################
# aws_dynamodb_table
######################

resource "aws_dynamodb_table" "service_table" {
  name         = var.prefix
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "resource_pkey"
  range_key    = "resource_skey"

  attribute {
    name = "resource_pkey"
    type = "S"
  }

  attribute {
    name = "resource_skey"
    type = "S"
  }

  attribute {
    name = "dateCreated"
    type = "N"
  }

  local_secondary_index {
    name            = "dateCreated"
    projection_type = "ALL"
    range_key       = "dateCreated"
  }

  stream_enabled   = true
  stream_view_type = "NEW_AND_OLD_IMAGES"
}
