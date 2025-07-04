terraform {
  required_version = ">= 1.0"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }

  backend "s3" {
    bucket         = "my-terraform-state-plasmics"
    key            = "number-acidizer/terraform.tfstate" # Path to your state file within the bucket
    region         = "eu-central-1"
    dynamodb_table = "terraform-state-locking"
    encrypt        = true
  }
}

provider "aws" {
  region = var.aws_region

  default_tags {
    tags = var.common_tags
  }
}

# Data source for current AWS account
data "aws_caller_identity" "current" {}
data "aws_region" "current" {}

# IAM User for Ahmed (Admin Access)
resource "aws_iam_user" "ahmed" {
  name = "ahmed-${var.project_name}-admin"
  path = "/"

  tags = merge(var.common_tags, {
    Name = "Ahmed Admin User"
    Role = "Administrator"
  })
}

resource "aws_iam_user_policy_attachment" "ahmed_admin" {
  user       = aws_iam_user.ahmed.name
  policy_arn = "arn:aws:iam::aws:policy/AdministratorAccess"
}

# Create access keys for Ahmed (for CLI/programmatic access)
resource "aws_iam_access_key" "ahmed" {
  user = aws_iam_user.ahmed.name
}

# IAM Role for GitHub Actions
resource "aws_iam_role" "github_actions" {
  name = "${var.project_name}-github-actions-${var.environment}"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Principal = {
          Federated = "arn:aws:iam::${data.aws_caller_identity.current.account_id}:oidc-provider/token.actions.githubusercontent.com"
        }
        Action = "sts:AssumeRoleWithWebIdentity"
        Condition = {
          StringEquals = {
            "token.actions.githubusercontent.com:aud" = "sts.amazonaws.com"
          }
          StringLike = {
            "token.actions.githubusercontent.com:sub" = "repo:YOUR_GITHUB_USERNAME/number-acidizer:*"
          }
        }
      }
    ]
  })
}

resource "aws_iam_policy" "github_actions" {
  name = "${var.project_name}-github-actions-policy-${var.environment}"

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "ecr:GetAuthorizationToken",
          "ecr:BatchCheckLayerAvailability",
          "ecr:GetDownloadUrlForLayer",
          "ecr:BatchGetImage",
          "ecr:InitiateLayerUpload",
          "ecr:UploadLayerPart",
          "ecr:CompleteLayerUpload",
          "ecr:PutImage"
        ]
        Resource = aws_ecr_repository.backend.arn
      },
      {
        Effect = "Allow"
        Action = [
          "lambda:UpdateFunctionCode",
          "lambda:GetFunction"
        ]
        Resource = [
          aws_lambda_function.api.arn,
          aws_lambda_function.stream_handler.arn
        ]
      },
      {
        Effect = "Allow"
        Action = [
          "s3:PutObject",
          "s3:PutObjectAcl",
          "s3:GetObject",
          "s3:DeleteObject",
          "s3:ListBucket"
        ]
        Resource = [
          aws_s3_bucket.frontend.arn,
          "${aws_s3_bucket.frontend.arn}/*"
        ]
      },
      {
        Effect = "Allow"
        Action = [
          "cloudfront:CreateInvalidation",
          "cloudfront:GetInvalidation"
        ]
        Resource = aws_cloudfront_distribution.frontend.arn
      }
    ]
  })
}

resource "aws_iam_role_policy_attachment" "github_actions" {
  policy_arn = aws_iam_policy.github_actions.arn
  role       = aws_iam_role.github_actions.name
}

# ECR Repository
resource "aws_ecr_repository" "backend" {
  name                 = "${var.project_name}-backend"
  image_tag_mutability = "MUTABLE"

  image_scanning_configuration {
    scan_on_push = true
  }

  encryption_configuration {
    encryption_type = "AES256"
  }
}

resource "aws_ecr_lifecycle_policy" "backend" {
  repository = aws_ecr_repository.backend.name

  policy = jsonencode({
    rules = [
      {
        rulePriority = 1
        description  = "Keep last 10 images"
        selection = {
          tagStatus     = "tagged"
          tagPrefixList = ["v"]
          countType     = "imageCountMoreThan"
          countNumber   = 10
        }
        action = {
          type = "expire"
        }
      }
    ]
  })
}

# DynamoDB Tables
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
    Name = "${var.project_name}-audit-${var.environment}"
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

