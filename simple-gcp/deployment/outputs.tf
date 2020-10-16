output service_registry_url {
  value = module.services.service_registry_url
}

output job_processor_url {
  value = module.services.job_processor_url
}

output mediainfo_service_url {
  value = module.services.mediainfo_service_url
}

output ffmpeg_service_url {
  value = module.services.ffmpeg_service_url
}

output upload_bucket {
  value = module.storage.upload_bucket
}

output output_bucket {
  value = module.storage.output_bucket
}
