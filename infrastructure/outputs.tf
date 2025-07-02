output "api_url" {
  description = "HTTP API Gateway URL"
  value       = aws_apigatewayv2_api.http.api_endpoint
}

output "websocket_url" {
  description = "WebSocket API Gateway URL"
  value       = aws_apigatewayv2_api.websocket.api_endpoint
}

output "frontend_url" {
  description = "CloudFront distribution URL"
  value       = "https://${aws_cloudfront_distribution.frontend.domain_name}"
}

output "ecr_repository" {
  description = "ECR repository URL"
  value       = aws_ecr_repository.backend.repository_url
}

output "s3_bucket" {
  description = "S3 bucket name for frontend"
  value       = aws_s3_bucket.frontend.id
}

output "dynamodb_tables" {
  description = "DynamoDB table names"
  value = {
    counter     = aws_dynamodb_table.counter.name
    audit       = aws_dynamodb_table.audit.name
    connections = aws_dynamodb_table.websocket_connections.name
  }
}

output "lambda_functions" {
  description = "Lambda function names"
  value = {
    api            = aws_lambda_function.api.function_name
    stream_handler = aws_lambda_function.stream_handler.function_name
  }
}

output "cloudfront_distribution_id" {
  description = "CloudFront distribution ID for cache invalidation"
  value       = aws_cloudfront_distribution.frontend.id
}

# Security and access outputs
output "ahmed_access_key_id" {
  description = "Access Key ID for Ahmed"
  value       = aws_iam_access_key.ahmed.id
  sensitive   = true
}

output "ahmed_secret_access_key" {
  description = "Secret Access Key for Ahmed"
  value       = aws_iam_access_key.ahmed.secret
  sensitive   = true
}

output "github_actions_role_arn" {
  description = "ARN of the GitHub Actions OIDC IAM role"
  value       = aws_iam_role.github_actions_oidc.arn
}