# Lambda IAM Role
resource "aws_iam_role" "lambda" {
  name = "${var.project_name}-lambda-role-${var.environment}"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Action = "sts:AssumeRole"
      Effect = "Allow"
      Principal = {
        Service = "lambda.amazonaws.com"
      }
    }]
  })
}

# Lambda execution policy with least privilege
resource "aws_iam_policy" "lambda_policy" {
  name = "${var.project_name}-lambda-policy-${var.environment}"

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "dynamodb:GetItem",
          "dynamodb:UpdateItem",
          "dynamodb:PutItem",
          "dynamodb:Query",
          "dynamodb:Scan",
          "dynamodb:DeleteItem",
          "dynamodb:BatchWriteItem",
          "dynamodb:TransactWriteItems"
        ]
        Resource = [
          aws_dynamodb_table.counter.arn,
          aws_dynamodb_table.audit.arn,
          aws_dynamodb_table.websocket_connections.arn,
          "${aws_dynamodb_table.audit.arn}/index/*"
        ]
      },
      {
        Effect = "Allow"
        Action = [
          "dynamodb:DescribeStream",
          "dynamodb:GetRecords",
          "dynamodb:GetShardIterator",
          "dynamodb:ListStreams"
        ]
        Resource = "${aws_dynamodb_table.counter.arn}/stream/*"
      },
      {
        Effect = "Allow"
        Action = [
          "execute-api:ManageConnections"
        ]
        Resource = [
          "${aws_apigatewayv2_api.websocket.execution_arn}/*/*"
        ]
      },
      {
        Effect = "Allow"
        Action = [
          "logs:CreateLogGroup",
          "logs:CreateLogStream",
          "logs:PutLogEvents"
        ]
        Resource = [
          "arn:aws:logs:${data.aws_region.current.name}:${data.aws_caller_identity.current.account_id}:log-group:/aws/lambda/${var.project_name}-*"
        ]
      },
      {
        Effect = "Allow"
        Action = [
          "xray:PutTraceSegments",
          "xray:PutTelemetryRecords"
        ]
        Resource = "*"
      }
    ]
  })
}

resource "aws_iam_role_policy_attachment" "lambda_policy" {
  policy_arn = aws_iam_policy.lambda_policy.arn
  role       = aws_iam_role.lambda.name
}

# CloudWatch Log Groups
resource "aws_cloudwatch_log_group" "lambda" {
  name              = "/aws/lambda/${var.project_name}-api-${var.environment}"
  retention_in_days = 7
}

resource "aws_cloudwatch_log_group" "api_gateway" {
  name              = "/aws/apigateway/${var.project_name}-${var.environment}"
  retention_in_days = 7
}

# Lambda Function
resource "aws_lambda_function" "api" {
  function_name = "${var.project_name}-api-${var.environment}"
  role          = aws_iam_role.lambda.arn

  package_type = "Image"
  image_uri    = "${aws_ecr_repository.backend.repository_url}:latest"

  timeout                        = 30
  memory_size                    = 512

  environment {
    variables = {
      COUNTER_TABLE_NAME      = aws_dynamodb_table.counter.name
      AUDIT_TABLE_NAME        = aws_dynamodb_table.audit.name
      CONNECTIONS_TABLE_NAME  = aws_dynamodb_table.websocket_connections.name
      ENVIRONMENT             = var.environment
      WEBSOCKET_ENDPOINT      = replace(aws_apigatewayv2_api.websocket.api_endpoint, "wss://", "https://")
    }
  }

  tracing_config {
    mode = "Active"
  }

  depends_on = [
    aws_iam_role_policy_attachment.lambda_policy,
    aws_cloudwatch_log_group.lambda
  ]
}

