locals {
  ffmpeg_service_api_zip_file      = "../services/ffmpeg-service/api-handler/build/dist/function.zip"
  ffmpeg_service_worker_zip_file   = "../services/ffmpeg-service/worker/build/dist/function.zip"
  ffmpeg_service_api_function_name = "${var.global_prefix}-ffmpeg-service-api"
  ffmpeg_service_api_url           = "https://${var.google_cloud_region}-${var.global_prefix}.cloudfunctions.net/${local.ffmpeg_service_api_function_name}"
}

resource "google_pubsub_topic" "ffmpeg_service_work_topic" {
  name = "ffmpeg-service-work"
}

resource "google_storage_bucket_object" "ffmpeg_service_api_handler_zip" {
  name   = "ffmpeg-service/api-handler/function-${filesha256(local.ffmpeg_service_api_zip_file)}.zip"
  bucket = var.functions_bucket
  source = local.ffmpeg_service_api_zip_file
}

resource "google_cloudfunctions_function" "ffmpeg_service_api_handler" {
  name    = local.ffmpeg_service_api_function_name
  runtime = "nodejs10"

  available_memory_mb   = 128
  source_archive_bucket = var.functions_bucket
  source_archive_object = google_storage_bucket_object.ffmpeg_service_api_handler_zip.name
  trigger_http          = true
  entry_point           = "handler"

  service_account_email = google_service_account.service_account.email

  environment_variables = {
    TableName           = "ffmpeg-service"
    PublicUrl           = local.ffmpeg_service_api_url
    WorkerFunctionId    = google_pubsub_topic.ffmpeg_service_work_topic.name
    ServicesUrl         = "${local.service_registry_api_url}/services"
    ServicesAuthType    = "Google"
    ServicesAuthContext = "{ \"scopes\": \"${local.service_registry_api_url}\" }"
  }
}

resource "google_storage_bucket_object" "ffmpeg_service_worker_zip" {
  name   = "ffmpeg-service/api-handler/function-${filesha256(local.ffmpeg_service_worker_zip_file)}.zip"
  bucket = var.functions_bucket
  source = local.ffmpeg_service_worker_zip_file
}

resource "google_cloudfunctions_function" "ffmpeg_service_worker" {
  name    = "${var.global_prefix}-ffmpeg-service-worker"
  runtime = "nodejs10"

  available_memory_mb   = 128
  source_archive_bucket = var.functions_bucket
  source_archive_object = google_storage_bucket_object.ffmpeg_service_worker_zip.name
  entry_point           = "handler"

  event_trigger {
    event_type = "google.pubsub.topic.publish"
    resource   = google_pubsub_topic.ffmpeg_service_work_topic.id
  }

  service_account_email = google_service_account.service_account.email

  environment_variables = {
    TableName           = "ffmpeg-service"
    PublicUrl           = local.ffmpeg_service_api_url
    ServicesUrl         = "${local.service_registry_api_url}/services"
    ServicesAuthType    = "Google"
    ServicesAuthContext = "{ \"scopes\": \"${local.service_registry_api_url}\" }"
  }
}
