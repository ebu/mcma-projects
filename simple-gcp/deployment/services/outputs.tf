output service_registry_url {
  value = google_cloudfunctions_function.service_registry_api_handler.https_trigger_url
}

output job_processor_url {
  value = google_cloudfunctions_function.job_processor_api_handler.https_trigger_url
}

output mediainfo_service_url {
  value = google_cloudfunctions_function.mediainfo_service_api_handler.https_trigger_url
}

output ffmpeg_service_url {
  value = google_cloudfunctions_function.ffmpeg_service_api_handler.https_trigger_url
}