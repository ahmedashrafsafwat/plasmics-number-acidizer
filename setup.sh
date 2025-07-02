#!/bin/bash

# Number Acidizer Setup Script

echo "🚀 Setting up Number Acidizer..."

# Check prerequisites
check_command() {
    if ! command -v $1 &> /dev/null; then
        echo "❌ $1 is not installed. Please install it first."
        exit 1
    fi
}

echo "📋 Checking prerequisites..."
check_command node
check_command npm
check_command docker
check_command terraform
check_command aws

echo "✅ All prerequisites installed!"

# Install dependencies
echo "📦 Installing dependencies..."
npm run install:all

# Setup AWS
echo "🔧 Setting up AWS..."
read -p "Enter your AWS region (default: eu-central-1): " AWS_REGION
AWS_REGION=${AWS_REGION:-eu-central-1}

read -p "Enter your Terraform state bucket name: " TF_STATE_BUCKET

# Create terraform.tfvars
cat > infrastructure/terraform.tfvars <<EOF
aws_region = "$AWS_REGION"
environment = "dev"
project_name = "number-acidizer"
EOF

# Initialize Terraform
echo "🏗️ Initializing Terraform..."
cd infrastructure
terraform init \
  -backend-config="bucket=$TF_STATE_BUCKET" \
  -backend-config="key=number-acidizer/terraform.tfstate" \
  -backend-config="region=$AWS_REGION"

cd ..

# Create .env files
echo "📝 Creating environment files..."
cat > frontend/.env.local <<EOF
REACT_APP_API_URL=http://localhost:3001
REACT_APP_WS_URL=ws://localhost:3002
EOF

# Setup Git hooks
echo "🔗 Setting up Git hooks..."
npx husky install

echo "✨ Setup complete!"
echo ""
echo "Next steps:"
echo "1. Run 'docker-compose up' to start local development"
echo "2. Run 'npm run deploy' to deploy to AWS"
echo "3. Check README.md for more information"
