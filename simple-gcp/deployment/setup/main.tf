resource "google_project_service" "cloud_resource_manager" {
  service = "cloudresourcemanager.googleapis.com"
}

resource "google_project_service" "iam" {
  service    = "iam.googleapis.com"
  depends_on = [google_project_service.cloud_resource_manager]
}

resource "google_project_service" "cloud_functions" {
  service    = "cloudfunctions.googleapis.com"
  depends_on = [google_project_service.cloud_resource_manager]
}

resource "google_project_service" "cloud_build" {
  service    = "cloudbuild.googleapis.com"
  depends_on = [google_project_service.cloud_resource_manager]
}

resource "google_project_service" "cloud_pubsub" {
  service    = "pubsub.googleapis.com"
  depends_on = [google_project_service.cloud_resource_manager]
}

resource "google_project_service" "firestore" {
  service       = "firestore.googleapis.com"
  depends_on = [google_project_service.cloud_resource_manager]
}

resource "google_project_service" "cloud_scheduler" {
  service       = "cloudscheduler.googleapis.com"
  depends_on = [google_project_service.cloud_resource_manager]
}
