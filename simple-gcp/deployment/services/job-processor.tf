locals {
  job_processor_api_zip_file      = "../services/job-processor/api-handler/build/dist/function.zip"
  job_processor_api_function_name = "${var.global_prefix}-job-processor-api"
  job_processor_api_url           = "https://${var.google_cloud_region}-${var.global_prefix}.cloudfunctions.net/${local.job_processor_api_function_name}"

  job_processor_periodic_job_checker_zip_file      = "../services/job-processor/periodic-job-checker/build/dist/function.zip"
  job_processor_periodic_job_checker_function_name = "${var.global_prefix}-job-processor-periodic-job-checker"
  job_processor_periodic_job_checker_url           = "https://${var.google_cloud_region}-${var.global_prefix}.cloudfunctions.net/${local.job_processor_periodic_job_checker_function_name}"

  job_processor_periodic_job_cleanup_zip_file      = "../services/job-processor/periodic-job-cleanup/build/dist/function.zip"
  job_processor_periodic_job_cleanup_function_name = "${var.global_prefix}-job-processor-periodic-job-cleanup"
  job_processor_periodic_job_cleanup_url           = "https://${var.google_cloud_region}-${var.global_prefix}.cloudfunctions.net/${local.job_processor_periodic_job_cleanup_function_name}"

  job_processor_worker_zip_file   = "../services/job-processor/worker/build/dist/function.zip"
}

resource "google_pubsub_topic" "job_processor_work_topic" {
  name = "job-processor-work"
}

resource "google_storage_bucket_object" "job_processor_api_handler_zip" {
  name   = "job-processor/api-handler/function-${filesha256(local.job_processor_api_zip_file)}.zip"
  bucket = var.functions_bucket
  source = local.job_processor_api_zip_file
}

resource "google_cloudfunctions_function" "job_processor_api_handler" {
  name    = local.job_processor_api_function_name
  runtime = "nodejs10"

  available_memory_mb   = 128
  source_archive_bucket = var.functions_bucket
  source_archive_object = google_storage_bucket_object.job_processor_api_handler_zip.name
  trigger_http          = true
  entry_point           = "handler"

  service_account_email = google_service_account.service_account.email

  environment_variables = {
    TableName           = "job-processor"
    PublicUrl           = local.job_processor_api_url
    WorkerFunctionId    = google_pubsub_topic.job_processor_work_topic.name
    ServicesUrl         = "${local.service_registry_api_url}/services"
    ServicesAuthType    = "Google"
    ServicesAuthContext = "{ \"scopes\": \"${local.service_registry_api_url}\" }"
  }
}

resource "google_cloud_scheduler_job" "job_processor_periodic_job_checker_cron" {
  name      = "${var.global_prefix}-job-checker"
  region    = var.google_cloud_region
  schedule  = "* * * * *"
  time_zone = "Etc/UTC"

  http_target {
    uri         = local.job_processor_periodic_job_checker_url
    http_method = "POST"
    body        = base64encode("{}")

    oidc_token {
      service_account_email = google_service_account.service_account.email
    }
  }
}

resource "google_storage_bucket_object" "job_processor_periodic_job_checker_zip" {
  name   = "job-processor/periodic-job-checker/function-${filesha256(local.job_processor_periodic_job_checker_zip_file)}.zip"
  bucket = var.functions_bucket
  source = local.job_processor_periodic_job_checker_zip_file
}

resource "google_cloudfunctions_function" "job_processor_periodic_job_checker" {
  name    = local.job_processor_periodic_job_checker_function_name
  runtime = "nodejs10"

  available_memory_mb   = 128
  source_archive_bucket = var.functions_bucket
  source_archive_object = google_storage_bucket_object.job_processor_periodic_job_checker_zip.name
  trigger_http          = true
  entry_point           = "handler"

  service_account_email = google_service_account.service_account.email

  environment_variables = {
    TableName                  = "job-processor"
    PublicUrl                  = local.job_processor_periodic_job_checker_url
    WorkerFunctionId           = google_pubsub_topic.job_processor_work_topic.name
    ServicesUrl                = "${local.service_registry_api_url}/services"
    ServicesAuthType           = "Google"
    ServicesAuthContext        = "{ \"scopes\": \"${local.service_registry_api_url}\" }"
    CloudSchedulerJobName      = google_cloud_scheduler_job.job_processor_periodic_job_checker_cron.id
    DefaultJobTimeoutInMinutes = var.job_processor_default_job_timeout_in_minutes
  }
}

