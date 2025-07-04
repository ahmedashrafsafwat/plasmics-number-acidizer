# Environment Variables Configuration

This document outlines all environment variables used across the Number Acidizer application.

## Backend Environment Variables

### Required for Local Development

```bash
# Application Environment
ENVIRONMENT=local                    # Set to 'local' for development, 'prod' for production
AWS_REGION=eu-central-1             # AWS region for all services
PORT=3001                           # Port for local development server

# DynamoDB Configuration
COUNTER_TABLE_NAME=NumberAcidizer-local              # Main counter table
AUDIT_TABLE_NAME=NumberAcidizer-local-audit          # Audit log table
CONNECTIONS_TABLE_NAME=WebSocketConnections-local    # WebSocket connections table

# WebSocket Configuration
WEBSOCKET_ENDPOINT=http://localhost:3001             # Local WebSocket endpoint

# Logging
LOG_LEVEL=debug                     # Log level: debug, info, warn, error
```

### Production Environment Variables (Set by Terraform)

```bash
# Application Environment
ENVIRONMENT=prod
AWS_REGION=eu-central-1

# DynamoDB Configuration
COUNTER_TABLE_NAME=number-acidizer-counter-prod
AUDIT_TABLE_NAME=number-acidizer-audit-prod
CONNECTIONS_TABLE_NAME=number-acidizer-connections-prod

# WebSocket Configuration
WEBSOCKET_ENDPOINT=wss://b5nb3a6s90.execute-api.eu-central-1.amazonaws.com

# Logging
LOG_LEVEL=info
```

## Frontend Environment Variables

### Local Development (.env.local)

```bash
# API Configuration
REACT_APP_API_URL=http://localhost:3001    # Backend API endpoint
REACT_APP_WS_URL=ws://localhost:3001       # WebSocket endpoint

# Environment
NODE_ENV=development                       # React environment mode
```

### Production Environment (.env.production)

```bash
# API Configuration
REACT_APP_API_URL=https://wo9rryet3h.execute-api.eu-central-1.amazonaws.com
REACT_APP_WS_URL=wss://b5nb3a6s90.execute-api.eu-central-1.amazonaws.com

# Environment
NODE_ENV=production
```

## CI/CD Environment Variables (GitHub Secrets)

### Required GitHub Secrets

```bash
# AWS Configuration
AWS_REGION=eu-central-1                    # AWS region
AWS_ACCOUNT_ID=825288425159                # AWS account ID

# GitHub OIDC Role
AWS_ROLE_TO_ASSUME=arn:aws:iam::825288425159:role/github-actions-role

# Terraform State
TF_STATE_BUCKET=number-acidizer-terraform-state-825288425159
TF_STATE_KEY=terraform.tfstate
TF_STATE_REGION=eu-central-1

# Application Configuration
ECR_REPOSITORY=number-acidizer-backend
FRONTEND_BUCKET_NAME=number-acidizer-frontend-prod-825288425159
```

## Docker Compose Environment Variables

The `docker-compose.yml` automatically sets up the required environment variables for local development:

```yaml
services:
  backend:
    environment:
      - ENVIRONMENT=local
      - AWS_REGION=eu-central-1
      - PORT=3001
      - COUNTER_TABLE_NAME=NumberAcidizer-local
      - AUDIT_TABLE_NAME=NumberAcidizer-local-audit
      - CONNECTIONS_TABLE_NAME=WebSocketConnections-local
      - WEBSOCKET_ENDPOINT=http://backend:3001
      - LOG_LEVEL=debug
  
  frontend:
    environment:
      - REACT_APP_API_URL=http://localhost:3001
      - REACT_APP_WS_URL=ws://localhost:3001
      - NODE_ENV=development
```

## Environment Variable Validation

The application validates required environment variables at startup:

### Backend Validation (`src/utils/validation.ts`)

```typescript
const requiredEnvVars = [
  'AWS_REGION',
  'COUNTER_TABLE_NAME',
  'AUDIT_TABLE_NAME',
  'CONNECTIONS_TABLE_NAME'
];

requiredEnvVars.forEach(envVar => {
  if (!process.env[envVar]) {
    throw new Error(`Missing required environment variable: ${envVar}`);
  }
});
```

### Frontend Validation (`src/services/api.service.ts`)

```typescript
if (!process.env.REACT_APP_API_URL) {
  throw new Error('REACT_APP_API_URL environment variable is required');
}

if (!process.env.REACT_APP_WS_URL) {
  console.warn('REACT_APP_WS_URL not set, WebSocket features will be disabled');
}
```

## Security Considerations

### Sensitive Variables
- Never commit `.env` files to version control
- Use GitHub Secrets for CI/CD variables
- Rotate AWS credentials regularly
- Use IAM roles instead of access keys when possible

### Environment-Specific Configuration
- Local: Uses Docker container networking
- Development: Uses AWS development account
- Production: Uses AWS production account with enhanced monitoring

### Variable Precedence
1. Command line arguments (highest priority)
2. Environment variables
3. .env files
4. Default values (lowest priority)

## Troubleshooting

### Common Issues

1. **WebSocket Connection Failed**
   - Check `REACT_APP_WS_URL` includes correct stage (`/prod`)
   - Verify `WEBSOCKET_ENDPOINT` in backend matches frontend URL

2. **DynamoDB Connection Failed**
   - Ensure `ENVIRONMENT=local` for local development
   - Check Docker container can reach `dynamodb-local:8000`

3. **API Calls Failing**
   - Verify `REACT_APP_API_URL` matches backend endpoint
   - Check CORS configuration in API Gateway

4. **Lambda Function Errors**
   - Ensure all required environment variables are set in Terraform
   - Check CloudWatch logs for missing variable errors

### Debugging Commands

```bash
# Check environment variables in running container
docker exec -it number-acidizer-backend env | grep -E "(API|WS|TABLE|ENVIRONMENT)"

# Validate frontend environment variables
npm run build  # Will fail if required variables are missing

# Test API connectivity
curl $REACT_APP_API_URL/value

# Test WebSocket connectivity
wscat -c $REACT_APP_WS_URL/prod
```