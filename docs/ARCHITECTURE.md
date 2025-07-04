# System Architecture Documentation

Comprehensive documentation of the Number Acidizer system architecture, design patterns, and implementation details.

## High-Level Architecture

```mermaid
C4Context
    title System Context Diagram for Number Acidizer

    Person(user, "User", "Interacts with the counter application")
    
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

## Component Architecture

```mermaid
C4Component
    title Component Diagram - API Lambda Function

    Container_Boundary(c1, "API Lambda Function") {
        Component(router, "Router", "Express.js", "Routes incoming requests")
        Component(handlers, "Request Handlers", "TypeScript", "Increment, Decrement, Get handlers")
        Component(validation, "Request Validation", "TypeScript", "Validates input and headers")
        Component(dynamo_service, "DynamoDB Service", "TypeScript", "Handles database operations")
        Component(websocket_service, "WebSocket Service", "TypeScript", "Broadcasts updates")
        Component(logger, "Logger", "Pino", "Structured logging")
    }
    
    ContainerDb_Ext(dynamodb, "DynamoDB", "NoSQL Database")
    Container_Ext(api_gateway_ws, "API Gateway WebSocket", "WebSocket API")
    
    Rel(router, handlers, "Dispatches to")
    Rel(handlers, validation, "Validates with")
    Rel(handlers, dynamo_service, "Uses")
    Rel(handlers, websocket_service, "Notifies")
    Rel(handlers, logger, "Logs with")
    
    Rel(dynamo_service, dynamodb, "Transacts with", "DynamoDB API")
    Rel(websocket_service, api_gateway_ws, "Broadcasts via", "Management API")
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

### Atomicity

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

**Implementation Details:**
- DynamoDB TransactWrite ensures all-or-nothing operations
- Counter update and audit log creation happen atomically
- Request ID prevents duplicate operations (idempotency)

### Consistency

```typescript
// Version-based optimistic locking
const updateExpression = 'SET #val = :newVal, #ver = :newVer, #updated = :timestamp';
const conditionExpression = '#ver = :currentVer';

const transactItems = [{
  Update: {
    TableName: this.tableName,
    Key: { id: 'global-counter' },
    UpdateExpression: updateExpression,
    ConditionExpression: conditionExpression,
    ExpressionAttributeNames: {
      '#val': 'value',
      '#ver': 'version',
      '#updated': 'lastUpdated'
    },
    ExpressionAttributeValues: {
      ':newVal': newValue,
      ':newVer': currentVersion + 1,
      ':currentVer': currentVersion,
      ':timestamp': new Date().toISOString()
    }
  }
}];
```

### Isolation

```mermaid
flowchart LR
    A[Request A] --> B[Read Version 5]
    C[Request B] --> D[Read Version 5]
    B --> E[Update to Version 6]
    D --> F[Try Update to Version 6]
    E --> G[Success]
    F --> H[Condition Failed]
    H --> I[Retry with New Version]
    I --> J[Read Version 6]
    J --> K[Update to Version 7]
    K --> L[Success]
```

**Key Features:**
- Optimistic locking with version numbers
- Conditional updates prevent race conditions
- Exponential backoff for retry logic
- Maximum retry limit prevents infinite loops

### Durability

```mermaid
flowchart TB
    A[Transaction Committed] --> B[DynamoDB Persistence]
    B --> C[Multi-AZ Replication]
    C --> D[Point-in-Time Recovery]
    B --> E[Audit Trail]
    E --> F[Compliance Logging]
    B --> G[DynamoDB Streams]
    G --> H[Real-time Processing]
```

## Scalability Patterns

### Horizontal Scaling

```mermaid
graph TB
    subgraph "Auto Scaling Group"
        L1[Lambda Instance 1]
        L2[Lambda Instance 2]
        L3[Lambda Instance N]
    end
    
    subgraph "Load Distribution"
        ALB[API Gateway]
        ALB --> L1
        ALB --> L2
        ALB --> L3
    end
    
    subgraph "Data Layer"
        DDB[(DynamoDB)]
        DDB --> R1[Read Replica 1]
        DDB --> R2[Read Replica 2]
    end
    
    L1 --> DDB
    L2 --> DDB
    L3 --> DDB
```

### Performance Optimizations

1. **Connection Pooling**
   ```typescript
   // Reuse DynamoDB connections across invocations
   const client = new DynamoDBClient(config);
   const docClient = DynamoDBDocumentClient.from(client);
   ```

2. **Lambda Provisioned Concurrency**
   ```hcl
   resource "aws_lambda_provisioned_concurrency_config" "api" {
     function_name                     = aws_lambda_function.api.function_name
     provisioned_concurrent_executions = 10
     qualifier                        = aws_lambda_function.api.version
   }
   ```

