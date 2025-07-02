# Complete Setup Guide: From Zero to Deployment

This guide takes you from having nothing to a fully deployed ACID-compliant counter application with CI/CD.

## 📋 Prerequisites

- Windows 10/11, macOS, or Linux
- Git installed
- Text editor (VS Code recommended)

## 🎯 Part 1: AWS Account Setup

### Step 1: Create AWS Account

1. Go to [aws.amazon.com](https://aws.amazon.com)
2. Click "Create an AWS Account"
3. Follow the signup process (requires credit card, but we'll stay in free tier)
4. Complete email verification and phone verification

### Step 2: Create IAM User for Yourself (Ahmed)

1. **Sign in to AWS Console**: [console.aws.amazon.com](https://console.aws.amazon.com)
2. **Navigate to IAM**: Search "IAM" in the top search bar
3. **Create User**:

   - Click "Users" in left sidebar
   - Click "Create user"
   - Username: `ahmed-admin`
   - Check "Provide user access to the AWS Management Console"
   - Choose "I want to create an IAM user"
   - Set a password (or auto-generate)
   - Click "Next"

4. **Set Permissions**:

   - Select "Attach policies directly"
   - Search and check: `AdministratorAccess`
   - Click "Next"
   - Click "Create user"

5. **Create Access Keys for CLI**:
   - Click on the user you just created (`ahmed-admin`)
   - Go to "Security credentials" tab
   - Scroll down to "Access keys"
   - Click "Create access key"
   - Choose "Command Line Interface (CLI)"
   - Check "I understand..." and click "Next"
   - Add description: "Local development"
   - Click "Create access key"
   - **IMPORTANT**: Download the CSV file or copy both keys - you won't see them again!

### Step 3: Install and Configure AWS CLI

**Windows:**

1. Download AWS CLI from [aws.amazon.com/cli](https://aws.amazon.com/cli/)
2. Run the installer

**macOS:**

```bash
brew install awscli
```

**Linux:**

```bash
curl "https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip" -o "awscliv2.zip"
unzip awscliv2.zip
sudo ./aws/install
```

**Configure AWS CLI:**

```bash
aws configure
```

Enter:

- AWS Access Key ID: (from Step 2)
- AWS Secret Access Key: (from Step 2)
- Default region: `eu-central-1`
- Default output format: `json`

**Test AWS CLI:**

```bash
aws sts get-caller-identity
```

Should show your account info.

## 🐙 Part 2: GitHub Setup

### Step 4: Create GitHub Account

1. Go to [github.com](https://github.com)
2. Sign up with your email
3. Verify your email address
4. Choose the free plan

### Step 5: Create Repository

1. **Click "New repository"** (green button on GitHub homepage)
2. **Repository details**:
   - Repository name: `number-acidizer`
   - Description: `ACID-compliant distributed counter application`
   - Set to **Public** (required for free GitHub Actions)
   - Check "Add a README file"
   - Add .gitignore: Choose "Node"
   - Choose license: "MIT License"
3. **Click "Create repository"**

### Step 6: Clone and Setup Local Repository

```bash
# Clone the repository
git clone https://github.com/YOUR_USERNAME/number-acidizer.git
cd number-acidizer

# Copy all the project files we created into this directory
# (Copy everything from your current project folder to this new folder)
```

## 🔧 Part 3: Project Configuration

### Step 7: Update Configuration Files

**Update GitHub repository name in Terraform:**
Edit `infrastructure/variables.tf`:

```hcl
variable "github_repository" {
  description = "GitHub repository in the format owner/repo"
  type        = string
  default     = "YOUR_USERNAME/number-acidizer"  # Replace YOUR_USERNAME
}
```

**Example:** If your GitHub username is `ahmed123`, set it to `"ahmed123/number-acidizer"`

### Step 8: Setup Terraform Backend

Run the setup script to create S3 bucket and DynamoDB table:

**Windows PowerShell:**

```powershell
.\scripts\setup-terraform-backend.ps1
```

**Linux/macOS:**

```bash
chmod +x scripts/setup-terraform-backend.sh
./scripts/setup-terraform-backend.sh
```

This script will:

- Create an S3 bucket for Terraform state
- Create a DynamoDB table for state locking
- Generate backend configuration
- Show you the bucket name for GitHub secrets

### Step 9: Initial Terraform Deployment

```bash
cd infrastructure
terraform init -backend-config=backend.hcl
terraform plan
terraform apply
```

Type `yes` when prompted. This will create all AWS infrastructure.

**After deployment, get the GitHub Actions role ARN:**

```bash
terraform output github_actions_role_arn
```

Copy this ARN - you'll need it for GitHub secrets.

## 🔐 Part 4: GitHub Actions Setup

### Step 10: Configure GitHub Secrets

1. **Go to your GitHub repository online**
2. **Navigate to Settings**:

   - Click "Settings" tab in your repository
   - Click "Secrets and variables" in left sidebar
   - Click "Actions"

3. **Add Repository Secrets**:
   Click "New repository secret" and add:

   **Secret 1:**

   - Name: `AWS_GITHUB_ACTIONS_ROLE_ARN`
   - Value: (paste the ARN from terraform output above)

   That's it! Only one secret needed.

### Step 11: Enable GitHub Actions

1. **Go to "Actions" tab** in your GitHub repository
2. **If prompted to enable Actions**, click "I understand my workflows, go ahead and enable them"
3. **Check workflow file**: You should see `.github/workflows/ci-cd.yml` in your repository

## 🚀 Part 5: First Deployment

### Step 12: Push Code and Deploy

```bash
# Add all files to git
git add .

# Commit changes
git commit -m "Initial commit with CI/CD pipeline

🤖 Generated with [Claude Code](https://claude.ai/code)

Co-Authored-By: Claude <noreply@anthropic.com>"

# Push to main branch (this triggers deployment)
git push origin main
```

### Step 13: Monitor Deployment

1. **Go to "Actions" tab** in your GitHub repository
2. **Click on the running workflow** to see progress
3. **Watch the logs** as it:
   - Runs tests
   - Creates AWS infrastructure
   - Deploys the application

## 🎉 Part 6: Verify Deployment

### Step 14: Get Your Application URLs

After deployment completes, get the URLs:

```bash
cd infrastructure
terraform output frontend_url    # Your app's URL
terraform output api_url         # Your API URL
terraform output websocket_url   # WebSocket URL
```

### Step 15: Test Your Application

1. **Open the frontend URL** in your browser
2. **Test the counter**: Click increment/decrement buttons
3. **Test real-time sync**: Open in multiple browser tabs
4. **Run ACID tests**:
   ```bash
   cd tests
   npm install
   API_URL=<your-api-url> npm test
   ```

## 🔍 Part 7: Understanding What You Built

### AWS Resources Created:

- **S3 Buckets**: Frontend hosting + Terraform state
- **CloudFront**: Global CDN for fast access
- **API Gateway**: HTTP and WebSocket APIs
- **Lambda Functions**: Serverless backend logic
- **DynamoDB Tables**: ACID-compliant database
- **IAM Roles**: Security with least privilege
- **ECR Repository**: Docker image storage

### GitHub Actions Workflow:

- **Trigger**: Every push to main branch
- **Steps**: Test → Build → Deploy → Verify
- **Security**: OIDC authentication (no long-lived keys)

### Cost Estimate:

- **Free Tier Usage**: $0/month for typical usage
- **Beyond Free Tier**: $1-5/month maximum

## 🛠️ Part 8: Development Workflow

### Making Changes:

1. **Edit code locally**
2. **Test locally**: `npm run test`
3. **Commit and push**:
   ```bash
   git add .
   git commit -m "Your changes"
   git push origin main
   ```
4. **Automatic deployment** happens via GitHub Actions

### Local Development:

```bash
# Start local development
docker-compose up

# Or run separately:
cd backend && npm run dev    # Backend on port 3001
cd frontend && npm start     # Frontend on port 3000
```

## 🚨 Troubleshooting

### Common Issues:

**1. AWS CLI not configured:**

```bash
aws configure
# Re-enter your access keys
```

**2. GitHub Actions failing:**

- Check repository is public
- Verify AWS_GITHUB_ACTIONS_ROLE_ARN secret is correct
- Check Actions tab for detailed error logs

**3. Terraform backend issues:**

```bash
cd infrastructure
terraform init -reconfigure -backend-config=backend.hcl
```

**4. Permission denied errors:**

- Ensure your AWS user has AdministratorAccess
- Check IAM policies in AWS console

### Getting Help:

- **AWS Console**: Check CloudWatch logs for runtime errors
- **GitHub Actions**: Check Actions tab for deployment logs
- **Terraform**: Run `terraform plan` to see what will change

## 🎯 Next Steps

### Customization Ideas:

- Add user authentication
- Implement rate limiting per user
- Add monitoring dashboards
- Create custom domain with Route 53
- Add email notifications for errors

### Security Enhancements:

- Enable AWS CloudTrail for audit logs
- Set up AWS Config for compliance
- Add WAF rules for DDoS protection
- Implement API key authentication

### Scaling:

- Add multiple regions
- Implement auto-scaling
- Add Redis for caching
- Set up load testing

---

## 📞 Support

If you encounter issues:

1. Check the troubleshooting section above
2. Look at AWS CloudWatch logs
3. Review GitHub Actions logs
4. Verify all configuration values

**Congratulations! You now have a production-ready, ACID-compliant, serverless application with full CI/CD! 🎉**
