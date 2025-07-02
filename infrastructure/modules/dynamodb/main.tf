resource "aws_dynamodb_table" "counter" {
  name           = "${var.project_name}-counter-${var.environment}"
  billing_mode   = "PAY_PER_REQUEST"
  hash_key       = "id"

  attribute {
    name = "id"
    type = "S"
  }

  stream_enabled   = true
  stream_view_type = "NEW_AND_OLD_IMAGES"

  point_in_time_recovery {
    enabled = true
  }

  server_side_encryption {
    enabled = true
  }

  tags = merge(var.common_tags, {
    Name = "${var.project_name}-counter-${var.environment}"
  })
}

resource "aws_dynamodb_table" "audit" {
  name           = "${var.project_name}-${var.environment}-audit"
  billing_mode   = "PAY_PER_REQUEST"
  hash_key       = "id"

  attribute {
    name = "id"
    type = "S"
  }

  attribute {
    name = "requestId"
    type = "S"
  }

  global_secondary_index {
    name            = "requestId-index"
    hash_key        = "requestId"
    projection_type = "ALL"
  }

  ttl {
    attribute_name = "ttl"
    enabled        = true
  }

  server_side_encryption {
    enabled = true
  }

  tags = merge(var.common_tags, {
    Name = "${var.project_name}-${var.environment}-audit"
  })
}

resource "aws_dynamodb_table" "websocket_connections" {
  name           = "${var.project_name}-${var.environment}-ws-connections"
  billing_mode   = "PAY_PER_REQUEST"
  hash_key       = "connectionId"

  attribute {
    name = "connectionId"
    type = "S"
  }

  ttl {
    attribute_name = "ttl"
    enabled        = true
  }

  tags = merge(var.common_tags, {
    Name = "${var.project_name}-ws-connections-${var.environment}"
  })
}