# Lambda permission for API Gateway
resource "aws_lambda_permission" "api_gateway" {
  statement_id  = "AllowAPIGatewayInvoke"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.api.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_apigatewayv2_api.http.execution_arn}/*/*"
}

# HTTP API Gateway
resource "aws_apigatewayv2_api" "http" {
  name          = "${var.project_name}-http-api-${var.environment}"
  protocol_type = "HTTP"

  cors_configuration {
    allow_origins     = var.allowed_origins
    allow_methods     = ["GET", "POST", "OPTIONS"]
    allow_headers     = ["Content-Type", "X-Request-ID", "X-Client-ID"]
    expose_headers    = ["X-Request-ID"]
    max_age           = 300
    allow_credentials = false
  }
}

resource "aws_apigatewayv2_integration" "lambda" {
  api_id             = aws_apigatewayv2_api.http.id
  integration_type   = "AWS_PROXY"
  integration_uri    = aws_lambda_function.api.invoke_arn
  integration_method = "POST"
}

resource "aws_apigatewayv2_route" "increment" {
  api_id    = aws_apigatewayv2_api.http.id
  route_key = "POST /increment"
  target    = "integrations/${aws_apigatewayv2_integration.lambda.id}"
}

resource "aws_apigatewayv2_route" "decrement" {
  api_id    = aws_apigatewayv2_api.http.id
  route_key = "POST /decrement"
  target    = "integrations/${aws_apigatewayv2_integration.lambda.id}"
}

resource "aws_apigatewayv2_route" "get" {
  api_id    = aws_apigatewayv2_api.http.id
  route_key = "GET /value"
  target    = "integrations/${aws_apigatewayv2_integration.lambda.id}"
}

resource "aws_apigatewayv2_stage" "http" {
  api_id      = aws_apigatewayv2_api.http.id
  name        = "$default"
  auto_deploy = true

  # API Gateway throttling - reduced limits for free tier
  

  access_log_settings {
    destination_arn = aws_cloudwatch_log_group.api_gateway.arn
    format = jsonencode({
      requestId      = "$context.requestId"
      ip             = "$context.identity.sourceIp"
      requestTime    = "$context.requestTime"
      httpMethod     = "$context.httpMethod"
      routeKey       = "$context.routeKey"
      status         = "$context.status"
      protocol       = "$context.protocol"
      responseLength = "$context.responseLength"
      error          = "$context.error.message"
    })
  }
}

# WebSocket API Gateway
resource "aws_apigatewayv2_api" "websocket" {
  name                       = "${var.project_name}-ws-api-${var.environment}"
  protocol_type              = "WEBSOCKET"
  route_selection_expression = "$request.body.action"
}

resource "aws_apigatewayv2_integration" "ws_connect" {
  api_id             = aws_apigatewayv2_api.websocket.id
  integration_type   = "AWS_PROXY"
  integration_uri    = aws_lambda_function.api.invoke_arn
  integration_method = "POST"
}

resource "aws_apigatewayv2_integration" "ws_disconnect" {
  api_id             = aws_apigatewayv2_api.websocket.id
  integration_type   = "AWS_PROXY"
  integration_uri    = aws_lambda_function.api.invoke_arn
  integration_method = "POST"
}

resource "aws_apigatewayv2_integration" "ws_default" {
  api_id             = aws_apigatewayv2_api.websocket.id
  integration_type   = "AWS_PROXY"
  integration_uri    = aws_lambda_function.api.invoke_arn
  integration_method = "POST"
}

resource "aws_apigatewayv2_route" "ws_connect" {
  api_id    = aws_apigatewayv2_api.websocket.id
  route_key = "$connect"
  target    = "integrations/${aws_apigatewayv2_integration.ws_connect.id}"
}

resource "aws_apigatewayv2_route" "ws_disconnect" {
  api_id    = aws_apigatewayv2_api.websocket.id
  route_key = "$disconnect"
  target    = "integrations/${aws_apigatewayv2_integration.ws_disconnect.id}"
}

resource "aws_apigatewayv2_route" "ws_default" {
  api_id    = aws_apigatewayv2_api.websocket.id
  route_key = "$default"
  target    = "integrations/${aws_apigatewayv2_integration.ws_default.id}"
}

resource "aws_apigatewayv2_stage" "websocket" {
  api_id      = aws_apigatewayv2_api.websocket.id
  name        = "$default"
  auto_deploy = true
}

# Lambda permission for WebSocket API
resource "aws_lambda_permission" "websocket" {
  statement_id  = "AllowWebSocketAPIGatewayInvoke"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.api.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_apigatewayv2_api.websocket.execution_arn}/*/*"
}

# S3 Bucket for Frontend
resource "aws_s3_bucket" "frontend" {
  bucket = "${var.project_name}-frontend-${var.environment}-${data.aws_caller_identity.current.account_id}"
}


