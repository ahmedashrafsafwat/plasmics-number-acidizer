# Windows Setup Guide for Number Acidizer

This guide will help you set up the Number Acidizer project on Windows.

## Prerequisites

1. **Install Required Software:**

   - [Node.js 18+](https://nodejs.org/) - Download the Windows installer
   - [Docker Desktop](https://www.docker.com/products/docker-desktop/) - Enable WSL2 backend
   - [AWS CLI](https://aws.amazon.com/cli/) - Use the MSI installer
   - [Terraform](https://www.terraform.io/downloads) - Download the Windows binary
   - [Git for Windows](https://gitforwindows.org/)

2. **Install Optional Tools (Recommended):**
   - [Windows Terminal](https://aka.ms/terminal) - Better terminal experience
   - [Visual Studio Code](https://code.visualstudio.com/) - IDE with good TypeScript support

## Setup Instructions

### Option 1: Using PowerShell (Recommended)

1. **Open PowerShell as Administrator**

   - Right-click on PowerShell and select "Run as Administrator"

2. **Clone the repository**

   ```powershell
   git clone https://github.com/yourusername/number-acidizer.git
   cd number-acidizer
   ```

3. **Allow script execution (if needed)**

   ```powershell
   Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
   ```

4. **Run the setup script**
   ```powershell
   .\setup.ps1
   ```

### Option 2: Using Command Prompt

1. **Open Command Prompt**

   ```cmd
   cd C:\your\project\directory
   git clone https://github.com/yourusername/number-acidizer.git
   cd number-acidizer
   ```

2. **Run the setup script**
   ```cmd
   setup.bat
   ```

### Option 3: Manual Setup

If the scripts don't work, you can set up manually:

1. **Install dependencies**

   ```cmd
   npm install
   cd backend && npm install
   cd ../frontend && npm install
   cd ..
   ```

2. **Create environment files**

   Create `frontend\.env.local`:

   ```
   REACT_APP_API_URL=http://localhost:3001
   REACT_APP_WS_URL=ws://localhost:3002
   ```

3. **Configure AWS**

   ```cmd
   aws configure
   ```

   Enter your AWS credentials when prompted.

4. **Create Terraform variables**

   Create `infrastructure\terraform.tfvars`:

   ```hcl
   aws_region = "eu-central-1"
   environment = "dev"
   project_name = "number-acidizer"
   ```

## Running the Application

### Local Development with Docker

1. **Start Docker Desktop**
   Make sure Docker Desktop is running (check system tray)

2. **Run the application**

   ```cmd
   docker-compose up
   ```

3. **Access the application**
   - Frontend: http://localhost:3000
   - Backend API: http://localhost:3001
   - DynamoDB Admin: http://localhost:8001

### Without Docker

1. **Terminal 1 - Backend**

   ```cmd
   cd backend
   npm run watch
   ```

2. **Terminal 2 - Frontend**
   ```cmd
   cd frontend
   npm start
   ```

## Deployment to AWS

1. **Create S3 bucket for Terraform state**

   ```powershell
   aws s3 mb s3://your-terraform-state-bucket --region eu-central-1
   ```

2. **Deploy infrastructure**

   ```powershell
   cd infrastructure
   terraform init -backend-config="bucket=your-terraform-state-bucket"
   terraform plan
   terraform apply
   ```

3. **Build and push Docker image**

   ```powershell
   # Get ECR login token
   aws ecr get-login-password --region eu-central-1 | docker login --username AWS --password-stdin [your-account-id].dkr.ecr.eu-central-1.amazonaws.com

   # Build and push
   cd backend
   docker build -t number-acidizer-backend .
   docker tag number-acidizer-backend:latest [your-ecr-repo-url]:latest
   docker push [your-ecr-repo-url]:latest
   ```

4. **Deploy frontend**
   ```powershell
   cd frontend
   npm run build
   aws s3 sync build\ s3://[your-s3-bucket-name] --delete
   aws cloudfront create-invalidation --distribution-id [your-distribution-id] --paths "/*"
   ```

## Common Windows Issues

### Issue: "execution of scripts is disabled"

```powershell
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
```

### Issue: "npm command not found"

- Make sure Node.js is installed
- Restart your terminal after installation
- Check if npm is in your PATH: `echo %PATH%`

### Issue: Docker commands fail

- Make sure Docker Desktop is running
- Check if you're in the Linux containers mode (not Windows containers)
- Restart Docker Desktop if needed

### Issue: AWS CLI not working

- Make sure AWS CLI is installed
- Run `aws --version` to verify
- Configure credentials: `aws configure`

### Issue: Line ending problems (CRLF vs LF)

```cmd
git config --global core.autocrlf true
```

## Tips for Windows Development

1. **Use WSL2 for better compatibility**

   - Install WSL2: `wsl --install`
   - Use Ubuntu or another Linux distribution
   - Run the project inside WSL2 for better performance

2. **Environment Variables**

   - Use `.env.local` files for development
   - Never commit `.env` files with secrets
   - Use AWS Systems Manager for production secrets

3. **Path Issues**

   - Use forward slashes `/` in config files
   - Use `path.join()` in Node.js code
   - Be careful with case sensitivity

4. **Terminal Tips**
   - Use Windows Terminal for better experience
   - PowerShell Core (7+) has better Unix compatibility
   - Git Bash provides Unix-like commands

## Getting Help

- Check the [main README](README.md) for general information
- Open an issue on GitHub for bugs
- Check AWS documentation for service-specific questions
