locals {
  mediainfo_service_api_zip_file      = "./../services/mediainfo-service/api-handler/build/dist/function.zip"
  mediainfo_service_worker_zip_file   = "./../services/mediainfo-service/worker/build/dist/function.zip"
  mediainfo_service_api_function_name = "${var.global_prefix}-mediainfo-service-api"
  mediainfo_service_url               = "https://${local.mediainfo_service_api_function_name}.azurewebsites.net"
}

resource "azurerm_cosmosdb_sql_container" "mediainfo_service_cosmosdb_container" {
  name                = "MediaInfoService"
  resource_group_name = var.resource_group_name
  account_name        = var.cosmosdb_account_name
  database_name       = var.cosmosdb_db_name
  partition_key_path  = "/partitionKey"
}

#===================================================================
# Worker Function
#===================================================================

resource "azurerm_storage_queue" "mediainfo_service_worker_function_queue" {
  name                 = "mediainfo-service-work-queue"
  storage_account_name = var.app_storage_account_name
}

resource "azurerm_storage_blob" "mediainfo_service_worker_function_zip" {
  name                   = "mediainfo-service/worker/function_${filesha256(local.mediainfo_service_worker_zip_file)}.zip"
  storage_account_name   = var.app_storage_account_name
  storage_container_name = var.deploy_container
  type                   = "Block"
  source                 = local.mediainfo_service_worker_zip_file
}

resource "azurerm_function_app" "mediainfo_service_worker_function" {
  name                       = "${var.global_prefix}-mediainfo-service-worker"
  location                   = var.azure_location
  resource_group_name        = var.resource_group_name
  app_service_plan_id        = azurerm_app_service_plan.mcma_services.id
  storage_account_name       = var.app_storage_account_name
  storage_account_access_key = var.app_storage_access_key
  version                    = "~2"

  identity {
    type = "SystemAssigned"
  }

  app_settings = {
    FUNCTIONS_WORKER_RUNTIME       = "node"
    FUNCTION_APP_EDIT_MODE         = "readonly"
    https_only                     = true
    HASH                           = filesha256(local.mediainfo_service_worker_zip_file)
    WEBSITE_RUN_FROM_PACKAGE       = "${local.deploy_container_url}/${azurerm_storage_blob.mediainfo_service_worker_function_zip.name}${var.app_storage_sas}"
    WEBSITE_NODE_DEFAULT_VERSION   = var.nodejs_version
    APPINSIGHTS_INSTRUMENTATIONKEY = azurerm_application_insights.services_appinsights.instrumentation_key

    WorkQueueStorage             = var.app_storage_connection_string
    TableName                    = azurerm_cosmosdb_sql_container.mediainfo_service_cosmosdb_container.name
    PublicUrl                    = local.mediainfo_service_url
    CosmosDbEndpoint             = var.cosmosdb_endpoint
    CosmosDbKey                  = var.cosmosdb_key
    CosmosDbDatabaseId           = local.cosmosdb_id
    CosmosDbRegion               = var.azure_location
    ServicesUrl                  = local.services_url
    ServicesAuthType             = "AzureAD"
    ServicesAuthContext          = "{ \"scope\": \"${local.service_registry_url}/.default\" }"
    MediaStorageAccountName      = var.media_storage_account_name
    MediaStorageConnectionString = var.media_storage_connection_string
  }

  provisioner "local-exec" {
    command = "az webapp start --resource-group ${var.resource_group_name} --name ${azurerm_function_app.mediainfo_service_worker_function.name}"
  }
}

#===================================================================
# API Function
#===================================================================

resource "azuread_application" "mediainfo_service_app" {
  name            = local.mediainfo_service_api_function_name
  identifier_uris = [local.mediainfo_service_url]
}

resource "azuread_service_principal" "mediainfo_service_sp" {
  application_id               = azuread_application.mediainfo_service_app.application_id
  app_role_assignment_required = false
}

resource "azurerm_storage_blob" "mediainfo_service_api_function_zip" {
  name                   = "mediainfo-service/api/function_${filesha256(local.mediainfo_service_api_zip_file)}.zip"
  storage_account_name   = var.app_storage_account_name
  storage_container_name = var.deploy_container
  type                   = "Block"
  source                 = local.mediainfo_service_api_zip_file
}

resource "azurerm_function_app" "mediainfo_service_api_function" {
  name                       = local.mediainfo_service_api_function_name
  location                   = var.azure_location
  resource_group_name        = var.resource_group_name
  app_service_plan_id        = azurerm_app_service_plan.mcma_services.id
  storage_account_name       = var.app_storage_account_name
  storage_account_access_key = var.app_storage_access_key
  version                    = "~2"

  auth_settings {
    enabled                       = true
    issuer                        = "https://sts.windows.net/${var.azure_tenant_id}"
    default_provider              = "AzureActiveDirectory"
    unauthenticated_client_action = "RedirectToLoginPage"
    active_directory {
      client_id         = azuread_application.mediainfo_service_app.application_id
      allowed_audiences = [local.mediainfo_service_url]
    }
  }

  app_settings = {
    FUNCTIONS_WORKER_RUNTIME       = "node"
    FUNCTION_APP_EDIT_MODE         = "readonly"
    https_only                     = true
    HASH                           = filesha256(local.mediainfo_service_api_zip_file)
    WEBSITE_RUN_FROM_PACKAGE       = "${local.deploy_container_url}/${azurerm_storage_blob.mediainfo_service_api_function_zip.name}${var.app_storage_sas}"
    WEBSITE_NODE_DEFAULT_VERSION   = var.nodejs_version
    APPINSIGHTS_INSTRUMENTATIONKEY = azurerm_application_insights.services_appinsights.instrumentation_key

    TableName                    = azurerm_cosmosdb_sql_container.mediainfo_service_cosmosdb_container.name
    PublicUrl                    = local.mediainfo_service_url
    CosmosDbEndpoint             = var.cosmosdb_endpoint
    CosmosDbKey                  = var.cosmosdb_key
    CosmosDbDatabaseId           = local.cosmosdb_id
    CosmosDbRegion               = var.azure_location
    ServicesUrl                  = local.services_url
    ServicesAuthType             = "AzureAD"
    ServicesAuthContext          = "{ \"scope\": \"${local.service_registry_url}/.default\" }"
    MediaStorageAccountName      = var.media_storage_account_name
    MediaStorageConnectionString = var.media_storage_connection_string
    WorkerFunctionId             = azurerm_storage_queue.mediainfo_service_worker_function_queue.name
  }
}
