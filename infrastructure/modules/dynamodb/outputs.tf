output "counter_table_name" {
  value = aws_dynamodb_table.counter.name
}

output "counter_table_arn" {
  value = aws_dynamodb_table.counter.arn
}

output "counter_table_stream_arn" {
  value = aws_dynamodb_table.counter.stream_arn
}

output "audit_table_name" {
  value = aws_dynamodb_table.audit.name
}

output "audit_table_arn" {
  value = aws_dynamodb_table.audit.arn
}

output "connections_table_name" {
  value = aws_dynamodb_table.websocket_connections.name
}

output "connections_table_arn" {
  value = aws_dynamodb_table.websocket_connections.arn
}