3. **CloudFront Caching**
   ```hcl
   default_cache_behavior {
     cached_methods         = ["GET", "HEAD"]
     cache_policy_id        = data.aws_cloudfront_cache_policy.caching_optimized.id
     compress               = true
     viewer_protocol_policy = "redirect-to-https"
   }
   ```

## Security Architecture

### Defense in Depth

```mermaid
flowchart TB
    subgraph "Edge Layer"
        WAF[AWS WAF]
        CF[CloudFront]
    end
    
    subgraph "API Layer"
        APIGW[API Gateway]
        THROTTLE[Rate Limiting]
        CORS[CORS Policy]
    end
    
    subgraph "Compute Layer"
        IAM[IAM Roles]
        LAMBDA[Lambda Functions]
        VPC[VPC (Optional)]
    end
    
    subgraph "Data Layer"
        ENCRYPT[Encryption at Rest]
        DDB[(DynamoDB)]
        BACKUP[Point-in-Time Recovery]
    end
    
    WAF --> CF
    CF --> APIGW
    APIGW --> THROTTLE
    THROTTLE --> CORS
    CORS --> IAM
    IAM --> LAMBDA
    LAMBDA --> ENCRYPT
    ENCRYPT --> DDB
    DDB --> BACKUP
```

### IAM Security Model

```mermaid
graph TB
    subgraph "GitHub Actions"
        OIDC[OIDC Provider]
        ROLE[GitHub Actions Role]
    end
    
    subgraph "Lambda Execution"
        EXEC[Execution Role]
        PERM[Least Privilege Permissions]
    end
    
    subgraph "Resource Access"
        DDB[DynamoDB Tables]
        CW[CloudWatch Logs]
        ECR[ECR Repository]
    end
    
    OIDC --> ROLE
    ROLE --> EXEC
    EXEC --> PERM
    PERM --> DDB
    PERM --> CW
    PERM --> ECR
```

## Monitoring and Observability

### Observability Stack

```mermaid
flowchart LR
    subgraph "Application Layer"
        APP[Application Code]
        PINO[Pino Logger]
        METRICS[Custom Metrics]
    end
    
    subgraph "AWS Observability"
        CW_LOGS[CloudWatch Logs]
        CW_METRICS[CloudWatch Metrics]
        XRAY[X-Ray Tracing]
    end
    
    subgraph "Analysis"
        DASHBOARDS[CloudWatch Dashboards]
        ALARMS[CloudWatch Alarms]
        INSIGHTS[CloudWatch Insights]
    end
    
    APP --> PINO
    PINO --> CW_LOGS
    METRICS --> CW_METRICS
    APP --> XRAY
    
    CW_LOGS --> DASHBOARDS
    CW_METRICS --> DASHBOARDS
    CW_METRICS --> ALARMS
    CW_LOGS --> INSIGHTS
```

### Structured Logging

```typescript
// Request-scoped logger with correlation ID
const logger = createRequestLogger(
  event.requestContext?.requestId || 'unknown',
  'increment-handler'
);

logger.info({
  operation: 'increment',
  currentValue: counter.value,
  newValue: newValue,
  clientId: clientId,
  duration: Date.now() - startTime
}, 'Counter increment completed');
```

### Custom Metrics

```typescript
// Business metrics
await cloudWatch.putMetricData({
  Namespace: 'NumberAcidizer',
  MetricData: [{
    MetricName: 'CounterOperations',
    Value: 1,
    Unit: 'Count',
    Dimensions: [{
      Name: 'Operation',
      Value: 'increment'
    }]
  }]
}).promise();
```

## Deployment Architecture

### Blue-Green Deployment

```mermaid
flowchart TB
    subgraph "Production Environment"
        PROD_ALB[API Gateway]
        PROD_BLUE[Blue Environment]
        PROD_GREEN[Green Environment]
    end
    
    subgraph "Deployment Process"
        CI[CI/CD Pipeline]
        HEALTH[Health Checks]
        SWITCH[Traffic Switch]
    end
    
    CI --> PROD_GREEN
    PROD_GREEN --> HEALTH
    HEALTH --> SWITCH
    SWITCH --> PROD_ALB
    PROD_ALB --> PROD_BLUE
    PROD_ALB -.-> PROD_GREEN
```

### Infrastructure as Code

