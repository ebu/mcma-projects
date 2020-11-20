provider random {}

provider google {
  version     = "3.42.0"
  credentials = file("../google-cloud-credentials.json")
  project     = var.google_cloud_project
  region      = var.google_cloud_region

  request_timeout = "5m"
}

module setup {
  source = "./setup"

  google_cloud_region  = var.google_cloud_region
  google_cloud_project = var.google_cloud_project
}

module storage {
  source     = "./storage"
  depends_on = [module.setup]

  environment_name = var.environment_name
  environment_type = var.environment_type
  google_cloud_region       = var.google_cloud_region

}

module services {
  source     = "./services"
  depends_on = [module.setup]

  environment_name     = var.environment_name
  environment_type     = var.environment_type
  global_prefix        = var.global_prefix
  google_cloud_project          = var.google_cloud_project
  google_cloud_region           = var.google_cloud_region
  functions_bucket     = module.storage.functions_bucket

}
