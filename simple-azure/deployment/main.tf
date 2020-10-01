#########################
# Provider registration 
#########################

provider "azurerm" {
  version = "2.26.0"

  client_id       = var.azure_client_id
  client_secret   = var.azure_client_secret
  tenant_id       = var.azure_tenant_id
  subscription_id = var.azure_subscription_id
  
  features {}
}

provider "azuread" {
  version = "1.0.0"

  client_id       = var.azure_client_id
  client_secret   = var.azure_client_secret
  tenant_id       = var.azure_tenant_id
}

resource "azurerm_resource_group" "resource_group" {
  name     = "${var.global_prefix}-rg"
  location = var.azure_location
}

resource "azurerm_cosmosdb_account" "cosmosdb_account" {
  name                = "${var.global_prefix}-cosmosdb-account"
  resource_group_name = azurerm_resource_group.resource_group.name
  location            = var.azure_location
  offer_type          = "Standard"
  kind                = "GlobalDocumentDB"

  consistency_policy {
    consistency_level = "Strong"
  }

  geo_location {
    failover_priority = 0
    location          = var.azure_location
  }
}

resource "azurerm_cosmosdb_sql_database" "cosmosdb_database" {
  name                = "${var.global_prefix}-db"
  resource_group_name = azurerm_resource_group.resource_group.name
  account_name        = azurerm_cosmosdb_account.cosmosdb_account.name
  throughput          = 400
}

module "storage" {
  source = "./storage"
  
  azure_client_id          = var.azure_client_id
  azure_client_secret      = var.azure_client_secret
  azure_tenant_id          = var.azure_tenant_id
  azure_location           = var.azure_location

  resource_group_name      = azurerm_resource_group.resource_group.name
  global_prefix            = var.global_prefix
  global_prefix_lower_only = var.global_prefix_lower_only

  deploy_container     = var.deploy_container
  upload_container     = var.upload_container
  output_container     = var.output_container
}

module "services" {
  source = "./services"

  nodejs_version        = var.nodejs_version
  azure_subscription_id = var.azure_subscription_id
  azure_tenant_id       = var.azure_tenant_id
  azure_location        = var.azure_location

  environment_name         = var.environment_name
  environment_type         = var.environment_type
  global_prefix            = var.global_prefix
  resource_group_name      = azurerm_resource_group.resource_group.name
  resource_group_id        = azurerm_resource_group.resource_group.id

  cosmosdb_endpoint     = azurerm_cosmosdb_account.cosmosdb_account.endpoint
  cosmosdb_key          = azurerm_cosmosdb_account.cosmosdb_account.primary_master_key
  cosmosdb_account_name = azurerm_cosmosdb_account.cosmosdb_account.name
  cosmosdb_db_name      = azurerm_cosmosdb_sql_database.cosmosdb_database.name

  app_storage_connection_string = module.storage.app_storage_connection_string
  app_storage_account_name      = module.storage.app_storage_account_name
  app_storage_sas               = module.storage.app_storage_sas
  app_storage_access_key        = module.storage.app_storage_access_key
  deploy_container              = module.storage.deploy_container

  media_storage_connection_string = module.storage.media_storage_connection_string
  media_storage_account_name      = module.storage.media_storage_account_name
}