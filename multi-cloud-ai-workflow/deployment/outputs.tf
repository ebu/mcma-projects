output "aws_region" {
  value = var.aws_region
}

output "cognito_user_pool_id" {
  value = module.cognito.user_pool_id
}

output "cognito_user_pool_client_id" {
  value = module.cognito.user_pool_client_id
}

output "cognito_identity_pool_id" {
  value = module.cognito.identity_pool_id
}

output "temp_bucket" {
  value = module.storage.temp_bucket.id
}

output "upload_bucket" {
  value = module.storage.upload_bucket.id
}

output "repository_bucket" {
  value = module.storage.repository_bucket.id
}

output "website_bucket" {
  value = module.storage.website_bucket.id
}

output "website_url" {
  value = module.storage.website_url
}

output "service_registry" {
  value = module.service_registry
}

output "job_processor" {
  value = module.job_processor
}

output "media_repository_url" {
  value = module.services.media_repository_url
}

output "ame_service_url" {
  value = module.services.ame_service_url
}

output "workflow_service_url" {
  value = module.services.workflow_service_url
}

output "workflow_service_notification_url" {
  value = module.workflows.workflow_service_notification_url
}

output "transform_service_url" {
  value = module.services.transform_service_url
}

output "aws_ai_service_url" {
  value = module.services.aws_ai_service_url
}

output "azure_ai_service_url" {
  value = module.services.azure_ai_service_url
}

output "google_ai_service_url" {
  value = module.services.google_ai_service_url
}

output "benchmarkstt_service_url" {
  value = module.services.benchmarkstt_service_url
}
