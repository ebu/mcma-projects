output aws_region {
  value = var.aws_region
}

output service_registry_url {
  value = module.services.service_registry_url
}

output service_registry_auth_type {
  value = module.services.service_registry_auth_type
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
  value = module.storage.upload_bucket.id
}

output output_bucket {
  value = module.storage.output_bucket.id
}
