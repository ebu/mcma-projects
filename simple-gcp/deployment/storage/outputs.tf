output functions_bucket {
  value = google_storage_bucket.functions.name
}

output upload_bucket {
  value = google_storage_bucket.upload.name
}

output output_bucket {
  value = google_storage_bucket.output.name
}
