# System Architecture Documentation

Comprehensive documentation of the Number Acidizer system architecture, design patterns, and implementation details.

## Immportant to note here in this file

While I consider myself good at mermaid, most of these drawings are done with the help of Claude + ChatGPT for faster implementation.

## High-Level Architecture

```mermaid
C4Context
    title System Context Diagram for Number Acidizer

    Person(user, "User")

    System_Boundary(b1, "Number Acidizer System") {
        System(counter_app, "Counter Application", "ACID-compliant distributed counter")
    }

    System_Ext(aws_cloud, "AWS Cloud", "Cloud infrastructure and services")
    System_Ext(github, "GitHub", "Source code and CI/CD")
    System_Ext(cloudwatch, "CloudWatch", "Monitoring and logging")

    Rel(user, counter_app, "Uses", "HTTPS/WebSocket")
    Rel(counter_app, aws_cloud, "Deployed on", "AWS Services")
    Rel(github, counter_app, "Deploys", "CI/CD Pipeline")
    Rel(counter_app, cloudwatch, "Sends logs/metrics", "CloudWatch API")
```

## Container Architecture

```mermaid
C4Container
    title Container Diagram for Number Acidizer

    Person(user, "User")

    Container_Boundary(c1, "Number Acidizer System") {
        Container(spa, "Single Page App", "React, TypeScript", "Provides counter UI and real-time updates")
        Container(api_gateway, "API Gateway", "AWS API Gateway", "Routes HTTP and WebSocket requests")
        Container(lambda_api, "API Lambda", "Node.js, TypeScript", "Handles counter operations")
        Container(lambda_ws, "WebSocket Lambda", "Node.js, TypeScript", "Manages WebSocket connections")
        Container(lambda_stream, "Stream Lambda", "Node.js, TypeScript", "Processes DynamoDB streams")
        ContainerDb(dynamodb, "Database", "DynamoDB", "Stores counter data with ACID transactions")
        Container(cloudfront, "CloudFront", "AWS CloudFront", "CDN for static assets")
        ContainerDb(s3, "Static Assets", "S3", "Hosts React application files")
    }

    Container_Ext(ecr, "Container Registry", "AWS ECR", "Stores Lambda container images")

    Rel(user, cloudfront, "Uses", "HTTPS")
    Rel(user, api_gateway, "Makes API calls", "HTTPS")
    Rel(user, api_gateway, "WebSocket connection", "WSS")

    Rel(cloudfront, s3, "Serves", "Static files")
    Rel(api_gateway, lambda_api, "Routes", "HTTP requests")
    Rel(api_gateway, lambda_ws, "Routes", "WebSocket events")

    Rel(lambda_api, dynamodb, "Reads/Writes", "DynamoDB API")
    Rel(lambda_ws, dynamodb, "Reads/Writes", "DynamoDB API")
    Rel(dynamodb, lambda_stream, "Triggers", "DynamoDB Stream")
    Rel(lambda_stream, api_gateway, "Broadcasts", "WebSocket API")

    Rel(ecr, lambda_api, "Provides", "Container image")
    Rel(ecr, lambda_ws, "Provides", "Container image")
    Rel(ecr, lambda_stream, "Provides", "Container image")
```

## Data Flow Architecture

```mermaid
sequenceDiagram
    participant User
    participant CloudFront
    participant S3
    participant React
    participant APIGateway
    participant Lambda
    participant DynamoDB
    participant DDBStream
    participant StreamLambda
    participant WebSocket

    User->>CloudFront: GET /
    CloudFront->>S3: Fetch static files
    S3-->>CloudFront: HTML, CSS, JS
    CloudFront-->>User: React Application

    User->>React: Load application
    React->>APIGateway: GET /value
    APIGateway->>Lambda: HTTP Request
    Lambda->>DynamoDB: Query counter
    DynamoDB-->>Lambda: Current value
    Lambda-->>APIGateway: Response
    APIGateway-->>React: Counter data
    React-->>User: Display counter

    User->>React: Click increment
    React->>APIGateway: POST /increment
    APIGateway->>Lambda: HTTP Request
    Lambda->>DynamoDB: Transaction (increment)
    DynamoDB->>DDBStream: Change event
    DynamoDB-->>Lambda: New value
    Lambda-->>APIGateway: Response
    APIGateway-->>React: Success response

    DDBStream->>StreamLambda: Stream record
    StreamLambda->>APIGateway: Broadcast update
    APIGateway->>WebSocket: Send to all connections
    WebSocket-->>React: Real-time update
    React-->>User: Update UI
```

## ACID Compliance Implementation

```mermaid
flowchart TD
    A[Client Request] --> B{Request Validation}
    B -->|Invalid| C[Return 400 Error]
    B -->|Valid| D[Generate Request ID]
    D --> E[Begin Transaction]
    E --> F[Update Counter]
    E --> G[Create Audit Record]
    F --> H{Transaction Success?}
    G --> H
    H -->|Success| I[Commit Transaction]
    H -->|Failure| J[Rollback Transaction]
    I --> K[Return Success]
    J --> L[Return Error]
```
