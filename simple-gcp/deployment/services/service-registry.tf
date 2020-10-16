locals {
  service_registry_api_zip_file  = "../services/service-registry/api-handler/build/dist/function.zip"
  service_registry_function_name = "${var.global_prefix}-service-registry-api"
  service_registry_api_url       = "https://${var.google_cloud_region}-${var.global_prefix}.cloudfunctions.net/${local.service_registry_function_name}"
}

resource "google_storage_bucket_object" "service_registry_api_handler_zip" {
  name   = "service-registry/api-handler/function-${filesha256(local.service_registry_api_zip_file)}.zip"
  bucket = var.functions_bucket
  source = local.service_registry_api_zip_file
}

resource "google_cloudfunctions_function" "service_registry_api_handler" {
  name    = local.service_registry_function_name
  runtime = "nodejs10"

  available_memory_mb   = 128
  source_archive_bucket = var.functions_bucket
  source_archive_object = google_storage_bucket_object.service_registry_api_handler_zip.name
  trigger_http          = true
  entry_point           = "handler"

  service_account_email = google_service_account.service_account.email

  environment_variables = {
    TableName = "service-registry"
    PublicUrl = local.service_registry_api_url
  }
}
