locals {
  service_registry_api_zip_file      = "./../services/service-registry/api-handler/build/dist/function.zip"
  service_registry_api_function_name = "${var.global_prefix}-service-registry-api"
  service_registry_url               = "https://${local.service_registry_api_function_name}.azurewebsites.net"
  services_url                       = "${local.service_registry_url}/services"
}

resource "azurerm_cosmosdb_sql_container" "service_registry_cosmosdb_container" {
  name                = "ServiceRegistry"
  resource_group_name = var.resource_group_name
  account_name        = var.cosmosdb_account_name
  database_name       = var.cosmosdb_db_name
  partition_key_path  = "/partitionKey"
}

resource "azuread_application" "service_registry_app" {
  name            = local.service_registry_api_function_name
  identifier_uris = [local.service_registry_url]
}

resource "azuread_service_principal" "service_registry_sp" {
  application_id               = azuread_application.service_registry_app.application_id
  app_role_assignment_required = false
}

resource "azurerm_storage_blob" "service_registry_api_function_zip" {
  name                   = "service-registry/function_${filesha256(local.service_registry_api_zip_file)}.zip"
  storage_account_name   = var.app_storage_account_name
  storage_container_name = var.deploy_container
  type                   = "Block"
  source                 = local.service_registry_api_zip_file
}

resource "azurerm_function_app" "service_registry_api_function" {
  name                       = local.service_registry_api_function_name
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
      client_id         = azuread_application.service_registry_app.application_id
      allowed_audiences = [local.service_registry_url]
    }
  }

  app_settings = {
    FUNCTIONS_WORKER_RUNTIME       = "node"
    FUNCTION_APP_EDIT_MODE         = "readonly"
    https_only                     = true
    HASH                           = filesha256(local.service_registry_api_zip_file)
    WEBSITE_RUN_FROM_PACKAGE       = "${local.deploy_container_url}/${azurerm_storage_blob.service_registry_api_function_zip.name}${var.app_storage_sas}"
    WEBSITE_NODE_DEFAULT_VERSION   = var.nodejs_version
    APPINSIGHTS_INSTRUMENTATIONKEY = azurerm_application_insights.services_appinsights.instrumentation_key

    TableName          = azurerm_cosmosdb_sql_container.service_registry_cosmosdb_container.name
    PublicUrl          = local.service_registry_url
    CosmosDbEndpoint   = var.cosmosdb_endpoint
    CosmosDbKey        = var.cosmosdb_key
    CosmosDbDatabaseId = local.cosmosdb_id
    CosmosDbRegion     = var.azure_location
  }
}
