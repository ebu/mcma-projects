resource "google_service_account" "service_account" {
  account_id   = "${var.global_prefix}-svc"
  display_name = "MCMA Service Account"
  description  = "Service account under which the MCMA services run"
}

resource "google_project_iam_member" "service_account_log_writer_role_member" {
  member = "serviceAccount:${google_service_account.service_account.email}"
  role   = "roles/logging.logWriter"
}

resource "google_project_iam_member" "service_account_task_runner_role_member" {
  member = "serviceAccount:${google_service_account.service_account.email}"
  role   = "roles/cloudtasks.taskRunner"
}

resource "google_project_iam_member" "service_account_storage_object_creator_role_member" {
  member = "serviceAccount:${google_service_account.service_account.email}"
  role   = "roles/storage.objectCreator"
}

resource "google_project_iam_member" "service_account_storage_object_reader_role_member" {
  member = "serviceAccount:${google_service_account.service_account.email}"
  role   = "roles/storage.objectViewer"
}

resource "google_project_iam_member" "service_account_datastore_user_role_member" {
  member = "serviceAccount:${google_service_account.service_account.email}"
  role   = "roles/datastore.user"
}

resource "google_project_iam_member" "service_account_pubsub_publisher" {
  member = "serviceAccount:${google_service_account.service_account.email}"
  role   = "roles/pubsub.publisher"
}

resource "google_project_iam_member" "service_account_pubsub_subscriber" {
  member = "serviceAccount:${google_service_account.service_account.email}"
  role   = "roles/pubsub.subscriber"
}

resource "google_project_iam_member" "service_account_cloudfunctions_invoker" {
  member = "serviceAccount:${google_service_account.service_account.email}"
  role   = "roles/cloudfunctions.invoker"
}

resource "google_project_iam_member" "service_account_cloudscheduler_admin" {
  member = "serviceAccount:${google_service_account.service_account.email}"
  role   = "roles/cloudscheduler.admin"
}