```mermaid
flowchart LR
    subgraph "Source Control"
        GIT[Git Repository]
        TF[Terraform Files]
    end
    
    subgraph "CI/CD Pipeline"
        PLAN[Terraform Plan]
        APPLY[Terraform Apply]
        VALIDATE[Resource Validation]
    end
    
    subgraph "AWS Infrastructure"
        VPC[VPC Resources]
        COMPUTE[Compute Resources]
        DATA[Data Resources]
        NETWORK[Network Resources]
    end
    
    GIT --> TF
    TF --> PLAN
    PLAN --> APPLY
    APPLY --> VALIDATE
    VALIDATE --> VPC
    VALIDATE --> COMPUTE
    VALIDATE --> DATA
    VALIDATE --> NETWORK
```

## Error Handling Architecture

### Circuit Breaker Pattern

```mermaid
stateDiagram-v2
    [*] --> Closed
    Closed --> Open : Failure threshold reached
    Open --> HalfOpen : Timeout expires
    HalfOpen --> Closed : Success
    HalfOpen --> Open : Failure
    
    Closed : Normal operation
    Open : Fail fast
    HalfOpen : Limited requests
```

### Retry Strategy

```typescript
async function retryWithExponentialBackoff<T>(
  operation: () => Promise<T>,
  maxRetries: number = 5
): Promise<T> {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      if (attempt === maxRetries - 1) throw error;
      
      const delay = Math.pow(2, attempt) * 100;
      await sleep(delay);
    }
  }
  throw new Error('Max retries exceeded');
}
```

## Performance Characteristics

### Latency Targets

| Operation | Target (p95) | Target (p99) |
|-----------|--------------|--------------|
| GET /value | < 50ms | < 100ms |
| POST /increment | < 100ms | < 200ms |
| POST /decrement | < 100ms | < 200ms |
| WebSocket update | < 50ms | < 100ms |

### Throughput Capacity

| Component | Sustained RPS | Burst RPS |
|-----------|---------------|-----------|
| API Gateway | 10,000 | 20,000 |
| Lambda Functions | 1,000 | 5,000 |
| DynamoDB | 40,000 | 80,000 |
| WebSocket | 1,000 connections | 2,000 connections |

### Resource Utilization

```mermaid
pie title Lambda Memory Usage Distribution
    "Business Logic" : 40
    "AWS SDK" : 25
    "Runtime Overhead" : 20
    "Dependencies" : 15
```

## Technology Stack Rationale

### Frontend Technology Choices

| Technology | Rationale |
|------------|-----------|
| **React** | Component-based architecture, large ecosystem, TypeScript support |
| **TypeScript** | Type safety, better developer experience, compile-time error detection |
| **Zustand** | Lightweight state management, less boilerplate than Redux |
| **Tailwind CSS** | Utility-first CSS, consistent design system, smaller bundle size |
| **Framer Motion** | Smooth animations, declarative API, performance optimized |
| **Vite** | Fast development server, optimized builds, modern tooling |

### Backend Technology Choices

| Technology | Rationale |
|------------|-----------|
| **Node.js** | JavaScript ecosystem, async I/O, Lambda compatibility |
| **TypeScript** | Type safety, better maintainability, shared types with frontend |
| **AWS Lambda** | Serverless scalability, pay-per-use, no server management |
| **DynamoDB** | NoSQL flexibility, built-in transactions, managed service |
| **Pino** | High-performance logging, structured logs, CloudWatch integration |

### Infrastructure Choices

| Technology | Rationale |
|------------|-----------|
| **Terraform** | Infrastructure as Code, state management, multi-cloud support |
| **AWS API Gateway** | Managed API service, WebSocket support, built-in features |
| **CloudFront** | Global CDN, SSL termination, edge caching |
| **ECR** | Managed container registry, integrated with Lambda |
| **GitHub Actions** | Integrated CI/CD, OIDC support, free for public repos |

## Future Architecture Considerations

### Planned Enhancements

1. **Multi-Region Deployment**
   - Global DynamoDB tables
   - Regional Lambda deployments
   - Cross-region failover

2. **Advanced Caching**
   - Redis/ElastiCache for session data
   - Application-level caching
   - Edge computing with Lambda@Edge

3. **Enhanced Security**
   - API authentication with Cognito
   - Request signing
   - VPC deployment for sensitive workloads

4. **Improved Observability**
   - Distributed tracing with X-Ray
   - Custom CloudWatch dashboards
   - Real-time alerting system

### Scalability Roadmap

1. **Phase 1**: Current architecture (1K RPS)
2. **Phase 2**: Regional deployment (10K RPS)
3. **Phase 3**: Global deployment (100K RPS)
4. **Phase 4**: Edge computing (1M RPS)

This architecture document serves as the foundation for understanding, maintaining, and evolving the Number Acidizer system.