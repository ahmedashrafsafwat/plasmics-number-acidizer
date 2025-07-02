variable "project_name" {
  description = "Name of the project"
  type        = string
  default     = "number-acidizer"
}

variable "environment" {
  description = "Environment name"
  type        = string
  default     = "dev"
}

variable "aws_region" {
  description = "AWS region"
  type        = string
  default     = "eu-central-1"
}

variable "allowed_origins" {
  description = "Allowed CORS origins"
  type        = list(string)
  default     = ["*"]
}

variable "common_tags" {
  description = "Common tags to apply to all resources"
  type        = map(string)
  default = {
    Project     = "NumberAcidizer"
    ManagedBy   = "Terraform"
    Environment = "dev"
  }
}

variable "github_repository" {
  description = "GitHub repository in the format owner/repo"
  type        = string
  default     = "your-username/number-acidizer"
}

variable "terraform_state_bucket" {
  description = "S3 bucket for Terraform state"
  type        = string
  default     = ""
}
