# Number Acidizer

A distributed, ACID-compliant counter application built with AWS serverless technologies.

## Features

- **ACID Compliance**: Guaranteed consistency with DynamoDB transactions
- **Real-time Updates**: WebSocket support for instant synchronization
- **Scalable Architecture**: Serverless design that scales automatically
- **High Performance**: Optimistic locking and exponential backoff
- **"Beautiful" UI**: Animated counter with modern glassmorphism design

## Architecture

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   React     │────▶│ CloudFront  │────▶│ API Gateway │
│  Frontend   │     │    (CDN)    │     │   (REST)    │
└─────────────┘     └─────────────┘     └──────┬──────┘
                                                │
                                                ▼
                                        ┌─────────────┐
                                        │   Lambda    │
                                        │  Function   │
                                        └──────┬──────┘
                                                │
                                                ▼
                                        ┌─────────────┐
                                        │  DynamoDB   │
                                        │   (ACID)    │
                                        └─────────────┘
```

| Output                            | Value (Example)                                                           |
| --------------------------------- | ------------------------------------------------------------------------- |
| `api_url` / `api_endpoint`        | `https://wo9rryet3h.execute-api.eu-central-1.amazonaws.com`               |
| `websocket_url`                   | `wss://b5nb3a6s90.execute-api.eu-central-1.amazonaws.com`                 |
| `cloudfront_url` / `frontend_url` | `https://d1nrvqnzqabwh4.cloudfront.net`                                   |
| `lambda_functions.api`            | `number-acidizer-api-prod`                                                |
| `dynamodb_tables`                 | `audit`, `connections`, `counter`                                         |
| `s3_bucket_name`                  | `number-acidizer-frontend-prod-825288425159`                              |
| `ecr_repository_url`              | `825288425159.dkr.ecr.eu-central-1.amazonaws.com/number-acidizer-backend` |
| `github_actions_role_arn`         | Role for GitHub OIDC deployment pipeline                                  |

## Tech Stack

- **Frontend**: React, TypeScript, Zustand, Framer Motion, Tailwind CSS
- **Backend**: Node.js, TypeScript, AWS Lambda
- **Database**: DynamoDB with transactions
- **Infrastructure**: Terraform, AWS (API Gateway, CloudFront, S3, ECR)
- **CI/CD**: GitHub Actions

## Getting Started

### Prerequisites

- AWS Account (Free Tier compatible)
- Node.js 18+
- Docker
- Terraform 1.0+
- AWS CLI configured

### Local Development

1. **Clone the repository**

   ```bash
   git clone https://github.com/yourusername/number-acidizer.git
   cd number-acidizer
   ```

2. **Run Setup Script**

   **Windows (PowerShell - Recommended):**

   ```powershell
   # Run as Administrator if needed
   Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
   .\setup.ps1
   ```

   **Windows (Command Prompt):**

   ```cmd
   setup.bat
   ```

   **Linux/macOS:**

   ```bash
   chmod +x setup.sh
   ./setup.sh
   ```

3. **Manual Setup (if scripts fail)**

   ```bash
   # Install all dependencies
   npm run install:all

   # Create environment file
   # Copy frontend/.env.example to frontend/.env.local
   # Update with your API endpoints

   # Initialize Terraform
   cd infrastructure
   terraform init
   ```

4. **Run locally**

   ```bash
   # Using Docker (recommended)
   docker-compose up

   # Or run separately:
   # Backend (in one terminal)
   cd backend
   npm run watch

   # Frontend (in another terminal)
   cd frontend
   npm start
   ```

### Deployment

1. **Set up AWS credentials**

   ```bash
   aws configure
   ```

2. **Create S3 bucket for Terraform state**

   ```bash
   aws s3 mb s3://your-terraform-state-bucket
   ```

3. **Deploy infrastructure**

   ```bash
   cd infrastructure
   terraform init
   terraform plan
   terraform apply
   ```

4. **Build and deploy**

   ```bash
   # Build and push Docker image
   cd backend
   docker build -t your-ecr-repo .
   docker push your-ecr-repo

   # Deploy frontend
   cd ../frontend
   npm run build
   aws s3 sync build/ s3://your-frontend-bucket
   ```

## Key Design Decisions

### ACID Compliance

- **Atomicity**: DynamoDB transactions ensure all-or-nothing updates
- **Consistency**: Conditional expressions prevent race conditions
- **Isolation**: Optimistic locking with version numbers
- **Durability**: DynamoDB's built-in durability guarantees

### Performance Optimizations

- **Connection Pooling**: Reuse DynamoDB connections
- **Reserved Concurrency**: Prevent Lambda cold starts
- **CloudFront Caching**: Global edge caching for static assets
- **Exponential Backoff**: Graceful handling of conflicts

### Security

- **IAM Least Privilege**: Minimal permissions for each component
- **Request Validation**: UUID format validation for request IDs
- **Rate Limiting**: API Gateway throttling
- **Encryption**: At-rest and in-transit encryption

## API Endpoints

- `GET /value` - Get current counter value
- `POST /increment` - Increment counter by 1
- `POST /decrement` - Decrement counter by 1
- `wss://` - WebSocket connection for real-time updates

## Testing

```bash
# Unit tests
cd backend && npm test
cd frontend && npm test

# Integration tests
npm run test:integration

# E2E tests
npm run test:e2e
```

## Monitoring

- CloudWatch Logs for Lambda functions
- X-Ray tracing for performance analysis
- CloudWatch Alarms for error rates
- DynamoDB metrics for capacity planning

## Contributing

1. Fork the repository
2. Create a feature branch
3. Commit your changes
4. Push to the branch
5. Create a Pull Request

## License

MIT License - see LICENSE file for details
