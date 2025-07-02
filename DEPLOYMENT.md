# Deployment Guide

This guide walks you through setting up the complete CI/CD pipeline for the Number Acidizer application.

## Prerequisites

- AWS Account (Free Tier compatible)
- GitHub repository
- Terraform installed locally
- AWS CLI configured

## Initial Setup

### 1. Setup Terraform Backend (Automated)

**Option A: Using the setup script (Recommended for local development)**

```bash
# Linux/macOS
./scripts/setup-terraform-backend.sh

# Windows PowerShell
.\scripts\setup-terraform-backend.ps1
```

**Option B: Manual setup**

```bash
# The script does this automatically, but you can run manually:
ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
BUCKET_NAME="number-acidizer-terraform-state-${ACCOUNT_ID}"

aws s3api create-bucket --bucket "$BUCKET_NAME" --region eu-central-1
aws s3api put-bucket-versioning --bucket "$BUCKET_NAME" --versioning-configuration Status=Enabled
aws dynamodb create-table \
  --table-name "number-acidizer-terraform-locks" \
  --attribute-definitions AttributeName=LockID,AttributeType=S \
  --key-schema AttributeName=LockID,KeyType=HASH \
  --billing-mode PAY_PER_REQUEST
```

**Option C: Fully automated via GitHub Actions**
The GitHub Actions workflow automatically creates the S3 bucket and DynamoDB table on first run. No manual setup required!

### 2. Update Variables

Edit `infrastructure/variables.tf` and set:

```hcl
variable "github_repository" {
  default = "your-username/number-acidizer"
}
```

### 3. Initial Infrastructure Deployment

**For local development:**

```bash
cd infrastructure
terraform init -backend-config=backend.hcl  # Created by setup script
terraform plan
terraform apply
```

**For GitHub Actions deployment:**
Just push to main branch - everything is automated!

### 4. Configure GitHub Secrets

**Option A: Automatic (recommended)**
After running the setup script, you'll see the output with the secret values. Just add:

- `AWS_GITHUB_ACTIONS_ROLE_ARN`: Get from Terraform output after first deployment

**Option B: Manual**
In your GitHub repository, add these secrets (Settings → Secrets and variables → Actions):

- `AWS_GITHUB_ACTIONS_ROLE_ARN`: The role ARN from Terraform output

**Note:** The TF_STATE_BUCKET is no longer needed as a secret - it's automatically detected!

### 5. Update GitHub Actions Workflow

The workflow is already configured to use OIDC authentication. Make sure your repository name matches the one in the Terraform configuration.

## Architecture Security

### IAM Roles and Permissions

1. **Ahmed (Admin User)**:

   - Full administrator access to AWS account
   - Access keys for CLI/programmatic access

2. **Lambda Execution Role**:

   - DynamoDB read/write access to specific tables only
   - CloudWatch Logs access for function logs
   - X-Ray tracing permissions
   - WebSocket API management permissions

3. **GitHub Actions Role**:

   - ECR push/pull permissions
   - Lambda function update permissions
   - S3 bucket access for frontend deployment
   - CloudFront invalidation permissions
   - No broad administrative access

4. **DynamoDB Tables**:

   - Only accessible by Lambda functions
   - Encryption at rest enabled
   - Point-in-time recovery enabled

5. **S3 Bucket (Frontend)**:

   - Private bucket with CloudFront Origin Access Control
   - No public access allowed
   - Only CloudFront can access bucket contents

6. **CloudFront Distribution**:

   - HTTPS redirect enforced
   - Security headers policy applied
   - Origin Access Control for S3
   - API Gateway integration for backend calls

7. **API Gateway**:
   - Rate limiting configured (100 req/s for free tier)
   - CORS properly configured
   - Only allows access to specific Lambda function

## CI/CD Pipeline

### Workflow Stages

1. **Test Job** (runs on all pushes and PRs):

   - Install dependencies
   - Run linters (backend and frontend)
   - Run unit tests (backend and frontend)
   - Build applications
   - Run ACID compliance tests

2. **Deploy Job** (runs only on main branch pushes after tests pass):

   - Build and push Docker image to ECR
   - Deploy infrastructure updates with Terraform
   - Update Lambda functions with new image
   - Deploy frontend to S3
   - Invalidate CloudFront cache
   - Run post-deployment tests

3. **Cleanup Job** (runs after deployment):
   - Remove old ECR images to save storage costs

### Deployment Flow

```
Push to main → Tests → Build → Deploy Infrastructure → Update Lambda → Deploy Frontend → Invalidate Cache → Test
```

## Cost Optimization

The infrastructure is optimized for AWS Free Tier:

- **DynamoDB**: Pay-per-request billing mode
- **Lambda**: 1M free requests per month
- **API Gateway**: 1M free requests per month
- **CloudFront**: 1TB free data transfer
- **S3**: 5GB free storage
- **ECR**: 500MB free storage per month

**Estimated Monthly Cost**: $0-$5 for typical usage within free tier limits.

## Security Best Practices

1. **Least Privilege Access**: Each component has minimal required permissions
2. **Encryption**: All data encrypted at rest and in transit
3. **Network Security**: No direct database access, all through API Gateway
4. **Authentication**: OIDC for GitHub Actions, no long-lived credentials
5. **Audit Trail**: All operations logged in DynamoDB audit table
6. **Rate Limiting**: API throttling to prevent abuse
7. **Security Headers**: CloudFront applies security headers

## Monitoring

- **CloudWatch Logs**: Lambda function logs
- **CloudWatch Metrics**: API Gateway and Lambda metrics
- **X-Ray Tracing**: Request tracing through the system
- **DynamoDB Insights**: Performance and usage metrics

## Troubleshooting

### Common Issues

1. **Terraform State Lock**: If deployment fails, you may need to force-unlock:

   ```bash
   terraform force-unlock LOCK_ID
   ```

2. **ECR Authentication**: If ECR push fails, ensure the IAM role has correct permissions

3. **Lambda Cold Starts**: Reserved concurrency is set to 100 to minimize cold starts

4. **CORS Issues**: Ensure your frontend domain is in the allowed origins list

### Getting Help

Check the logs in CloudWatch for any runtime issues:

```bash
aws logs tail /aws/lambda/number-acidizer-api-prod --follow
```

## Cleanup

To destroy all infrastructure:

```bash
cd infrastructure
terraform destroy
```

**Warning**: This will delete all data including DynamoDB tables. Make sure to backup any important data first.