resource "google_cloud_scheduler_job" "job_processor_periodic_job_cleanup_cron" {
  name      = "${var.global_prefix}-job-cleanup"
  region    = var.google_cloud_region
  schedule  = "0 0 * * *"
  time_zone = "Etc/UTC"


  http_target {
    uri         = local.job_processor_periodic_job_cleanup_url
    http_method = "POST"
    body        = base64encode("{}")

    oidc_token {
      service_account_email = google_service_account.service_account.email
    }
  }
}

resource "google_storage_bucket_object" "job_processor_periodic_job_cleanup_zip" {
  name   = "job-processor/periodic-job-cleanup/function-${filesha256(local.job_processor_periodic_job_cleanup_zip_file)}.zip"
  bucket = var.functions_bucket
  source = local.job_processor_periodic_job_cleanup_zip_file
}

resource "google_cloudfunctions_function" "job_processor_periodic_job_cleanup" {
  name    = local.job_processor_periodic_job_cleanup_function_name
  runtime = "nodejs10"

  available_memory_mb   = 128
  source_archive_bucket = var.functions_bucket
  source_archive_object = google_storage_bucket_object.job_processor_periodic_job_cleanup_zip.name
  trigger_http          = true
  entry_point           = "handler"

  service_account_email = google_service_account.service_account.email

  environment_variables = {
    TableName                = "job-processor"
    PublicUrl                = local.job_processor_periodic_job_cleanup_url
    WorkerFunctionId         = google_pubsub_topic.job_processor_work_topic.name
    ServicesUrl              = "${local.service_registry_api_url}/services"
    ServicesAuthType         = "Google"
    ServicesAuthContext      = "{ \"scopes\": \"${local.service_registry_api_url}\" }"
    JobRetentionPeriodInDays = var.job_processor_job_retention_period_in_days
  }
}

resource "google_storage_bucket_object" "job_processor_worker_zip" {
  name   = "job-processor/api-handler/function-${filesha256(local.job_processor_worker_zip_file)}.zip"
  bucket = var.functions_bucket
  source = local.job_processor_worker_zip_file
}

resource "google_cloudfunctions_function" "job_processor_worker" {
  name    = "${var.global_prefix}-job-processor-worker"
  runtime = "nodejs10"

  available_memory_mb   = 128
  source_archive_bucket = var.functions_bucket
  source_archive_object = google_storage_bucket_object.job_processor_worker_zip.name
  entry_point           = "handler"

  event_trigger {
    event_type = "google.pubsub.topic.publish"
    resource   = google_pubsub_topic.job_processor_work_topic.id
  }

  service_account_email = google_service_account.service_account.email

  environment_variables = {
    TableName                = "job-processor"
    PublicUrl                = local.job_processor_api_url
    ServicesUrl              = "${local.service_registry_api_url}/services"
    ServicesAuthType         = "Google"
    ServicesAuthContext      = "{ \"scopes\": \"${local.service_registry_api_url}\" }"
    CloudSchedulerJobName    = google_cloud_scheduler_job.job_processor_periodic_job_checker_cron.id
  }
}

resource "google_firestore_index" "job_status_and_date_index" {
  collection = "jobs"

  fields {
    field_path = "status"
    order      = "ASCENDING"
  }

  fields {
    field_path = "dateCreated"
    order      = "ASCENDING"
  }

  fields {
    field_path = "__name__"
    order      = "ASCENDING"
  }
}

resource "google_firestore_index" "job_execution_status_and_date_index" {
  collection = "executions"

  fields {
    field_path = "status"
    order      = "ASCENDING"
  }

  fields {
    field_path = "dateCreated"
    order      = "ASCENDING"
  }

  fields {
    field_path = "__name__"
    order      = "ASCENDING"
  }
}