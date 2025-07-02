# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Architecture

**Number Acidizer** is an ACID-compliant distributed counter application with a serverless AWS architecture:

- **Frontend**: React + TypeScript + Zustand (state) + Framer Motion (animations) + Tailwind CSS
- **Backend**: Node.js + TypeScript + AWS Lambda functions + DynamoDB
- **Infrastructure**: Terraform for AWS resources (API Gateway, CloudFront, S3, ECR)
- **Real-time**: WebSocket support for live synchronization across clients

### Key Architecture Components

1. **ACID Compliance**: DynamoDB transactions with optimistic locking (version numbers) and exponential backoff retry logic in `backend/src/services/dynamodb.service.ts:80-149`
2. **State Management**: Zustand store with optimistic updates and WebSocket synchronization in `frontend/src/stores/counterStore.ts`
3. **Lambda Handlers**: Separate handlers for increment/decrement/get operations in `backend/src/handlers/`
4. **WebSocket Service**: Real-time updates with client ID tracking to prevent self-updates

## Development Commands

### Root Level Commands
```bash
# Install all dependencies
npm run install:all

# Build entire project
npm run build

# Run all tests
npm run test

# Run all linters
npm run lint

# Local development with Docker
docker-compose up

# Terraform operations
npm run terraform:init
npm run terraform:plan
npm run terraform:apply
```

### Backend Commands (from /backend)
```bash
# Local development server
npm run dev

# Watch mode (TypeScript compilation)
npm run watch

# Build TypeScript
npm run build

# Run tests
npm test

# Lint
npm run lint
```

### Frontend Commands (from /frontend)
```bash
# Development server
npm start

# Build for production
npm run build

# Run tests
npm test

# Lint
npm run lint
```

## Testing

- **Unit Tests**: Standard Jest tests in each package (`npm test`)
- **ACID Compliance Tests**: Comprehensive test suite in `tests/acid-test.ts` that validates:
  - Atomicity: 100 concurrent operations should result in exact expected value
  - Consistency: Boundary enforcement (min: 0, max: 1B)
  - Isolation: Concurrent increment/decrement pairs should net to zero
  - Durability: Values persist after operations
  - Stress Testing: High-load concurrent operations

Run ACID tests: `cd tests && npx ts-node acid-test.ts`

## Key Technical Details

### Counter Bounds
- Minimum value: 0
- Maximum value: 1,000,000,000
- Validation enforced at service layer

### DynamoDB Schema
- **Counter Table**: `{ id: "global-counter", value: number, version: number, lastUpdated: string }`
- **Audit Table**: Tracks all operations with requestId for idempotency

### WebSocket Updates
- Client ID system prevents self-update loops
- Only updates from other clients trigger UI changes
- WebSocket service auto-reconnects on connection loss

### Error Handling
- Optimistic locking conflicts trigger exponential backoff (max 5 retries)
- Frontend reverts optimistic updates on API errors
- Request ID headers prevent duplicate operations

## Environment Setup

Local development uses Docker Compose with:
- Local DynamoDB instance
- Backend on port 3001
- Frontend on port 3000
- Hot reloading enabled

Production deployment requires AWS credentials and Terraform state bucket configuration.