resource "aws_s3_bucket_public_access_block" "frontend" {
  bucket = aws_s3_bucket.frontend.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

# CloudFront Origin Access Control
resource "aws_cloudfront_origin_access_control" "frontend" {
  name                              = "${var.project_name}-frontend-oac"
  description                       = "OAC for ${var.project_name} frontend S3 bucket"
  origin_access_control_origin_type = "s3"
  signing_behavior                  = "always"
  signing_protocol                  = "sigv4"
}

# S3 bucket policy - only allow CloudFront access
resource "aws_s3_bucket_policy" "frontend" {
  bucket = aws_s3_bucket.frontend.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid       = "AllowCloudFrontServicePrincipal"
        Effect    = "Allow"
        Principal = {
          Service = "cloudfront.amazonaws.com"
        }
        Action   = "s3:GetObject"
        Resource = "${aws_s3_bucket.frontend.arn}/*"
        Condition = {
          StringEquals = {
            "AWS:SourceArn" = aws_cloudfront_distribution.frontend.arn
          }
        }
      }
    ]
  })
}

# CloudFront Distribution
resource "aws_cloudfront_distribution" "frontend" {
  enabled             = true
  is_ipv6_enabled     = true
  default_root_object = "index.html"

  origin {
    domain_name              = aws_s3_bucket.frontend.bucket_regional_domain_name
    origin_id                = "S3-${var.project_name}"
    origin_access_control_id = aws_cloudfront_origin_access_control.frontend.id
  }

  origin {
    domain_name = replace(aws_apigatewayv2_api.http.api_endpoint, "https://", "")
    origin_id   = "API-${var.project_name}"

    custom_origin_config {
      http_port              = 80
      https_port             = 443
      origin_protocol_policy = "https-only"
      origin_ssl_protocols   = ["TLSv1.2"]
    }
  }

  default_cache_behavior {
    allowed_methods  = ["GET", "HEAD"]
    cached_methods   = ["GET", "HEAD"]
    target_origin_id = "S3-${var.project_name}"

    forwarded_values {
      query_string = false
      cookies {
        forward = "none"
      }
    }

    viewer_protocol_policy = "redirect-to-https"
    min_ttl                = 0
    default_ttl            = 3600
    max_ttl                = 86400
    compress               = true
  }

  ordered_cache_behavior {
    path_pattern     = "/api/*"
    allowed_methods  = ["GET", "HEAD", "OPTIONS", "PUT", "POST", "PATCH", "DELETE"]
    cached_methods   = ["GET", "HEAD"]
    target_origin_id = "API-${var.project_name}"

    forwarded_values {
      query_string = true
      headers      = ["Authorization", "X-Request-ID", "X-Client-ID"]
      cookies {
        forward = "all"
      }
    }

    viewer_protocol_policy = "https-only"
    min_ttl                = 0
    default_ttl            = 0
    max_ttl                = 0
  }

  price_class = "PriceClass_100"

  restrictions {
    geo_restriction {
      restriction_type = "none"
    }
  }

  viewer_certificate {
    cloudfront_default_certificate = true
  }

  tags = var.common_tags
}

# DynamoDB Stream Lambda
resource "aws_lambda_function" "stream_handler" {
  function_name = "${var.project_name}-stream-handler-${var.environment}"
  role          = aws_iam_role.lambda.arn

  package_type = "Image"
  image_uri    = "${aws_ecr_repository.backend.repository_url}:latest"

  timeout     = 60
  memory_size = 256

  environment {
    variables = {
      WEBSOCKET_API_ID       = aws_apigatewayv2_api.websocket.id
      CONNECTIONS_TABLE_NAME = aws_dynamodb_table.websocket_connections.name
      ENVIRONMENT            = var.environment
      WEBSOCKET_ENDPOINT     = replace(aws_apigatewayv2_api.websocket.api_endpoint, "wss://", "https://")
    }
  }

  depends_on = [
    aws_iam_role_policy_attachment.lambda_policy
  ]
}

resource "aws_lambda_event_source_mapping" "stream" {
  event_source_arn  = aws_dynamodb_table.counter.stream_arn
  function_name     = aws_lambda_function.stream_handler.arn
  starting_position = "LATEST"
}

# Outputs
output "api_endpoint" {
  value = aws_apigatewayv2_api.http.api_endpoint
}

output "websocket_endpoint" {
  value = aws_apigatewayv2_api.websocket.api_endpoint
}

output "cloudfront_url" {
  value = "https://${aws_cloudfront_distribution.frontend.domain_name}"
}

output "ecr_repository_url" {
  value = aws_ecr_repository.backend.repository_url
}

output "s3_bucket_name" {
  value = aws_s3_bucket.frontend.id
}


