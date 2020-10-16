locals {
  functions_bucket_name = "${var.environment_name}-${var.environment_type}-${var.google_cloud_region}-functions"
  upload_bucket_name    = "${var.environment_name}-${var.environment_type}-${var.google_cloud_region}-upload"
  output_bucket_name    = "${var.environment_name}-${var.environment_type}-${var.google_cloud_region}-output"
}

resource "google_storage_bucket" "functions" {
  name          = local.functions_bucket_name
  force_destroy = true
}

resource "google_storage_bucket" "upload" {
  name          = local.upload_bucket_name
  location      = var.google_cloud_region
  force_destroy = true

  cors {
    origin          = ["*"]
    method          = ["GET", "PUT", "POST", "DELETE"]
    response_header = ["ETag"]
    max_age_seconds = 3000
  }

  lifecycle_rule {
    condition {
      age = 7
    }
    action {
      type = "Delete"
    }
  }
}

resource "google_storage_bucket_access_control" "upload_access" {
  bucket = google_storage_bucket.upload.name
  role   = "WRITER"
  entity = "allAuthenticatedUsers"
}

resource "google_storage_bucket" "output" {
  name          = local.output_bucket_name
  location      = var.google_cloud_region
  force_destroy = true

  cors {
    origin          = ["*"]
    method          = ["GET"]
    response_header = ["ETag"]
    max_age_seconds = 3000
  }

  lifecycle_rule {
    condition {
      age = 7
    }
    action {
      type = "Delete"
    }
  }
}

resource "google_storage_bucket_access_control" "output_access" {
  bucket = google_storage_bucket.output.name
  role   = "READER"
  entity = "allAuthenticatedUsers"
}
