# GitHub OIDC Provider for GitHub Actions
resource "aws_iam_openid_connect_provider" "github" {
  url = "https://token.actions.githubusercontent.com"

  client_id_list = [
    "sts.amazonaws.com",
  ]

  thumbprint_list = [
    "6938fd4d98bab03faadb97b34396831e3780aea1",
    "1c58a3a8518e8759bf075b76b750d4f2df264fcd"
  ]

  tags = merge(var.common_tags, {
    Name = "GitHub Actions OIDC Provider"
  })
}

# Update the GitHub Actions role to use the OIDC provider
resource "aws_iam_role" "github_actions_oidc" {
  name = "${var.project_name}-github-actions-oidc-${var.environment}"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Principal = {
          Federated = aws_iam_openid_connect_provider.github.arn
        }
        Action = "sts:AssumeRoleWithWebIdentity"
        Condition = {
          StringEquals = {
            "token.actions.githubusercontent.com:aud" = "sts.amazonaws.com"
          }
          StringLike = {
            "token.actions.githubusercontent.com:sub" = "repo:${var.github_repository}:*"
          }
        }
      }
    ]
  })

  tags = merge(var.common_tags, {
    Name = "GitHub Actions OIDC Role"
  })
}

resource "aws_iam_role_policy_attachment" "github_actions_oidc" {
  policy_arn = aws_iam_policy.github_actions.arn
  role       = aws_iam_role.github_actions_oidc.name
}