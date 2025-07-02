# Number Acidizer Setup Script for Windows PowerShell

Write-Host "`n🚀 Setting up Number Acidizer...`n" -ForegroundColor Green

# Check prerequisites
Write-Host "📋 Checking prerequisites..." -ForegroundColor Yellow

function Test-Command {
    param($Command)
    try {
        if (Get-Command $Command -ErrorAction Stop) {
            return $true
        }
    }
    catch {
        return $false
    }
}

$prerequisites = @(
    @{Name = "node"; DisplayName = "Node.js"; InstallUrl = "https://nodejs.org/"},
    @{Name = "npm"; DisplayName = "npm"; InstallUrl = "https://nodejs.org/"},
    @{Name = "docker"; DisplayName = "Docker"; InstallUrl = "https://www.docker.com/products/docker-desktop"},
    @{Name = "terraform"; DisplayName = "Terraform"; InstallUrl = "https://www.terraform.io/downloads"},
    @{Name = "aws"; DisplayName = "AWS CLI"; InstallUrl = "https://aws.amazon.com/cli/"}
)

$allInstalled = $true
foreach ($prereq in $prerequisites) {
    if (-not (Test-Command $prereq.Name)) {
        Write-Host "❌ $($prereq.DisplayName) is not installed. Please install it from $($prereq.InstallUrl)" -ForegroundColor Red
        $allInstalled = $false
    }
}

if (-not $allInstalled) {
    exit 1
}

Write-Host "✅ All prerequisites installed!`n" -ForegroundColor Green

# Install dependencies
Write-Host "📦 Installing dependencies..." -ForegroundColor Yellow
npm run install:all
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Failed to install dependencies" -ForegroundColor Red
    exit 1
}

# Setup AWS
Write-Host "`n🔧 Setting up AWS..." -ForegroundColor Yellow
$awsRegion = Read-Host "Enter your AWS region (default: eu-central-1)"
if ([string]::IsNullOrWhiteSpace($awsRegion)) {
    $awsRegion = "eu-central-1"
}

$tfStateBucket = Read-Host "Enter your Terraform state bucket name"
if ([string]::IsNullOrWhiteSpace($tfStateBucket)) {
    Write-Host "❌ Terraform state bucket name is required" -ForegroundColor Red
    exit 1
}

# Create terraform.tfvars
Write-Host "`n📝 Creating Terraform variables file..." -ForegroundColor Yellow
@"
aws_region = "$awsRegion"
environment = "dev"
project_name = "number-acidizer"
"@ | Set-Content -Path "infrastructure\terraform.tfvars"

# Initialize Terraform
Write-Host "`n🏗️ Initializing Terraform..." -ForegroundColor Yellow
Push-Location infrastructure
terraform init `
    -backend-config="bucket=$tfStateBucket" `
    -backend-config="key=number-acidizer/terraform.tfstate" `
    -backend-config="region=$awsRegion"
    
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Failed to initialize Terraform" -ForegroundColor Red
    Pop-Location
    exit 1
}
Pop-Location

# Create .env files
Write-Host "`n📝 Creating environment files..." -ForegroundColor Yellow
@"
REACT_APP_API_URL=http://localhost:3001
REACT_APP_WS_URL=ws://localhost:3002
"@ | Set-Content -Path "frontend\.env.local"

# Setup Git hooks
Write-Host "`n🔗 Setting up Git hooks..." -ForegroundColor Yellow
npx husky install

Write-Host "`n✨ Setup complete!" -ForegroundColor Green
Write-Host "`nNext steps:" -ForegroundColor Cyan
Write-Host "1. Run 'docker-compose up' to start local development"
Write-Host "2. Run 'npm run deploy' to deploy to AWS"
Write-Host "3. Check README.md for more information`n"
