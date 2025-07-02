@echo off
REM Number Acidizer Setup Script for Windows

echo.
echo 🚀 Setting up Number Acidizer...
echo.

REM Check prerequisites
echo 📋 Checking prerequisites...

where node >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ Node.js is not installed. Please install it from https://nodejs.org/
    exit /b 1
)

where npm >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ npm is not installed. Please install Node.js from https://nodejs.org/
    exit /b 1
)

where docker >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ Docker is not installed. Please install Docker Desktop from https://www.docker.com/products/docker-desktop
    exit /b 1
)

where terraform >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ Terraform is not installed. Please install it from https://www.terraform.io/downloads
    exit /b 1
)

where aws >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ AWS CLI is not installed. Please install it from https://aws.amazon.com/cli/
    exit /b 1
)

echo ✅ All prerequisites installed!
echo.

REM Install dependencies
echo 📦 Installing dependencies...
call npm run install:all
if %errorlevel% neq 0 (
    echo ❌ Failed to install dependencies
    exit /b 1
)

REM Setup AWS
echo.
echo 🔧 Setting up AWS...
set /p AWS_REGION="Enter your AWS region (default: eu-central-1): "
if "%AWS_REGION%"=="" set AWS_REGION=eu-central-1

set /p TF_STATE_BUCKET="Enter your Terraform state bucket name: "
if "%TF_STATE_BUCKET%"=="" (
    echo ❌ Terraform state bucket name is required
    exit /b 1
)

REM Create terraform.tfvars
echo.
echo 📝 Creating Terraform variables file...
(
echo aws_region = "%AWS_REGION%"
echo environment = "dev"
echo project_name = "number-acidizer"
) > infrastructure\terraform.tfvars

REM Initialize Terraform
echo.
echo 🏗️ Initializing Terraform...
cd infrastructure
call terraform init -backend-config="bucket=%TF_STATE_BUCKET%" -backend-config="key=number-acidizer/terraform.tfstate" -backend-config="region=%AWS_REGION%"
if %errorlevel% neq 0 (
    echo ❌ Failed to initialize Terraform
    cd ..
    exit /b 1
)
cd ..

REM Create .env files
echo.
echo 📝 Creating environment files...
(
echo REACT_APP_API_URL=http://localhost:3001
echo REACT_APP_WS_URL=ws://localhost:3002
) > frontend\.env.local

REM Setup Git hooks
echo.
echo 🔗 Setting up Git hooks...
call npx husky install

echo.
echo ✨ Setup complete!
echo.
echo Next steps:
echo 1. Run 'docker-compose up' to start local development
echo 2. Run 'npm run deploy' to deploy to AWS
echo 3. Check README.md for more information
echo.
pause
